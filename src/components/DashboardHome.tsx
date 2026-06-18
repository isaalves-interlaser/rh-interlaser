import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { supabase } from '../lib/supabase'
import './DashboardHome.css'

type DashboardPage =
  | 'pipeline'
  | 'candidatos'
  | 'vagas'
  | 'agenda'
  | 'onboarding'

type DashboardHomeProps = {
  userName: string
  onNavigate: (page: DashboardPage) => void
}



type DashboardIconType =
  | 'candidates'
  | 'vacancies'
  | 'interviews'
  | 'onboarding'
  | 'movement'
  | 'calendar'

function DashboardIcon({ type }: { type: DashboardIconType }) {
  const commonProps = {
    width: '18',
    height: '18',
    viewBox: '0 0 24 24',
    fill: 'none',
    xmlns: 'http://www.w3.org/2000/svg',
    'aria-hidden': true,
  }

  const strokeProps = {
    stroke: 'currentColor',
    strokeWidth: '2',
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  }

  switch (type) {
    case 'candidates':
      return (
        <svg {...commonProps}>
          <path {...strokeProps} d="M16 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2" />
          <circle {...strokeProps} cx="9.5" cy="7" r="4" />
          <path {...strokeProps} d="M20 8v6" />
          <path {...strokeProps} d="M23 11h-6" />
        </svg>
      )
    case 'vacancies':
      return (
        <svg {...commonProps}>
          <rect {...strokeProps} x="3" y="5" width="18" height="14" rx="2" />
          <path {...strokeProps} d="M8 5V3h8v2" />
          <path {...strokeProps} d="M3 11h18" />
          <path {...strokeProps} d="M9 15h6" />
        </svg>
      )
    case 'interviews':
      return (
        <svg {...commonProps}>
          <rect {...strokeProps} x="3" y="4" width="18" height="17" rx="2" />
          <path {...strokeProps} d="M8 2v4" />
          <path {...strokeProps} d="M16 2v4" />
          <path {...strokeProps} d="M3 10h18" />
          <path {...strokeProps} d="M9 15h.01" />
          <path {...strokeProps} d="M14 15h1" />
        </svg>
      )
    case 'onboarding':
      return (
        <svg {...commonProps}>
          <path {...strokeProps} d="M9 11l2 2 4-5" />
          <path {...strokeProps} d="M20 12v6a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h9" />
          <path {...strokeProps} d="M18 3h3v3" />
        </svg>
      )
    case 'movement':
      return (
        <svg {...commonProps}>
          <path {...strokeProps} d="M17 3l4 4-4 4" />
          <path {...strokeProps} d="M3 7h18" />
          <path {...strokeProps} d="M7 21l-4-4 4-4" />
          <path {...strokeProps} d="M21 17H3" />
        </svg>
      )
    case 'calendar':
      return (
        <svg {...commonProps}>
          <rect {...strokeProps} x="3" y="4" width="18" height="17" rx="2" />
          <path {...strokeProps} d="M8 2v4" />
          <path {...strokeProps} d="M16 2v4" />
          <path {...strokeProps} d="M3 10h18" />
          <path {...strokeProps} d="M12 14v3" />
          <path {...strokeProps} d="M10.5 15.5h3" />
        </svg>
      )
  }
}

type DashboardMetrics = {
  candidatosAtivos: number
  vagasAbertas: number
  entrevistasProximas: number
  onboardingsAtivos: number
}

type ApplicationRow = {
  id: string
  candidato_id: string
  vaga_id: string
  etapa: string
  status: string
  updated_at: string
}

type InterviewRow = {
  id: string
  candidatura_id: string
  inicio: string
  status: string
  modalidade: string
}

type CandidateRow = {
  id: string
  numero: number
  nome_completo: string
}

type VacancyRow = {
  id: string
  numero: number
  cargo: string
  setor: string
}

type RecentProcess = {
  id: string
  candidateName: string
  candidateNumber: number
  vacancyName: string
  vacancyNumber: number
  stage: string
  status: string
  updatedAt: string
}

type UpcomingInterview = {
  id: string
  candidateName: string
  vacancyName: string
  vacancyNumber: number
  startAt: string
  status: string
  modality: string
}

const stageLabels: Record<string, string> = {
  recebido: 'Recebido',
  em_analise: 'Em análise',
  entrevista_rh: 'Entrevista RH',
  entrevista_gestor: 'Entrevista com gestor',
  teste_pratico: 'Teste prático',
  exame_admissional: 'Exame admissional',
  documentacao: 'Documentação',
  contratado: 'Contratado',
}

const applicationStatusLabels: Record<string, string> = {
  ativo: 'Ativo',
  reprovado: 'Reprovado',
  desistente: 'Desistente',
  suspenso: 'Suspenso',
  banco_talentos: 'Banco de talentos',
  contratado: 'Contratado',
}

const interviewStatusLabels: Record<string, string> = {
  agendada: 'Agendada',
  confirmada: 'Confirmada',
  realizada: 'Realizada',
  cancelada: 'Cancelada',
  nao_compareceu: 'Não compareceu',
}

const modalityLabels: Record<string, string> = {
  presencial: 'Presencial',
  google_meet: 'Google Meet',
  teams: 'Microsoft Teams',
  zoom: 'Zoom',
  telefone: 'Telefone',
  outro: 'Outro',
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value))
}

function formatInterviewDate(value: string) {
  const date = new Date(value)
  const today = new Date()
  const tomorrow = new Date()
  tomorrow.setDate(today.getDate() + 1)

  const sameDate = (first: Date, second: Date) =>
    first.getFullYear() === second.getFullYear() &&
    first.getMonth() === second.getMonth() &&
    first.getDate() === second.getDate()

  const time = new Intl.DateTimeFormat('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)

  if (sameDate(date, today)) {
    return `Hoje, ${time}`
  }

  if (sameDate(date, tomorrow)) {
    return `Amanhã, ${time}`
  }

  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

function DashboardHome({
  userName,
  onNavigate,
}: DashboardHomeProps) {
  const [metrics, setMetrics] = useState<DashboardMetrics>({
    candidatosAtivos: 0,
    vagasAbertas: 0,
    entrevistasProximas: 0,
    onboardingsAtivos: 0,
  })
  const [recentProcesses, setRecentProcesses] = useState<
    RecentProcess[]
  >([])
  const [upcomingInterviews, setUpcomingInterviews] = useState<
    UpcomingInterview[]
  >([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const currentDate = useMemo(() => new Date(), [])

  const loadDashboard = useCallback(async () => {
    setLoading(true)
    setError('')

    const now = new Date().toISOString()

    const [
      candidateCountResult,
      vacancyCountResult,
      interviewCountResult,
      onboardingCountResult,
      recentApplicationsResult,
      upcomingInterviewsResult,
    ] = await Promise.all([
      supabase
        .from('candidatos')
        .select('*', { count: 'exact', head: true })
        .eq('active', true),

      supabase
        .from('vagas')
        .select('*', { count: 'exact', head: true })
        .in('status', ['aberta', 'em_selecao']),

      supabase
        .from('entrevistas')
        .select('*', { count: 'exact', head: true })
        .gte('inicio', now)
        .in('status', ['agendada', 'confirmada']),

      supabase
        .from('onboardings')
        .select('*', { count: 'exact', head: true })
        .in('status', [
          'nao_iniciado',
          'em_andamento',
          'bloqueado',
        ]),

      supabase
        .from('candidaturas')
        .select(
          'id, candidato_id, vaga_id, etapa, status, updated_at',
        )
        .order('updated_at', { ascending: false })
        .limit(6),

      supabase
        .from('entrevistas')
        .select(
          'id, candidatura_id, inicio, status, modalidade',
        )
        .gte('inicio', now)
        .in('status', ['agendada', 'confirmada'])
        .order('inicio', { ascending: true })
        .limit(5),
    ])

    const firstError =
      candidateCountResult.error ??
      vacancyCountResult.error ??
      interviewCountResult.error ??
      onboardingCountResult.error ??
      recentApplicationsResult.error ??
      upcomingInterviewsResult.error

    if (firstError) {
      console.error(
        'Erro ao carregar o dashboard:',
        firstError.message,
      )
      setError(
        'Não foi possível carregar todos os dados do dashboard.',
      )
      setLoading(false)
      return
    }

    const recentApplications =
      (recentApplicationsResult.data ?? []) as ApplicationRow[]

    const interviewRows =
      (upcomingInterviewsResult.data ?? []) as InterviewRow[]

    const interviewApplicationIds = Array.from(
      new Set(
        interviewRows.map((item) => item.candidatura_id),
      ),
    )

    let interviewApplications: ApplicationRow[] = []

    if (interviewApplicationIds.length > 0) {
      const { data, error: applicationError } = await supabase
        .from('candidaturas')
        .select(
          'id, candidato_id, vaga_id, etapa, status, updated_at',
        )
        .in('id', interviewApplicationIds)

      if (applicationError) {
        console.error(
          'Erro ao carregar candidaturas das entrevistas:',
          applicationError.message,
        )
        setError(
          'Os indicadores foram carregados, mas alguns detalhes não puderam ser exibidos.',
        )
      } else {
        interviewApplications = (data ?? []) as ApplicationRow[]
      }
    }

    const allApplications = [
      ...recentApplications,
      ...interviewApplications,
    ]

    const candidateIds = Array.from(
      new Set(allApplications.map((item) => item.candidato_id)),
    )
    const vacancyIds = Array.from(
      new Set(allApplications.map((item) => item.vaga_id)),
    )

    let candidateRows: CandidateRow[] = []
    let vacancyRows: VacancyRow[] = []

    const detailQueries = []

    if (candidateIds.length > 0) {
      detailQueries.push(
        supabase
          .from('candidatos')
          .select('id, numero, nome_completo')
          .in('id', candidateIds),
      )
    }

    if (vacancyIds.length > 0) {
      detailQueries.push(
        supabase
          .from('vagas')
          .select('id, numero, cargo, setor')
          .in('id', vacancyIds),
      )
    }

    const detailResults = await Promise.all(detailQueries)

    for (const result of detailResults) {
      if (result.error) {
        console.error(
          'Erro ao carregar detalhes do dashboard:',
          result.error.message,
        )
        continue
      }

      const rows = result.data ?? []

      if (
        rows.length > 0 &&
        'nome_completo' in rows[0]
      ) {
        candidateRows = rows as CandidateRow[]
      } else if (
        rows.length > 0 &&
        'cargo' in rows[0]
      ) {
        vacancyRows = rows as VacancyRow[]
      }
    }

    const candidateMap = new Map(
      candidateRows.map((item) => [item.id, item]),
    )
    const vacancyMap = new Map(
      vacancyRows.map((item) => [item.id, item]),
    )
    const applicationMap = new Map(
      allApplications.map((item) => [item.id, item]),
    )

    setMetrics({
      candidatosAtivos: candidateCountResult.count ?? 0,
      vagasAbertas: vacancyCountResult.count ?? 0,
      entrevistasProximas: interviewCountResult.count ?? 0,
      onboardingsAtivos: onboardingCountResult.count ?? 0,
    })

    setRecentProcesses(
      recentApplications
        .map((application) => {
          const candidate = candidateMap.get(
            application.candidato_id,
          )
          const vacancy = vacancyMap.get(application.vaga_id)

          if (!candidate || !vacancy) {
            return null
          }

          return {
            id: application.id,
            candidateName: candidate.nome_completo,
            candidateNumber: candidate.numero,
            vacancyName: vacancy.cargo,
            vacancyNumber: vacancy.numero,
            stage: application.etapa,
            status: application.status,
            updatedAt: application.updated_at,
          } satisfies RecentProcess
        })
        .filter(
          (item): item is RecentProcess => item !== null,
        ),
    )

    setUpcomingInterviews(
      interviewRows
        .map((interview) => {
          const application = applicationMap.get(
            interview.candidatura_id,
          )

          if (!application) {
            return null
          }

          const candidate = candidateMap.get(
            application.candidato_id,
          )
          const vacancy = vacancyMap.get(application.vaga_id)

          if (!candidate || !vacancy) {
            return null
          }

          return {
            id: interview.id,
            candidateName: candidate.nome_completo,
            vacancyName: vacancy.cargo,
            vacancyNumber: vacancy.numero,
            startAt: interview.inicio,
            status: interview.status,
            modality: interview.modalidade,
          } satisfies UpcomingInterview
        })
        .filter(
          (item): item is UpcomingInterview =>
            item !== null,
        ),
    )

    setLoading(false)
  }, [])

  useEffect(() => {
    loadDashboard()
  }, [loadDashboard])

  const month = new Intl.DateTimeFormat('pt-BR', {
    month: 'long',
  }).format(currentDate)

  const formattedMonth =
    month.charAt(0).toUpperCase() + month.slice(1)

  if (loading) {
    return (
      <section className="dashboard-home-loading">
        <div className="dashboard-home-loading-logo">RH</div>
        <p>Carregando indicadores...</p>
      </section>
    )
  }

  return (
    <div className="dashboard-home">
      <section className="dashboard-home-welcome">
        <div>
          <span>Visão geral</span>
          <h2>Olá, {userName}</h2>
          <p>
            Acompanhe os números e as próximas atividades do
            recrutamento.
          </p>
        </div>

        <div className="dashboard-home-welcome-actions">
          <div className="dashboard-home-date">
            <strong>{formattedMonth}</strong>
            <span>{currentDate.getFullYear()}</span>
          </div>

          <button type="button" onClick={loadDashboard}>
            Atualizar dados
          </button>
        </div>
      </section>

      {error && (
        <div className="dashboard-home-message" role="alert">
          {error}
        </div>
      )}

      <section className="dashboard-home-metrics">
        <button
          className="dashboard-home-metric"
          type="button"
          onClick={() => onNavigate('candidatos')}
        >
          <div className="dashboard-home-metric-top">
            <span>Candidatos ativos</span>
            <div><DashboardIcon type="candidates" /></div>
          </div>
          <strong>{metrics.candidatosAtivos}</strong>
          <small>Cadastros disponíveis no processo</small>
        </button>

        <button
          className="dashboard-home-metric"
          type="button"
          onClick={() => onNavigate('vagas')}
        >
          <div className="dashboard-home-metric-top">
            <span>Vagas abertas</span>
            <div><DashboardIcon type="vacancies" /></div>
          </div>
          <strong>{metrics.vagasAbertas}</strong>
          <small>Abertas ou em seleção</small>
        </button>

        <button
          className="dashboard-home-metric"
          type="button"
          onClick={() => onNavigate('agenda')}
        >
          <div className="dashboard-home-metric-top">
            <span>Próximas entrevistas</span>
            <div><DashboardIcon type="interviews" /></div>
          </div>
          <strong>{metrics.entrevistasProximas}</strong>
          <small>Agendadas ou confirmadas</small>
        </button>

        <button
          className="dashboard-home-metric"
          type="button"
          onClick={() => onNavigate('onboarding')}
        >
          <div className="dashboard-home-metric-top">
            <span>Onboardings ativos</span>
            <div><DashboardIcon type="onboarding" /></div>
          </div>
          <strong>{metrics.onboardingsAtivos}</strong>
          <small>Não iniciados ou em andamento</small>
        </button>
      </section>

      <section className="dashboard-home-grid">
        <article className="dashboard-home-panel">
          <header>
            <div>
              <h3>Processos recentes</h3>
              <p>Últimas candidaturas movimentadas</p>
            </div>

            <button
              type="button"
              onClick={() => onNavigate('pipeline')}
            >
              Abrir pipeline
            </button>
          </header>

          <div className="dashboard-home-process-list">
            {recentProcesses.map((process) => (
              <button
                className="dashboard-home-process"
                type="button"
                key={process.id}
                onClick={() => onNavigate('pipeline')}
              >
                <div className="dashboard-home-avatar">
                  {process.candidateName
                    .charAt(0)
                    .toUpperCase()}
                </div>

                <div className="dashboard-home-process-main">
                  <strong>{process.candidateName}</strong>
                  <span>
                    CAN-
                    {String(process.candidateNumber).padStart(
                      6,
                      '0',
                    )}{' '}
                    · VAG-
                    {String(process.vacancyNumber).padStart(
                      6,
                      '0',
                    )}{' '}
                    — {process.vacancyName}
                  </span>
                </div>

                <div className="dashboard-home-process-status">
                  <span className="stage">
                    {stageLabels[process.stage] ??
                      process.stage}
                  </span>
                  <small>
                    {applicationStatusLabels[
                      process.status
                    ] ?? process.status}
                  </small>
                </div>

                <time>{formatDateTime(process.updatedAt)}</time>
              </button>
            ))}

            {recentProcesses.length === 0 && (
              <div className="dashboard-home-empty">
                <div><DashboardIcon type="movement" /></div>
                <strong>Nenhuma movimentação recente</strong>
                <p>
                  As candidaturas movimentadas aparecerão aqui.
                </p>
              </div>
            )}
          </div>
        </article>

        <article className="dashboard-home-panel">
          <header>
            <div>
              <h3>Próximas entrevistas</h3>
              <p>Compromissos agendados</p>
            </div>

            <button
              type="button"
              onClick={() => onNavigate('agenda')}
            >
              Abrir agenda
            </button>
          </header>

          <div className="dashboard-home-interview-list">
            {upcomingInterviews.map((interview) => (
              <button
                className="dashboard-home-interview"
                type="button"
                key={interview.id}
                onClick={() => onNavigate('agenda')}
              >
                <div className="dashboard-home-interview-date">
                  <strong>
                    {formatInterviewDate(interview.startAt)}
                  </strong>
                  <span>
                    {modalityLabels[interview.modality] ??
                      interview.modality}
                  </span>
                </div>

                <div className="dashboard-home-interview-main">
                  <strong>{interview.candidateName}</strong>
                  <span>
                    VAG-
                    {String(interview.vacancyNumber).padStart(
                      6,
                      '0',
                    )}{' '}
                    — {interview.vacancyName}
                  </span>
                </div>

                <span
                  className={`dashboard-home-interview-status status-${interview.status}`}
                >
                  {interviewStatusLabels[interview.status] ??
                    interview.status}
                </span>
              </button>
            ))}

            {upcomingInterviews.length === 0 && (
              <div className="dashboard-home-empty">
                <div><DashboardIcon type="calendar" /></div>
                <strong>Nenhuma entrevista próxima</strong>
                <p>
                  Os próximos compromissos aparecerão aqui.
                </p>
              </div>
            )}
          </div>
        </article>
      </section>
    </div>
  )
}

export default DashboardHome
