import {
  useMemo,
  useState,
  type FormEvent,
} from 'react'
import { supabase } from '../lib/supabase'
import './AdicionarCandidatoPipelineModal.css'

type CandidateOption = {
  id: string
  numero: number
  nome_completo: string
  email: string | null
  whatsapp: string | null
}

type VacancyOption = {
  id: string
  numero: number
  cargo: string
  setor: string
  status: string
}

type ProfileOption = {
  id: string
  full_name: string
}

type ExistingApplication = {
  candidato_id: string
  vaga_id: string
}

type AdicionarCandidatoPipelineModalProps = {
  candidatos: CandidateOption[]
  vagas: VacancyOption[]
  responsaveisRh: ProfileOption[]
  candidaturas: ExistingApplication[]
  onClose: () => void
  onCreated: (message: string) => Promise<void> | void
  onError: (message: string) => void
}

type Mode = 'existente' | 'novo'

function normalizePhone(value: string) {
  return value.replace(/\D/g, '')
}

function nullableText(value: string) {
  const normalized = value.trim()
  return normalized || null
}

function AdicionarCandidatoPipelineModal({
  candidatos,
  vagas,
  responsaveisRh,
  candidaturas,
  onClose,
  onCreated,
  onError,
}: AdicionarCandidatoPipelineModalProps) {
  const [mode, setMode] = useState<Mode>('existente')
  const [candidateId, setCandidateId] = useState('')
  const [vacancyId, setVacancyId] = useState('')
  const [responsibleId, setResponsibleId] = useState('')
  const [notes, setNotes] = useState('')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [whatsapp, setWhatsapp] = useState('')
  const [saving, setSaving] = useState(false)
  const [localError, setLocalError] = useState('')

  const availableVacancies = useMemo(
    () =>
      vagas.filter((vaga) =>
        ['aberta', 'em_selecao'].includes(vaga.status),
      ),
    [vagas],
  )

  function showError(message: string) {
    setLocalError(message)
    onError(message)
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLocalError('')

    if (!vacancyId) {
      showError('Selecione a vaga da candidatura.')
      return
    }

    if (!responsibleId) {
      showError('Selecione uma pessoa do RH como responsável.')
      return
    }

    setSaving(true)

    try {
      let selectedCandidateId = candidateId
      let successMessage = 'Candidatura adicionada à Pipeline.'

      if (mode === 'existente') {
        if (!selectedCandidateId) {
          throw new Error('Selecione um candidato.')
        }

        const duplicated = candidaturas.some(
          (item) =>
            item.candidato_id === selectedCandidateId &&
            item.vaga_id === vacancyId,
        )

        if (duplicated) {
          throw new Error(
            'Este candidato já está vinculado a essa vaga.',
          )
        }
      } else {
        const normalizedName = name.trim()
        const normalizedEmail = email.trim().toLowerCase()
        const normalizedWhatsapp = normalizePhone(whatsapp)

        if (normalizedName.length < 3) {
          throw new Error('Informe o nome completo do candidato.')
        }

        if (
          normalizedEmail &&
          !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)
        ) {
          throw new Error('Informe um e-mail válido.')
        }

        if (
          normalizedWhatsapp &&
          (normalizedWhatsapp.length < 10 ||
            normalizedWhatsapp.length > 13)
        ) {
          throw new Error('Informe um WhatsApp válido com DDD.')
        }

        const duplicatedEmail =
          Boolean(normalizedEmail) &&
          candidatos.some(
            (candidate) =>
              candidate.email?.trim().toLowerCase() ===
              normalizedEmail,
          )

        if (duplicatedEmail) {
          throw new Error(
            'Já existe um candidato cadastrado com esse e-mail.',
          )
        }

        const duplicatedWhatsapp =
          Boolean(normalizedWhatsapp) &&
          candidatos.some(
            (candidate) =>
              normalizePhone(candidate.whatsapp ?? '') ===
              normalizedWhatsapp,
          )

        if (duplicatedWhatsapp) {
          throw new Error(
            'Já existe um candidato cadastrado com esse WhatsApp.',
          )
        }

        const { data: createdCandidate, error: candidateError } =
          await supabase
            .from('candidatos')
            .insert({
              nome_completo: normalizedName,
              email: normalizedEmail || null,
              whatsapp: normalizedWhatsapp || null,
              origem: 'outro',
              observacoes: nullableText(notes),
            })
            .select('id')
            .single()

        if (candidateError || !createdCandidate) {
          if (candidateError?.code === '23505') {
            const detail = `${candidateError.message} ${candidateError.details ?? ''}`.toLowerCase()
            throw new Error(
              detail.includes('whatsapp')
                ? 'Já existe um candidato cadastrado com esse WhatsApp.'
                : 'Já existe um candidato cadastrado com esse e-mail.',
            )
          }

          throw new Error(
            candidateError?.message ??
              'Não foi possível cadastrar o candidato.',
          )
        }

        selectedCandidateId = createdCandidate.id
        successMessage =
          'Candidato cadastrado e adicionado à Pipeline.'
      }

      const { error: applicationError } = await supabase
        .from('candidaturas')
        .insert({
          candidato_id: selectedCandidateId,
          vaga_id: vacancyId,
          etapa: 'recebido',
          status: 'ativo',
          responsavel_id: responsibleId,
          observacoes: nullableText(notes),
        })

      if (applicationError) {
        if (applicationError.code === '23505') {
          throw new Error(
            'Este candidato já está vinculado a essa vaga.',
          )
        }

        throw new Error(
          applicationError.message ||
            'Não foi possível criar a candidatura.',
        )
      }

      await onCreated(successMessage)
      onClose()
    } catch (error) {
      showError(
        error instanceof Error
          ? error.message
          : 'Não foi possível adicionar o candidato.',
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="pipeline-add-modal-overlay"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !saving) {
          onClose()
        }
      }}
    >
      <section
        className="pipeline-add-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="pipeline-add-candidate-title"
      >
        <header>
          <div>
            <span>Pipeline</span>
            <h2 id="pipeline-add-candidate-title">
              Adicionar candidato
            </h2>
            <p>
              Vincule um candidato existente ou faça um cadastro
              rápido.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            aria-label="Fechar"
          >
            ×
          </button>
        </header>

        <form onSubmit={submit}>
          <div className="pipeline-add-mode-switch">
            <button
              className={mode === 'existente' ? 'active' : ''}
              type="button"
              onClick={() => {
                setMode('existente')
                setLocalError('')
              }}
              disabled={saving}
            >
              Candidato existente
            </button>
            <button
              className={mode === 'novo' ? 'active' : ''}
              type="button"
              onClick={() => {
                setMode('novo')
                setLocalError('')
              }}
              disabled={saving}
            >
              Novo candidato
            </button>
          </div>

          <div className="pipeline-add-form-grid">
            {mode === 'existente' ? (
              <div className="pipeline-add-field full">
                <label htmlFor="pipeline-add-candidate">
                  Candidato *
                </label>
                <select
                  id="pipeline-add-candidate"
                  value={candidateId}
                  onChange={(event) =>
                    setCandidateId(event.target.value)
                  }
                  disabled={saving}
                >
                  <option value="">Selecione...</option>
                  {candidatos.map((candidate) => (
                    <option key={candidate.id} value={candidate.id}>
                      CAN-{String(candidate.numero).padStart(6, '0')} —{' '}
                      {candidate.nome_completo}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <>
                <div className="pipeline-add-field full">
                  <label htmlFor="pipeline-add-name">
                    Nome completo *
                  </label>
                  <input
                    id="pipeline-add-name"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    disabled={saving}
                    autoFocus
                  />
                </div>

                <div className="pipeline-add-field">
                  <label htmlFor="pipeline-add-email">E-mail</label>
                  <input
                    id="pipeline-add-email"
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    disabled={saving}
                  />
                </div>

                <div className="pipeline-add-field">
                  <label htmlFor="pipeline-add-whatsapp">
                    WhatsApp
                  </label>
                  <input
                    id="pipeline-add-whatsapp"
                    value={whatsapp}
                    onChange={(event) =>
                      setWhatsapp(event.target.value)
                    }
                    placeholder="(19) 99999-9999"
                    disabled={saving}
                  />
                </div>
              </>
            )}

            <div className="pipeline-add-field">
              <label htmlFor="pipeline-add-vacancy">Vaga *</label>
              <select
                id="pipeline-add-vacancy"
                value={vacancyId}
                onChange={(event) =>
                  setVacancyId(event.target.value)
                }
                disabled={saving}
              >
                <option value="">Selecione...</option>
                {availableVacancies.map((vacancy) => (
                  <option key={vacancy.id} value={vacancy.id}>
                    VAG-{String(vacancy.numero).padStart(6, '0')} —{' '}
                    {vacancy.cargo} · {vacancy.setor}
                  </option>
                ))}
              </select>
            </div>

            <div className="pipeline-add-field">
              <label htmlFor="pipeline-add-responsible">
                Responsável do RH *
              </label>
              <select
                id="pipeline-add-responsible"
                value={responsibleId}
                onChange={(event) =>
                  setResponsibleId(event.target.value)
                }
                disabled={saving}
              >
                <option value="">Selecione...</option>
                {responsaveisRh.map((profile) => (
                  <option key={profile.id} value={profile.id}>
                    {profile.full_name}
                  </option>
                ))}
              </select>
            </div>

            <div className="pipeline-add-field full">
              <label htmlFor="pipeline-add-notes">Observações</label>
              <textarea
                id="pipeline-add-notes"
                rows={3}
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                disabled={saving}
              />
            </div>
          </div>

          {availableVacancies.length === 0 && (
            <div className="pipeline-add-warning">
              Não existe vaga Aberta ou Em seleção disponível.
            </div>
          )}

          {localError && (
            <div className="pipeline-add-error" role="alert">
              {localError}
            </div>
          )}

          <footer>
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
            >
              Cancelar
            </button>
            <button
              className="primary"
              type="submit"
              disabled={saving || availableVacancies.length === 0}
            >
              {saving ? 'Salvando...' : 'Adicionar à Pipeline'}
            </button>
          </footer>
        </form>
      </section>
    </div>
  )
}

export default AdicionarCandidatoPipelineModal
