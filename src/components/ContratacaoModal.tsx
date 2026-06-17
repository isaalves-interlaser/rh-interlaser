import { useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import './ContratacaoModal.css'

type DocumentType =
  | 'rg'
  | 'cpf'
  | 'carteira_trabalho'
  | 'certidao_nascimento'

type RhProfile = {
  id: string
  full_name: string
}

type UpdatedApplication = {
  id: string
  candidato_id: string
  vaga_id: string
  etapa: string
  status: string
  responsavel_id: string | null
  data_entrada: string
  proxima_acao: string | null
  proxima_acao_em: string | null
  motivo_reprovacao: string | null
  parecer_final: string | null
  observacoes: string | null
  created_at: string
  updated_at: string
}

type ContratacaoModalProps = {
  candidaturaId: string
  candidato: {
    numero: number
    nome: string
    email: string | null
  }
  vaga: {
    numero: number
    cargo: string
    setor: string
  }
  responsaveisRh: RhProfile[]
  onClose: () => void
  onSuccess: (
    candidature: UpdatedApplication,
    message: string,
  ) => void
}

const documentOptions: Array<{
  id: DocumentType
  label: string
  description: string
}> = [
  {
    id: 'rg',
    label: 'RG',
    description: 'Documento de identificação com foto.',
  },
  {
    id: 'cpf',
    label: 'CPF',
    description: 'Comprovante ou documento que contenha o CPF.',
  },
  {
    id: 'carteira_trabalho',
    label: 'Carteira de Trabalho',
    description: 'Carteira de Trabalho digital ou física.',
  },
  {
    id: 'certidao_nascimento',
    label: 'Certidão de Nascimento',
    description: 'Certidão legível e completa.',
  },
]

function dateAfter(days: number) {
  const date = new Date()
  date.setDate(date.getDate() + days)
  return date.toISOString().slice(0, 10)
}

async function readFunctionError(error: unknown) {
  const candidate = error as {
    message?: string
    context?: Response
  }

  if (candidate.context) {
    try {
      const body = await candidate.context.clone().json()
      if (body?.error) return String(body.error)
    } catch {
      // Usa a mensagem padrão abaixo.
    }
  }

  return candidate.message ?? 'Não foi possível concluir a contratação.'
}

function ContratacaoModal({
  candidaturaId,
  candidato,
  vaga,
  responsaveisRh,
  onClose,
  onSuccess,
}: ContratacaoModalProps) {
  const [responsavelId, setResponsavelId] = useState('')
  const [dataPrevistaInicio, setDataPrevistaInicio] = useState(
    dateAfter(7),
  )
  const [prazoEnvio, setPrazoEnvio] = useState(dateAfter(3))
  const [documentos, setDocumentos] = useState<DocumentType[]>(
    documentOptions.map((item) => item.id),
  )
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  const canSubmit = useMemo(
    () =>
      Boolean(
        candidato.email &&
          responsavelId &&
          dataPrevistaInicio &&
          prazoEnvio &&
          documentos.length > 0,
      ),
    [
      candidato.email,
      dataPrevistaInicio,
      documentos.length,
      prazoEnvio,
      responsavelId,
    ],
  )

  function toggleDocument(type: DocumentType) {
    setDocumentos((current) =>
      current.includes(type)
        ? current.filter((item) => item !== type)
        : [...current, type],
    )
    setErro('')
  }

  async function confirmHiring() {
    setErro('')

    if (!candidato.email) {
      setErro(
        'Cadastre o e-mail do candidato antes de confirmar a contratação.',
      )
      return
    }

    if (!responsavelId) {
      setErro('Selecione uma pessoa do Recursos Humanos.')
      return
    }

    if (documentos.length === 0) {
      setErro('Selecione pelo menos um documento.')
      return
    }

    if (prazoEnvio > dataPrevistaInicio) {
      setErro(
        'O prazo de envio não pode ser posterior à data prevista de início.',
      )
      return
    }

    setSalvando(true)

    const { data, error } = await supabase.functions.invoke(
      'contratar-solicitar-documentos',
      {
        body: {
          candidaturaId,
          responsavelId,
          dataPrevistaInicio,
          prazoEnvio,
          documentos,
        },
      },
    )

    setSalvando(false)

    if (error || !data?.ok || !data?.candidature) {
      setErro(
        error
          ? await readFunctionError(error)
          : data?.error ?? 'Não foi possível concluir a contratação.',
      )
      return
    }

    onSuccess(data.candidature, data.message)
  }

  return (
    <div
      className="hire-modal-overlay"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !salvando) {
          onClose()
        }
      }}
    >
      <section
        className="hire-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="hire-modal-title"
      >
        <header className="hire-modal-header">
          <div>
            <span>Contratação</span>
            <h2 id="hire-modal-title">
              Contratar e solicitar documentos
            </h2>
            <p>
              A confirmação criará o onboarding, a pasta no Drive
              e enviará o link ao candidato.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={salvando}
            aria-label="Fechar"
          >
            ×
          </button>
        </header>

        <div className="hire-modal-body">
          <section className="hire-summary">
            <div>
              <span>Candidato</span>
              <strong>{candidato.nome}</strong>
              <small>
                CAN-{String(candidato.numero).padStart(6, '0')}
              </small>
            </div>

            <div>
              <span>Vaga</span>
              <strong>{vaga.cargo}</strong>
              <small>
                VAG-{String(vaga.numero).padStart(6, '0')} ·{' '}
                {vaga.setor}
              </small>
            </div>

            <div>
              <span>E-mail de envio</span>
              <strong className={!candidato.email ? 'missing' : ''}>
                {candidato.email ?? 'Não cadastrado'}
              </strong>
            </div>
          </section>

          <section className="hire-form-section">
            <h3>Dados da admissão</h3>

            <div className="hire-form-grid">
              <div className="hire-field full">
                <label htmlFor="hire-responsible">
                  Responsável do RH *
                </label>
                <select
                  id="hire-responsible"
                  value={responsavelId}
                  onChange={(event) => {
                    setResponsavelId(event.target.value)
                    setErro('')
                  }}
                  disabled={salvando}
                >
                  <option value="">Selecione</option>
                  {responsaveisRh.map((profile) => (
                    <option key={profile.id} value={profile.id}>
                      {profile.full_name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="hire-field">
                <label htmlFor="hire-start-date">
                  Data prevista de início *
                </label>
                <input
                  id="hire-start-date"
                  type="date"
                  value={dataPrevistaInicio}
                  onChange={(event) => {
                    setDataPrevistaInicio(event.target.value)
                    setErro('')
                  }}
                  disabled={salvando}
                />
              </div>

              <div className="hire-field">
                <label htmlFor="hire-documents-due">
                  Prazo para os documentos *
                </label>
                <input
                  id="hire-documents-due"
                  type="date"
                  value={prazoEnvio}
                  max={dataPrevistaInicio}
                  onChange={(event) => {
                    setPrazoEnvio(event.target.value)
                    setErro('')
                  }}
                  disabled={salvando}
                />
              </div>
            </div>
          </section>

          <section className="hire-form-section">
            <div className="hire-documents-heading">
              <div>
                <h3>Documentos solicitados</h3>
                <p>
                  O RH pode desmarcar o que não for necessário.
                </p>
              </div>
              <strong>{documentos.length} selecionado(s)</strong>
            </div>

            <div className="hire-documents-grid">
              {documentOptions.map((document) => {
                const checked = documentos.includes(document.id)

                return (
                  <label
                    className={
                      checked
                        ? 'hire-document-option selected'
                        : 'hire-document-option'
                    }
                    key={document.id}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleDocument(document.id)}
                      disabled={salvando}
                    />

                    <span className="hire-document-check">
                      {checked ? '✓' : ''}
                    </span>

                    <span>
                      <strong>{document.label}</strong>
                      <small>{document.description}</small>
                    </span>
                  </label>
                )
              })}
            </div>
          </section>

          {erro && (
            <div className="hire-message error" role="alert">
              {erro}
            </div>
          )}
        </div>

        <footer className="hire-modal-actions">
          <button
            className="secondary"
            type="button"
            onClick={onClose}
            disabled={salvando}
          >
            Cancelar
          </button>

          <button
            className="primary"
            type="button"
            onClick={confirmHiring}
            disabled={salvando || !canSubmit}
          >
            {salvando
              ? 'Criando pasta e enviando e-mail...'
              : 'Contratar e solicitar documentos'}
          </button>
        </footer>
      </section>
    </div>
  )
}

export default ContratacaoModal
export type { UpdatedApplication }
