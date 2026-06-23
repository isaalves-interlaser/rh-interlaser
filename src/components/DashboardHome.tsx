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
  | 'contratos'
  | 'documentacao-config'

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
  | 'alert'
  | 'contract'
  | 'document'
  | 'analysis'
  | 'checklist'

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
    case 'alert':
      return (
        <svg {...commonProps}>
          <path {...strokeProps} d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
          <path {...strokeProps} d="M12 9v4" />
          <path {...strokeProps} d="M12 17h.01" />
        </svg>
      )
    case 'contract':
      return (
        <svg {...commonProps}>
          <path {...strokeProps} d="M6 2h9l5 5v15H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2Z" />
          <path {...strokeProps} d="M14 2v6h6" />
          <path {...strokeProps} d="M8 13h8" />
          <path {...strokeProps} d="M8 17h5" />
        </svg>
      )
    case 'document':
      return (
        <svg {...commonProps}>
          <path {...strokeProps} d="M14 2H7a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7Z" />
          <path {...strokeProps} d="M14 2v5h5" />
          <path {...strokeProps} d="M9 13h6" />
          <path {...strokeProps} d="M9 17h4" />
        </svg>
      )
    case 'analysis':
      return (
        <svg {...commonProps}>
          <circle {...strokeProps} cx="11" cy="11" r="7" />
          <path {...strokeProps} d="M20 20l-3.5-3.5" />
          <path {...strokeProps} d="M8.5 11.5l1.6 1.6 3.4-4" />
        </svg>
      )
    case 'checklist':
      return (
        <svg {...commonProps}>
          <path {...strokeProps} d="M9 6h11" />
          <path {...strokeProps} d="M9 12h11" />
          <path {...strokeProps} d="M9 18h11" />
          <path {...strokeProps} d="m3 6 1 1 2-2" />
          <path {...strokeProps} d="m3 12 1 1 2-2" />
          <path {...strokeProps} d="m3 18 1 1 2-2" />
        </svg>
      )
  }
}

type DashboardMetrics = {
  candidatosAtivos: number
  vagasAbertas: number
  candidatosNovos: number
  candidatosEmAnalise: number
  agendaHoje: number
  contratosEmExperiencia: number
  avaliacoesVencendo: number
  documentosPendentes: number
  onboardingsAtivos: number
}

type ApplicationRow = {
  id: string
  candidato_id: string
  vaga_id: string
  etapa: string
  status: string
  created_at?: string
  updated_at: string
}

type AgendaRow = {
  id: string
  candidatura_id: string
  inicio: string
  status: string
  modalidade: string
  tipo: string
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

type ContractRow = {
  id: string
  candidato_id: string
  vaga_id: string
  status: string
  data_admissao?: string | null
  cargo?: string | null
  setor?: string | null
  experiencia_status?: string | null
  adaptacao_14_data?: string | null
  adaptacao_14_status?: string | null
  experiencia_44_data?: string | null
  experiencia_44_status?: string | null
  avaliacao_anual_data?: string | null
  avaliacao_anual_status?: string | null
  updated_at?: string
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

type UpcomingAgenda = {
  id: string
  candidateName: string
  vacancyName: string
  vacancyNumber: number
  startAt: string
  status: string
  modality: string
  type: string
}

type PendingItem = {
  id: string
  title: string
  description: string
  meta: string
  tone: 'danger' | 'warning' | 'info' | 'success'
  actionLabel: string
  page: DashboardPage
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

const agendaStatusLabels: Record<string, string> = {
  agendada: 'Agendada',
  confirmada: 'Confirmada',
  realizada: 'Realizada',
  cancelada: 'Cancelada',
  nao_compareceu: 'Não compareceu',
}

const agendaTypeLabels: Record<string, string> = {
  rh: 'Entrevista RH',
  gestor: 'Entrevista com gestor',
  tecnica: 'Entrevista técnica',
  pratica: 'Teste prático',
  admissional: 'Exame admissional',
  outro: 'Outro',
}

const completedEvaluationStatuses = [
  'aprovado',
  'reprovado',
  'acompanhamento',
]

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value))
}

function formatAgendaDate(value: string) {
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

function formatDateOnly(value: string | null | undefined) {
  if (!value) return 'Sem data'

  return new Intl.DateTimeFormat('pt-BR').format(
    new Date(`${value}T12:00:00`),
  )
}

function startOfToday() {
  const date = new Date()
  date.setHours(0, 0, 0, 0)
  return date
}

function addDays(date: Date, days: number) {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

function dateOnlyToDate(value: string | null | undefined) {
  if (!value) return null

  const date = new Date(`${value}T12:00:00`)

  if (Number.isNaN(date.getTime())) {
    return null
  }

  return date
}

function daysUntil(value: string | null | undefined) {
  const date = dateOnlyToDate(value)
  if (!date) return null

  const today = startOfToday()
  date.setHours(0, 0, 0, 0)

  return Math.ceil(
    (date.getTime() - today.getTime()) / (24 * 60 * 60 * 1000),
  )
}

function dueText(value: string | null | undefined) {
  const diff = daysUntil(value)

  if (diff === null) return 'Sem data definida'
  if (diff < 0) return `Vencida há ${Math.abs(diff)} dia(s)`
  if (diff === 0) return 'Vence hoje'
  if (diff === 1) return 'Vence amanhã'
  return `Vence em ${diff} dias`
}

function dueTone(value: string | null | undefined): PendingItem['tone'] {
  const diff = daysUntil(value)

  if (diff === null) return 'info'
  if (diff < 0) return 'danger'
  if (diff <= 1) return 'warning'
  if (diff <= 3) return 'info'
  return 'success'
}

function isEvaluationOpen(status: string | null | undefined) {
  return !completedEvaluationStatuses.includes(status ?? 'aguardando')
}

function nextEvaluation(contract: ContractRow) {
  const steps = [
    {
      label: 'Avaliação de adaptação - 14 dias',
      date: contract.adaptacao_14_data,
      status: contract.adaptacao_14_status,
    },
    {
      label: 'Avaliação de experiência - 44 dias',
      date: contract.experiencia_44_data,
      status: contract.experiencia_44_status,
    },
    {
      label: 'Avaliação anual - 1 ano',
      date: contract.avaliacao_anual_data,
      status: contract.avaliacao_anual_status,
    },
  ]

  return steps.find((step) => isEvaluationOpen(step.status)) ?? null
}

function isExperienceActive(contract: ContractRow) {
  const status = contract.experiencia_status ?? ''

  if (['adaptacao_14', 'experiencia_44'].includes(status)) {
    return true
  }

  const next = nextEvaluation(contract)
  const diff = daysUntil(next?.date)

  return next?.label !== 'Avaliação anual - 1 ano' &&
    diff !== null &&
    diff >= -90
}

function vacancyCode(value: number) {
  return `VAG-${String(value).padStart(6, '0')}`
}

function candidateCode(value: number) {
  return `CAN-${String(value).padStart(6, '0')}`
}

function DashboardHome({
  userName,
  onNavigate,
}: DashboardHomeProps) {
  const [metrics, setMetrics] = useState<DashboardMetrics>({
    candidatosAtivos: 0,
    vagasAbertas: 0,
    candidatosNovos: 0,
    candidatosEmAnalise: 0,
    agendaHoje: 0,
    contratosEmExperiencia: 0,
    avaliacoesVencendo: 0,
    documentosPendentes: 0,
    onboardingsAtivos: 0,
  })
  const [recentProcesses, setRecentProcesses] = useState<
    RecentProcess[]
  >([])
  const [agendaHoje, setAgendaHoje] = useState<UpcomingAgenda[]>([])
  const [upcomingAgenda, setUpcomingAgenda] = useState<UpcomingAgenda[]>([])
  const [pendingItems, setPendingItems] = useState<PendingItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const currentDate = useMemo(() => new Date(), [])

  const loadDashboard = useCallback(async () => {
    setLoading(true)
    setError('')

    const now = new Date().toISOString()
    const todayStart = startOfToday()
    const todayEnd = addDays(todayStart, 1)

    const [
      candidateCountResult,
      vacancyCountResult,
      newApplicationsCountResult,
      analysisApplicationsCountResult,
      todayAgendaResult,
      onboardingCountResult,
      documentCountResult,
      recentApplicationsResult,
      pendingApplicationsResult,
      upcomingAgendaResult,
      contractsResult,
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
        .from('candidaturas')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'ativo')
        .eq('etapa', 'recebido'),

      supabase
        .from('candidaturas')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'ativo')
        .eq('etapa', 'em_analise'),

      supabase
        .from('entrevistas')
        .select(
          'id, candidatura_id, inicio, status, modalidade, tipo',
          { count: 'exact' },
        )
        .gte('inicio', todayStart.toISOString())
        .lt('inicio', todayEnd.toISOString())
        .in('status', ['agendada', 'confirmada'])
        .order('inicio', { ascending: true }),

      supabase
        .from('onboardings')
        .select('*', { count: 'exact', head: true })
        .in('status', [
          'nao_iniciado',
          'em_andamento',
          'bloqueado',
        ]),

      supabase
        .from('solicitacoes_documentos')
        .select('*', { count: 'exact', head: true })
        .in('status', ['pendente', 'em_envio']),

      supabase
        .from('candidaturas')
        .select(
          'id, candidato_id, vaga_id, etapa, status, created_at, updated_at',
        )
        .order('updated_at', { ascending: false })
        .limit(6),

      supabase
        .from('candidaturas')
        .select(
          'id, candidato_id, vaga_id, etapa, status, created_at, updated_at',
        )
        .eq('status', 'ativo')
        .eq('etapa', 'recebido')
        .order('created_at', { ascending: false })
        .limit(6),

      supabase
        .from('entrevistas')
        .select(
          'id, candidatura_id, inicio, status, modalidade, tipo',
        )
        .gte('inicio', now)
        .in('status', ['agendada', 'confirmada'])
        .order('inicio', { ascending: true })
        .limit(6),

      supabase
        .from('contratos')
        .select('*')
        .eq('status', 'ativo')
        .limit(300),
    ])

    const resultsWithError = [
      candidateCountResult,
      vacancyCountResult,
      newApplicationsCountResult,
      analysisApplicationsCountResult,
      todayAgendaResult,
      onboardingCountResult,
      documentCountResult,
      recentApplicationsResult,
      pendingApplicationsResult,
      upcomingAgendaResult,
      contractsResult,
    ].filter((result) => result.error)

    if (resultsWithError.length > 0) {
      console.error(
        'Erro ao carregar parte do dashboard:',
        resultsWithError.map((result) => result.error?.message).join(' | '),
      )
      setError(
        'Alguns indicadores não puderam ser carregados. Os demais dados foram exibidos normalmente.',
      )
    }

    const recentApplications =
      (recentApplicationsResult.data ?? []) as ApplicationRow[]

    const pendingApplications =
      (pendingApplicationsResult.data ?? []) as ApplicationRow[]

    const todayAgendaRows =
      (todayAgendaResult.data ?? []) as AgendaRow[]

    const upcomingAgendaRows =
      (upcomingAgendaResult.data ?? []) as AgendaRow[]

    const contractRows =
      (contractsResult.data ?? []) as ContractRow[]

    const agendaApplicationIds = Array.from(
      new Set(
        [...todayAgendaRows, ...upcomingAgendaRows].map(
          (item) => item.candidatura_id,
        ),
      ),
    )

    let agendaApplications: ApplicationRow[] = []

    if (agendaApplicationIds.length > 0) {
      const { data, error: applicationError } = await supabase
        .from('candidaturas')
        .select(
          'id, candidato_id, vaga_id, etapa, status, created_at, updated_at',
        )
        .in('id', agendaApplicationIds)

      if (applicationError) {
        console.error(
          'Erro ao carregar candidaturas da agenda:',
          applicationError.message,
        )
        setError(
          'Os indicadores foram carregados, mas alguns detalhes não puderam ser exibidos.',
        )
      } else {
        agendaApplications = (data ?? []) as ApplicationRow[]
      }
    }

    const allApplications = [
      ...recentApplications,
      ...pendingApplications,
      ...agendaApplications,
    ]

    const candidateIds = Array.from(
      new Set([
        ...allApplications.map((item) => item.candidato_id),
        ...contractRows.map((item) => item.candidato_id),
      ].filter(Boolean)),
    )

    const vacancyIds = Array.from(
      new Set([
        ...allApplications.map((item) => item.vaga_id),
        ...contractRows.map((item) => item.vaga_id),
      ].filter(Boolean)),
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
      agendaApplications.map((item) => [item.id, item]),
    )

    const evaluationPendingItems: PendingItem[] = contractRows
      .map((contract): PendingItem | null => {
        const evaluation = nextEvaluation(contract)
        const diff = daysUntil(evaluation?.date)

        if (!evaluation || diff === null || diff > 3) {
          return null
        }

        const candidate = candidateMap.get(contract.candidato_id)
        const vacancy = vacancyMap.get(contract.vaga_id)

        return {
          id: `contract-${contract.id}`,
          title: evaluation.label,
          description: `${candidate?.nome_completo ?? 'Colaborador'}${
            vacancy ? ` — ${vacancy.cargo}` : ''
          }`,
          meta: `${dueText(evaluation.date)} · ${formatDateOnly(
            evaluation.date,
          )}`,
          tone: dueTone(evaluation.date),
          actionLabel: 'Abrir contratos',
          page: 'contratos' as const,
        } satisfies PendingItem
      })
      .filter((item): item is PendingItem => item !== null)
      .sort((first, second) => {
        const getDays = (item: PendingItem) => {
          const match = item.meta.match(/(\d{2}\/\d{2}\/\d{4})/)
          if (!match) return 99
          const [day, month, year] = match[1].split('/').map(Number)
          return Math.ceil(
            (new Date(year, month - 1, day).getTime() -
              startOfToday().getTime()) /
              (24 * 60 * 60 * 1000),
          )
        }
        return getDays(first) - getDays(second)
      })

    const pendingApplicationItems = pendingApplications
      .map((application) => {
        const candidate = candidateMap.get(application.candidato_id)
        const vacancy = vacancyMap.get(application.vaga_id)

        return {
          id: `application-${application.id}`,
          title: 'Candidato novo sem análise',
          description: `${candidate?.nome_completo ?? 'Candidato'}${
            vacancy ? ` — ${vacancyCode(vacancy.numero)} ${vacancy.cargo}` : ''
          }`,
          meta: application.created_at
            ? `Inscrito em ${formatDateTime(application.created_at)}`
            : 'Aguardando triagem do RH',
          tone: 'warning' as const,
          actionLabel: 'Abrir vagas',
          page: 'vagas' as const,
        } satisfies PendingItem
      })

    const todayAgendaItems = todayAgendaRows.slice(0, 4).map((agenda) => {
      const application = applicationMap.get(agenda.candidatura_id)
      const candidate = application
        ? candidateMap.get(application.candidato_id)
        : null
      const vacancy = application
        ? vacancyMap.get(application.vaga_id)
        : null

      return {
        id: `agenda-${agenda.id}`,
        title: agendaTypeLabels[agenda.tipo] ?? 'Agenda do RH',
        description: `${candidate?.nome_completo ?? 'Candidato'}${
          vacancy ? ` — ${vacancy.cargo}` : ''
        }`,
        meta: formatAgendaDate(agenda.inicio),
        tone: agenda.tipo === 'admissional' ? 'info' : 'success',
        actionLabel: 'Abrir agenda',
        page: 'agenda' as const,
      } satisfies PendingItem
    })

    const documentPendingCount = documentCountResult.count ?? 0
    const documentPendingItems: PendingItem[] =
      documentPendingCount > 0
        ? [
            {
              id: 'documents-pending',
              title: 'Documentos admissionais pendentes',
              description:
                documentPendingCount === 1
                  ? 'Existe 1 solicitação aguardando envio ou conferência.'
                  : `Existem ${documentPendingCount} solicitações aguardando envio ou conferência.`,
              meta: 'Acompanhar documentação dos contratados',
              tone: 'warning',
              actionLabel: 'Abrir pipeline',
              page: 'pipeline',
            },
          ]
        : []

    const contractsInExperience = contractRows.filter(isExperienceActive)
    const evaluationsDue = evaluationPendingItems.length

    setMetrics({
      candidatosAtivos: candidateCountResult.count ?? 0,
      vagasAbertas: vacancyCountResult.count ?? 0,
      candidatosNovos: newApplicationsCountResult.count ?? 0,
      candidatosEmAnalise: analysisApplicationsCountResult.count ?? 0,
      agendaHoje: todayAgendaResult.count ?? todayAgendaRows.length,
      contratosEmExperiencia: contractsInExperience.length,
      avaliacoesVencendo: evaluationsDue,
      documentosPendentes: documentPendingCount,
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

    const mapAgenda = (rows: AgendaRow[]) =>
      rows
        .map((agenda) => {
          const application = applicationMap.get(
            agenda.candidatura_id,
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
            id: agenda.id,
            candidateName: candidate.nome_completo,
            vacancyName: vacancy.cargo,
            vacancyNumber: vacancy.numero,
            startAt: agenda.inicio,
            status: agenda.status,
            modality: agenda.modalidade,
            type: agenda.tipo,
          } satisfies UpcomingAgenda
        })
        .filter(
          (item): item is UpcomingAgenda => item !== null,
        )

    setAgendaHoje(mapAgenda(todayAgendaRows))
    setUpcomingAgenda(mapAgenda(upcomingAgendaRows))

    setPendingItems([
      ...evaluationPendingItems,
      ...pendingApplicationItems,
      ...documentPendingItems,
      ...todayAgendaItems,
    ].slice(0, 10))

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

  const totalPendencias = pendingItems.length

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
          <span>Visão geral do RH</span>
          <h2>Olá, {userName}</h2>
          <p>
            Acompanhe pendências, avaliações, agenda e processos que
            precisam de atenção do RH.
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

      <section className="dashboard-home-priority-strip">
        <button
          type="button"
          className="dashboard-home-priority danger"
          onClick={() => onNavigate('contratos')}
        >
          <div><DashboardIcon type="alert" /></div>
          <span>Avaliações vencendo</span>
          <strong>{metrics.avaliacoesVencendo}</strong>
          <small>Vencidas ou até 3 dias</small>
        </button>

        <button
          type="button"
          className="dashboard-home-priority warning"
          onClick={() => onNavigate('vagas')}
        >
          <div><DashboardIcon type="analysis" /></div>
          <span>Novos sem análise</span>
          <strong>{metrics.candidatosNovos}</strong>
          <small>Aguardando triagem</small>
        </button>

        <button
          type="button"
          className="dashboard-home-priority info"
          onClick={() => onNavigate('agenda')}
        >
          <div><DashboardIcon type="calendar" /></div>
          <span>Agenda de hoje</span>
          <strong>{metrics.agendaHoje}</strong>
          <small>Entrevistas, testes e exames</small>
        </button>
      </section>

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
          onClick={() => onNavigate('vagas')}
        >
          <div className="dashboard-home-metric-top">
            <span>Candidatos novos</span>
            <div><DashboardIcon type="analysis" /></div>
          </div>
          <strong>{metrics.candidatosNovos}</strong>
          <small>Recebidos e aguardando triagem</small>
        </button>

        <button
          className="dashboard-home-metric"
          type="button"
          onClick={() => onNavigate('pipeline')}
        >
          <div className="dashboard-home-metric-top">
            <span>Em análise</span>
            <div><DashboardIcon type="movement" /></div>
          </div>
          <strong>{metrics.candidatosEmAnalise}</strong>
          <small>Candidatos em avaliação pelo RH</small>
        </button>

        <button
          className="dashboard-home-metric"
          type="button"
          onClick={() => onNavigate('contratos')}
        >
          <div className="dashboard-home-metric-top">
            <span>Em experiência</span>
            <div><DashboardIcon type="contract" /></div>
          </div>
          <strong>{metrics.contratosEmExperiencia}</strong>
          <small>Contratos em adaptação ou experiência</small>
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
          <small>Integrações em andamento ou bloqueadas</small>
        </button>

        <button
          className="dashboard-home-metric"
          type="button"
          onClick={() => onNavigate('pipeline')}
        >
          <div className="dashboard-home-metric-top">
            <span>Documentos pendentes</span>
            <div><DashboardIcon type="document" /></div>
          </div>
          <strong>{metrics.documentosPendentes}</strong>
          <small>Solicitações em aberto</small>
        </button>
      </section>

      <section className="dashboard-home-grid dashboard-home-grid-focus">
        <article className="dashboard-home-panel dashboard-home-pending-panel">
          <header>
            <div>
              <h3>Pendências do RH</h3>
              <p>
                Itens que precisam de acompanhamento ou decisão.
              </p>
            </div>

            <span className="dashboard-home-panel-count">
              {totalPendencias}
            </span>
          </header>

          <div className="dashboard-home-pending-list">
            {pendingItems.map((item) => (
              <div
                className={`dashboard-home-pending-item tone-${item.tone}`}
                key={item.id}
              >
                <div className="dashboard-home-pending-icon">
                  <DashboardIcon
                    type={item.tone === 'danger' ? 'alert' : 'checklist'}
                  />
                </div>

                <div className="dashboard-home-pending-main">
                  <strong>{item.title}</strong>
                  <span>{item.description}</span>
                  <small>{item.meta}</small>
                </div>

                <button
                  type="button"
                  onClick={() => onNavigate(item.page)}
                >
                  {item.actionLabel}
                </button>
              </div>
            ))}

            {pendingItems.length === 0 && (
              <div className="dashboard-home-empty">
                <div><DashboardIcon type="checklist" /></div>
                <strong>Nenhuma pendência crítica</strong>
                <p>
                  Candidatos, avaliações e agenda aparecerão aqui
                  quando precisarem de atenção.
                </p>
              </div>
            )}
          </div>
        </article>

        <article className="dashboard-home-panel">
          <header>
            <div>
              <h3>Agenda de hoje</h3>
              <p>Entrevistas, testes práticos e exames.</p>
            </div>

            <button
              type="button"
              onClick={() => onNavigate('agenda')}
            >
              Abrir agenda
            </button>
          </header>

          <div className="dashboard-home-interview-list">
            {agendaHoje.map((agenda) => (
              <button
                className="dashboard-home-interview"
                type="button"
                key={agenda.id}
                onClick={() => onNavigate('agenda')}
              >
                <div className="dashboard-home-interview-date">
                  <strong>
                    {formatAgendaDate(agenda.startAt)}
                  </strong>
                  <span>
                    {agendaTypeLabels[agenda.type] ?? agenda.type}
                  </span>
                </div>

                <div className="dashboard-home-interview-main">
                  <strong>{agenda.candidateName}</strong>
                  <span>
                    {vacancyCode(agenda.vacancyNumber)} —{' '}
                    {agenda.vacancyName}
                  </span>
                </div>

                <span
                  className={`dashboard-home-interview-status status-${agenda.status}`}
                >
                  {agendaStatusLabels[agenda.status] ?? agenda.status}
                </span>
              </button>
            ))}

            {agendaHoje.length === 0 && (
              <div className="dashboard-home-empty compact">
                <div><DashboardIcon type="calendar" /></div>
                <strong>Nada agendado para hoje</strong>
                <p>
                  Entrevistas, testes e exames do dia aparecerão aqui.
                </p>
              </div>
            )}
          </div>
        </article>
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
                    {candidateCode(process.candidateNumber)} ·{' '}
                    {vacancyCode(process.vacancyNumber)} —{' '}
                    {process.vacancyName}
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
              <h3>Próximos compromissos</h3>
              <p>Agenda futura confirmada ou agendada</p>
            </div>

            <button
              type="button"
              onClick={() => onNavigate('agenda')}
            >
              Abrir agenda
            </button>
          </header>

          <div className="dashboard-home-interview-list">
            {upcomingAgenda.map((agenda) => (
              <button
                className="dashboard-home-interview"
                type="button"
                key={agenda.id}
                onClick={() => onNavigate('agenda')}
              >
                <div className="dashboard-home-interview-date">
                  <strong>
                    {formatAgendaDate(agenda.startAt)}
                  </strong>
                  <span>
                    {agendaTypeLabels[agenda.type] ?? agenda.type}
                  </span>
                </div>

                <div className="dashboard-home-interview-main">
                  <strong>{agenda.candidateName}</strong>
                  <span>
                    {vacancyCode(agenda.vacancyNumber)} —{' '}
                    {agenda.vacancyName}
                  </span>
                </div>

                <span
                  className={`dashboard-home-interview-status status-${agenda.status}`}
                >
                  {agendaStatusLabels[agenda.status] ??
                    agenda.status}
                </span>
              </button>
            ))}

            {upcomingAgenda.length === 0 && (
              <div className="dashboard-home-empty">
                <div><DashboardIcon type="calendar" /></div>
                <strong>Nenhum compromisso próximo</strong>
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
