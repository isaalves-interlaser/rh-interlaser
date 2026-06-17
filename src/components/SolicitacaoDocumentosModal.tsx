import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import './SolicitacaoDocumentosModal.css'

type DocumentType = string

type RhProfile = {
  id: string
  full_name: string
}

type UpdatedApplication = {
  id: string
  candidato_id: string
  vaga_id: string
  etapa:
    | 'recebido'
    | 'em_analise'
    | 'entrevista_rh'
    | 'entrevista_gestor'
    | 'teste_pratico'
    | 'documentacao'
    | 'exame_admissional'
    | 'contratado'
  status:
    | 'ativo'
    | 'reprovado'
    | 'desistente'
    | 'suspenso'
    | 'banco_talentos'
    | 'contratado'
  responsavel_id: string | null
  data_entrada: string
  proxima_acao: string | null
  proxima_acao_em: string | null
  motivo_reprovacao: string | null
  parecer_final: string | null
  observacoes: string | null
  teste_inicio: string | null
  teste_local: string | null
  exame_inicio: string | null
  exame_local: string | null
  exame_status:
    | 'em_andamento'
    | 'apto'
    | 'inapto'
    | 'cancelado'
    | null
  created_at: string
  updated_at: string
}

type SolicitacaoDocumentosModalProps = {
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

const fallbackDocumentOptions: Array<{
  id: DocumentType
  label: string
  description: string
  defaultSelected: boolean
}> = [
  {
    id: 'rg',
    label: 'RG',
    description: 'Documento de identificação com foto.',
    defaultSelected: true,
  },
  {
    id: 'cpf',
    label: 'CPF',
    description: 'Comprovante ou documento que contenha o CPF.',
    defaultSelected: true,
  },
  {
    id: 'carteira_trabalho',
    label: 'Carteira de Trabalho',
    description: 'Carteira de Trabalho digital ou física.',
    defaultSelected: true,
  },
  {
    id: 'certidao_nascimento',
    label: 'Certidão de Nascimento',
    description: 'Certidão legível e completa.',
    defaultSelected: true,
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

  return candidate.message ?? 'Não foi possível solicitar os documentos.'
}

function SolicitacaoDocumentosModal({
  candidaturaId,
  candidato,
  vaga,
  responsaveisRh,
  onClose,
  onSuccess,
}: SolicitacaoDocumentosModalProps) {
  const [responsavelId, setResponsavelId] = useState('')
  const [dataPrevistaInicio, setDataPrevistaInicio] = useState(
    dateAfter(7),
  )
  const [prazoEnvio, setPrazoEnvio] = useState(dateAfter(3))
  const [documentOptions, setDocumentOptions] = useState(
    fallbackDocumentOptions,
  )
  const [documentos, setDocumentos] = useState<DocumentType[]>(
    fallbackDocumentOptions
      .filter((item) => item.defaultSelected)
      .map((item) => item.id),
  )
  const [carregandoDocumentos, setCarregandoDocumentos] =
    useState(true)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  useEffect(() => {
    let mounted = true

    async function loadConfiguredDocuments() {
      const { data, error } = await supabase
        .from('documentos_configuracao')
        .select('codigo, nome, descricao, padrao')
        .eq('active', true)
        .order('ordem')

      if (!mounted) {
        return
      }

      if (error) {
        console.error(
          'Erro ao carregar documentos configurados:',
          error.message,
        )
        setCarregandoDocumentos(false)
        return
      }

      const configured = (data ?? []).map((item) => ({
        id: String(item.codigo),
        label: item.nome,
        description:
          item.descricao ?? 'Documento admissional.',
        defaultSelected: item.padrao,
      }))

      if (configured.length > 0) {
        setDocumentOptions(configured)
        setDocumentos(
          configured
            .filter((item) => item.defaultSelected)
            .map((item) => item.id),
        )
      }

      setCarregandoDocumentos(false)
    }

    loadConfiguredDocuments()

    return () => {
      mounted = false
    }
  }, [])

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

  async function requestDocuments() {
    setErro('')

    if (!candidato.email) {
      setErro(
        'Cadastre o e-mail do candidato antes de solicitar os documentos.',
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
      'solicitar-documentos-admissionais',
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
          : data?.error ?? 'Não foi possível solicitar os documentos.',
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
            <span>Documentação</span>
            <h2 id="hire-modal-title">
              Solicitar documentos admissionais
            </h2>
            <p>
              A solicitação criará o pré-onboarding, a pasta no Drive
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
            <h3>Dados da solicitação</h3>

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

            {carregandoDocumentos ? (
              <div className="hire-documents-loading">
                Carregando documentos configurados...
              </div>
            ) : (
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
            )}
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
            onClick={requestDocuments}
            disabled={
              salvando ||
              carregandoDocumentos ||
              !canSubmit
            }
          >
            {salvando
              ? 'Criando pasta e enviando e-mail...'
              : 'Solicitar documentos admissionais'}
          </button>
        </footer>
      </section>
    </div>
  )
}

export default SolicitacaoDocumentosModal
export type { UpdatedApplication }
