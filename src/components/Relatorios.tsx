import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { supabase } from '../lib/supabase'
import './Relatorios.css'

type VagaStatus =
  | 'aberta'
  | 'em_selecao'
  | 'suspensa'
  | 'preenchida'

type CandidaturaEtapa =
  | 'recebido'
  | 'em_analise'
  | 'entrevista_rh'
  | 'entrevista_gestor'
  | 'teste_pratico'
  | 'exame_admissional'
  | 'documentacao'
  | 'contratado'

type CandidaturaStatus =
  | 'ativo'
  | 'reprovado'
  | 'desistente'
  | 'suspenso'
  | 'banco_talentos'
  | 'contratado'

type EntrevistaStatus =
  | 'agendada'
  | 'confirmada'
  | 'realizada'
  | 'cancelada'
  | 'nao_compareceu'

type OnboardingStatus =
  | 'nao_iniciado'
  | 'em_andamento'
  | 'concluido'
  | 'bloqueado'
  | 'cancelado'

type ContractStatus =
  | 'rascunho'
  | 'ativo'
  | 'encerrado'
  | 'cancelado'

type Candidato = {
  id: string
  numero: number
  nome_completo: string
  active: boolean
  created_at: string
}

type Vaga = {
  id: string
  numero: number
  cargo: string
  setor: string
  status: VagaStatus
  prioridade: string
  tipo_contrato: string
  modalidade: string
  created_at: string
  data_limite: string | null
}

type Candidatura = {
  id: string
  candidato_id: string
  vaga_id: string
  etapa: CandidaturaEtapa
  status: CandidaturaStatus
  data_entrada: string
  created_at: string
  updated_at: string
}

type Entrevista = {
  id: string
  candidatura_id: string
  status: EntrevistaStatus
  tipo: string
  modalidade: string
  inicio: string
  created_at: string
}

type Onboarding = {
  id: string
  candidatura_id: string
  status: OnboardingStatus
  data_prevista_inicio: string | null
  data_admissao: string | null
  created_at: string
  updated_at: string
}

type Contrato = {
  id: string
  candidatura_id: string
  candidato_id: string
  vaga_id: string
  status: ContractStatus
  data_admissao: string | null
  created_at: string
}

type BarItem = {
  key: string
  label: string
  value: number
}

type VacancyMovement = {
  id: string
  codigo: string
  cargo: string
  setor: string
  status: string
  candidatos: number
  entrevistas: number
  contratados: number
}

const statusVagaLabels: Record<VagaStatus, string> = {
  aberta: 'Aberta',
  em_selecao: 'Em seleção',
  suspensa: 'Suspensa',
  preenchida: 'Fechada',
}

const etapaLabels: Record<CandidaturaEtapa, string> = {
  recebido: 'Recebido',
  em_analise: 'Em análise',
  entrevista_rh: 'Entrevista RH',
  entrevista_gestor: 'Entrevista gestor',
  teste_pratico: 'Teste prático',
  exame_admissional: 'Exame admissional',
  documentacao: 'Documentação',
  contratado: 'Contratado',
}

const statusCandidaturaLabels: Record<CandidaturaStatus, string> = {
  ativo: 'Ativo',
  reprovado: 'Reprovado',
  desistente: 'Desistente',
  suspenso: 'Suspenso',
  banco_talentos: 'Banco de talentos',
  contratado: 'Contratado',
}

const statusEntrevistaLabels: Record<EntrevistaStatus, string> = {
  agendada: 'Agendada',
  confirmada: 'Confirmada',
  realizada: 'Realizada',
  cancelada: 'Cancelada',
  nao_compareceu: 'Não compareceu',
}

const statusOnboardingLabels: Record<OnboardingStatus, string> = {
  nao_iniciado: 'Não iniciado',
  em_andamento: 'Em andamento',
  concluido: 'Concluído',
  bloqueado: 'Bloqueado',
  cancelado: 'Cancelado',
}

const statusContratoLabels: Record<ContractStatus, string> = {
  rascunho: 'Pendente',
  ativo: 'Ativo',
  encerrado: 'Encerrado',
  cancelado: 'Cancelado',
}

function getTodayInputValue() {
  return new Date().toISOString().slice(0, 10)
}

function getMonthStartInputValue() {
  const date = new Date()
  date.setDate(1)
  return date.toISOString().slice(0, 10)
}

function parseDate(value: string | null | undefined) {
  if (!value) return null

  const normalized = value.includes('T')
    ? value
    : `${value}T00:00:00`

  const date = new Date(normalized)

  return Number.isNaN(date.getTime()) ? null : date
}

function startOfDay(value: string) {
  return new Date(`${value}T00:00:00`)
}

function endOfDay(value: string) {
  return new Date(`${value}T23:59:59.999`)
}

function formatDate(value: string | null | undefined) {
  const date = parseDate(value)

  if (!date) return '—'

  return new Intl.DateTimeFormat('pt-BR').format(date)
}

function formatPercentage(value: number) {
  return `${Math.round(value)}%`
}

function countBy<T>(items: T[], getKey: (item: T) => string) {
  const map = new Map<string, number>()

  for (const item of items) {
    const key = getKey(item)
    map.set(key, (map.get(key) ?? 0) + 1)
  }

  return map
}

function buildOrderedBars<T extends string>(
  order: T[],
  labels: Record<T, string>,
  counts: Map<string, number>,
): BarItem[] {
  return order.map((key) => ({
    key,
    label: labels[key],
    value: counts.get(key) ?? 0,
  }))
}

function escapeCsv(value: string | number) {
  const text = String(value)

  if (/[;"\n\r]/.test(text)) {
    return `"${text.replaceAll('"', '""')}"`
  }

  return text
}

function downloadCsv(
  filename: string,
  rows: Array<Array<string | number>>,
) {
  const csv = rows
    .map((row) => row.map(escapeCsv).join(';'))
    .join('\n')

  const blob = new Blob([`\ufeff${csv}`], {
    type: 'text/csv;charset=utf-8;',
  })

  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')

  link.href = url
  link.download = filename
  link.click()

  URL.revokeObjectURL(url)
}

function inPeriod(
  value: string | null | undefined,
  periodStart: Date,
  periodEnd: Date,
) {
  const date = parseDate(value)

  if (!date) return false

  return date >= periodStart && date <= periodEnd
}

function ReportBarList({ items }: { items: BarItem[] }) {
  const maxValue = Math.max(...items.map((item) => item.value), 1)

  return (
    <div className="reports-bars">
      {items.map((item) => {
        const width = Math.max((item.value / maxValue) * 100, 4)

        return (
          <div className="reports-bar-row" key={item.key}>
            <div className="reports-bar-label">
              <span>{item.label}</span>
              <strong>{item.value}</strong>
            </div>

            <div className="reports-bar-track">
              <span style={{ width: `${width}%` }} />
            </div>
          </div>
        )
      })}
    </div>
  )
}

function Relatorios() {
  const [candidatos, setCandidatos] = useState<Candidato[]>([])
  const [vagas, setVagas] = useState<Vaga[]>([])
  const [candidaturas, setCandidaturas] = useState<Candidatura[]>([])
  const [entrevistas, setEntrevistas] = useState<Entrevista[]>([])
  const [onboardings, setOnboardings] = useState<Onboarding[]>([])
  const [contratos, setContratos] = useState<Contrato[]>([])

  const [periodoInicio, setPeriodoInicio] = useState(
    getMonthStartInputValue(),
  )
  const [periodoFim, setPeriodoFim] = useState(getTodayInputValue())
  const [setorFiltro, setSetorFiltro] = useState('todos')
  const [statusVagaFiltro, setStatusVagaFiltro] = useState<
    'todos' | VagaStatus
  >('todos')

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const carregarRelatorio = useCallback(async () => {
    setLoading(true)
    setError('')

    const [
      candidatosResult,
      vagasResult,
      candidaturasResult,
      entrevistasResult,
      onboardingsResult,
      contratosResult,
    ] = await Promise.all([
      supabase
        .from('candidatos')
        .select('id, numero, nome_completo, active, created_at')
        .order('created_at', { ascending: false }),

      supabase
        .from('vagas')
        .select(
          'id, numero, cargo, setor, status, prioridade, tipo_contrato, modalidade, created_at, data_limite',
        )
        .order('created_at', { ascending: false }),

      supabase
        .from('candidaturas')
        .select(
          'id, candidato_id, vaga_id, etapa, status, data_entrada, created_at, updated_at',
        )
        .order('data_entrada', { ascending: false }),

      supabase
        .from('entrevistas')
        .select(
          'id, candidatura_id, status, tipo, modalidade, inicio, created_at',
        )
        .order('inicio', { ascending: false }),

      supabase
        .from('onboardings')
        .select(
          'id, candidatura_id, status, data_prevista_inicio, data_admissao, created_at, updated_at',
        )
        .order('created_at', { ascending: false }),

      supabase
        .from('contratos')
        .select(
          'id, candidatura_id, candidato_id, vaga_id, status, data_admissao, created_at',
        )
        .order('created_at', { ascending: false }),
    ])

    const firstError =
      candidatosResult.error ??
      vagasResult.error ??
      candidaturasResult.error ??
      entrevistasResult.error ??
      onboardingsResult.error ??
      contratosResult.error

    if (firstError) {
      console.error(
        'Erro ao carregar relatórios:',
        firstError.message,
      )

      setError(
        'Não foi possível carregar os dados do relatório.',
      )
      setLoading(false)
      return
    }

    setCandidatos((candidatosResult.data ?? []) as Candidato[])
    setVagas((vagasResult.data ?? []) as Vaga[])
    setCandidaturas(
      (candidaturasResult.data ?? []) as Candidatura[],
    )
    setEntrevistas(
      (entrevistasResult.data ?? []) as Entrevista[],
    )
    setOnboardings(
      (onboardingsResult.data ?? []) as Onboarding[],
    )
    setContratos((contratosResult.data ?? []) as Contrato[])
    setLoading(false)
  }, [])

  useEffect(() => {
    carregarRelatorio()
  }, [carregarRelatorio])

  const periodo = useMemo(
    () => ({
      inicio: startOfDay(periodoInicio),
      fim: endOfDay(periodoFim),
    }),
    [periodoFim, periodoInicio],
  )

  const vagaMap = useMemo(
    () => new Map(vagas.map((vaga) => [vaga.id, vaga])),
    [vagas],
  )

  const candidaturaMap = useMemo(
    () =>
      new Map(
        candidaturas.map((candidatura) => [
          candidatura.id,
          candidatura,
        ]),
      ),
    [candidaturas],
  )

  const setores = useMemo(
    () =>
      Array.from(new Set(vagas.map((vaga) => vaga.setor)))
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b, 'pt-BR')),
    [vagas],
  )

  const vagaPassaFiltros = useCallback(
    (vagaId: string) => {
      const vaga = vagaMap.get(vagaId)

      if (!vaga) return false

      const setorOk =
        setorFiltro === 'todos' || vaga.setor === setorFiltro

      const statusOk =
        statusVagaFiltro === 'todos' ||
        vaga.status === statusVagaFiltro

      return setorOk && statusOk
    },
    [setorFiltro, statusVagaFiltro, vagaMap],
  )

  const vagasFiltradas = useMemo(
    () =>
      vagas.filter(
        (vaga) =>
          inPeriod(vaga.created_at, periodo.inicio, periodo.fim) &&
          (setorFiltro === 'todos' || vaga.setor === setorFiltro) &&
          (statusVagaFiltro === 'todos' ||
            vaga.status === statusVagaFiltro),
      ),
    [periodo.fim, periodo.inicio, setorFiltro, statusVagaFiltro, vagas],
  )

  const candidaturasFiltradas = useMemo(
    () =>
      candidaturas.filter(
        (candidatura) =>
          inPeriod(
            candidatura.data_entrada,
            periodo.inicio,
            periodo.fim,
          ) && vagaPassaFiltros(candidatura.vaga_id),
      ),
    [candidaturas, periodo.fim, periodo.inicio, vagaPassaFiltros],
  )

  const entrevistasFiltradas = useMemo(
    () =>
      entrevistas.filter((entrevista) => {
        const candidatura = candidaturaMap.get(
          entrevista.candidatura_id,
        )

        return (
          inPeriod(entrevista.inicio, periodo.inicio, periodo.fim) &&
          Boolean(candidatura) &&
          vagaPassaFiltros(candidatura?.vaga_id ?? '')
        )
      }),
    [
      candidaturaMap,
      entrevistas,
      periodo.fim,
      periodo.inicio,
      vagaPassaFiltros,
    ],
  )

  const onboardingsFiltrados = useMemo(
    () =>
      onboardings.filter((onboarding) => {
        const candidatura = candidaturaMap.get(
          onboarding.candidatura_id,
        )

        return (
          inPeriod(onboarding.created_at, periodo.inicio, periodo.fim) &&
          Boolean(candidatura) &&
          vagaPassaFiltros(candidatura?.vaga_id ?? '')
        )
      }),
    [
      candidaturaMap,
      onboardings,
      periodo.fim,
      periodo.inicio,
      vagaPassaFiltros,
    ],
  )

  const contratosFiltrados = useMemo(
    () =>
      contratos.filter(
        (contrato) =>
          inPeriod(
            contrato.data_admissao ?? contrato.created_at,
            periodo.inicio,
            periodo.fim,
          ) && vagaPassaFiltros(contrato.vaga_id),
      ),
    [contratos, periodo.fim, periodo.inicio, vagaPassaFiltros],
  )

  const candidatosFiltrados = useMemo(() => {
    const temFiltroDeVaga =
      setorFiltro !== 'todos' || statusVagaFiltro !== 'todos'

    if (!temFiltroDeVaga) {
      return candidatos.filter((candidato) =>
        inPeriod(
          candidato.created_at,
          periodo.inicio,
          periodo.fim,
        ),
      )
    }

    const candidateIds = new Set(
      candidaturasFiltradas.map(
        (candidatura) => candidatura.candidato_id,
      ),
    )

    return candidatos.filter((candidato) =>
      candidateIds.has(candidato.id),
    )
  }, [
    candidatos,
    candidaturasFiltradas,
    periodo.fim,
    periodo.inicio,
    setorFiltro,
    statusVagaFiltro,
  ])

  const indicadores = useMemo(() => {
    const candidaturasAtivas = candidaturasFiltradas.filter(
      (item) => item.status === 'ativo',
    ).length

    const candidatosContratados = candidaturasFiltradas.filter(
      (item) =>
        item.status === 'contratado' || item.etapa === 'contratado',
    ).length

    const entrevistasRealizadas = entrevistasFiltradas.filter(
      (item) => item.status === 'realizada',
    ).length

    const onboardingsConcluidos = onboardingsFiltrados.filter(
      (item) => item.status === 'concluido',
    ).length

    const contratosAtivos = contratosFiltrados.filter(
      (item) => item.status === 'ativo',
    ).length

    const taxaContratacao = candidaturasFiltradas.length
      ? (candidatosContratados / candidaturasFiltradas.length) * 100
      : 0

    return {
      candidatos: candidatosFiltrados.length,
      vagas: vagasFiltradas.length,
      candidaturas: candidaturasFiltradas.length,
      candidaturasAtivas,
      entrevistas: entrevistasFiltradas.length,
      entrevistasRealizadas,
      onboardings: onboardingsFiltrados.length,
      onboardingsConcluidos,
      contratosAtivos,
      taxaContratacao,
    }
  }, [
    candidatosFiltrados.length,
    candidaturasFiltradas,
    contratosFiltrados,
    entrevistasFiltradas,
    onboardingsFiltrados,
    vagasFiltradas.length,
  ])

  const vagasPorStatus = useMemo(
    () =>
      buildOrderedBars(
        ['aberta', 'em_selecao', 'suspensa', 'preenchida'],
        statusVagaLabels,
        countBy(vagasFiltradas, (vaga) => vaga.status),
      ),
    [vagasFiltradas],
  )

  const candidaturasPorEtapa = useMemo(
    () =>
      buildOrderedBars(
        [
          'recebido',
          'em_analise',
          'entrevista_rh',
          'entrevista_gestor',
          'teste_pratico',
          'exame_admissional',
          'documentacao',
          'contratado',
        ],
        etapaLabels,
        countBy(candidaturasFiltradas, (item) => item.etapa),
      ),
    [candidaturasFiltradas],
  )

  const candidaturasPorStatus = useMemo(
    () =>
      buildOrderedBars(
        [
          'ativo',
          'reprovado',
          'desistente',
          'suspenso',
          'banco_talentos',
          'contratado',
        ],
        statusCandidaturaLabels,
        countBy(candidaturasFiltradas, (item) => item.status),
      ),
    [candidaturasFiltradas],
  )

  const entrevistasPorStatus = useMemo(
    () =>
      buildOrderedBars(
        [
          'agendada',
          'confirmada',
          'realizada',
          'cancelada',
          'nao_compareceu',
        ],
        statusEntrevistaLabels,
        countBy(entrevistasFiltradas, (item) => item.status),
      ),
    [entrevistasFiltradas],
  )

  const onboardingsPorStatus = useMemo(
    () =>
      buildOrderedBars(
        [
          'nao_iniciado',
          'em_andamento',
          'concluido',
          'bloqueado',
          'cancelado',
        ],
        statusOnboardingLabels,
        countBy(onboardingsFiltrados, (item) => item.status),
      ),
    [onboardingsFiltrados],
  )

  const contratosPorStatus = useMemo(
    () =>
      buildOrderedBars(
        ['rascunho', 'ativo', 'encerrado', 'cancelado'],
        statusContratoLabels,
        countBy(contratosFiltrados, (item) => item.status),
      ),
    [contratosFiltrados],
  )

  const movimentacaoVagas = useMemo<VacancyMovement[]>(() => {
    const entrevistasPorVaga = new Map<string, number>()

    for (const entrevista of entrevistasFiltradas) {
      const candidatura = candidaturaMap.get(
        entrevista.candidatura_id,
      )

      if (!candidatura) continue

      entrevistasPorVaga.set(
        candidatura.vaga_id,
        (entrevistasPorVaga.get(candidatura.vaga_id) ?? 0) + 1,
      )
    }

    const candidaturasPorVaga = new Map<string, Candidatura[]>()

    for (const candidatura of candidaturasFiltradas) {
      const current =
        candidaturasPorVaga.get(candidatura.vaga_id) ?? []

      current.push(candidatura)
      candidaturasPorVaga.set(candidatura.vaga_id, current)
    }

    return Array.from(candidaturasPorVaga.entries())
      .map(([vagaId, rows]) => {
        const vaga = vagaMap.get(vagaId)

        if (!vaga) return null

        const contratados = rows.filter(
          (row) =>
            row.status === 'contratado' ||
            row.etapa === 'contratado',
        ).length

        return {
          id: vaga.id,
          codigo: `VAG-${String(vaga.numero).padStart(6, '0')}`,
          cargo: vaga.cargo,
          setor: vaga.setor,
          status: statusVagaLabels[vaga.status],
          candidatos: rows.length,
          entrevistas: entrevistasPorVaga.get(vaga.id) ?? 0,
          contratados,
        }
      })
      .filter((item): item is VacancyMovement => Boolean(item))
      .sort((a, b) => b.candidatos - a.candidatos)
      .slice(0, 10)
  }, [
    candidaturaMap,
    candidaturasFiltradas,
    entrevistasFiltradas,
    vagaMap,
  ])

  function exportarRelatorio() {
    const rows: Array<Array<string | number>> = [
      ['Relatório de recrutamento'],
      [
        'Período',
        `${formatDate(periodoInicio)} até ${formatDate(periodoFim)}`,
      ],
      ['Setor', setorFiltro === 'todos' ? 'Todos' : setorFiltro],
      [
        'Status da vaga',
        statusVagaFiltro === 'todos'
          ? 'Todos'
          : statusVagaLabels[statusVagaFiltro],
      ],
      [],
      ['Indicador', 'Total'],
      ['Candidatos', indicadores.candidatos],
      ['Vagas', indicadores.vagas],
      ['Candidaturas', indicadores.candidaturas],
      ['Candidaturas ativas', indicadores.candidaturasAtivas],
      ['Entrevistas', indicadores.entrevistas],
      ['Entrevistas realizadas', indicadores.entrevistasRealizadas],
      ['Onboardings', indicadores.onboardings],
      ['Onboardings concluídos', indicadores.onboardingsConcluidos],
      ['Contratos ativos', indicadores.contratosAtivos],
      ['Taxa de contratação', formatPercentage(indicadores.taxaContratacao)],
      [],
      ['Vagas por status', 'Total'],
      ...vagasPorStatus.map((item) => [item.label, item.value]),
      [],
      ['Candidaturas por etapa', 'Total'],
      ...candidaturasPorEtapa.map((item) => [item.label, item.value]),
      [],
      ['Entrevistas por status', 'Total'],
      ...entrevistasPorStatus.map((item) => [item.label, item.value]),
      [],
      ['Vagas com maior movimento'],
      [
        'Código',
        'Cargo',
        'Setor',
        'Status',
        'Candidatos',
        'Entrevistas',
        'Contratados',
      ],
      ...movimentacaoVagas.map((item) => [
        item.codigo,
        item.cargo,
        item.setor,
        item.status,
        item.candidatos,
        item.entrevistas,
        item.contratados,
      ]),
    ]

    downloadCsv(`relatorio-rh-${getTodayInputValue()}.csv`, rows)
  }

  if (loading) {
    return (
      <section className="reports-panel reports-state">
        <div className="reports-state-icon">RL</div>
        <p>Carregando relatórios...</p>
      </section>
    )
  }

  return (
    <section className="reports-panel">
      <header className="reports-header">
        <div>
          <span className="reports-eyebrow">Indicadores</span>
          <h2>Relatórios de recrutamento</h2>
          <p>
            Acompanhe vagas, candidatos, entrevistas, onboarding e
            contratações por período.
          </p>
        </div>

        <div className="reports-header-actions">
          <button
            className="reports-secondary-button"
            type="button"
            onClick={carregarRelatorio}
          >
            Atualizar
          </button>

          <button
            className="reports-primary-button"
            type="button"
            onClick={exportarRelatorio}
          >
            Exportar Excel
          </button>
        </div>
      </header>

      <div className="reports-toolbar">
        <div className="reports-filter">
          <label htmlFor="relatorio-inicio">Data inicial</label>
          <input
            id="relatorio-inicio"
            type="date"
            value={periodoInicio}
            onChange={(event) =>
              setPeriodoInicio(event.target.value)
            }
          />
        </div>

        <div className="reports-filter">
          <label htmlFor="relatorio-fim">Data final</label>
          <input
            id="relatorio-fim"
            type="date"
            value={periodoFim}
            min={periodoInicio}
            onChange={(event) =>
              setPeriodoFim(event.target.value)
            }
          />
        </div>

        <div className="reports-filter">
          <label htmlFor="relatorio-setor">Setor</label>
          <select
            id="relatorio-setor"
            value={setorFiltro}
            onChange={(event) =>
              setSetorFiltro(event.target.value)
            }
          >
            <option value="todos">Todos</option>

            {setores.map((setor) => (
              <option key={setor} value={setor}>
                {setor}
              </option>
            ))}
          </select>
        </div>

        <div className="reports-filter">
          <label htmlFor="relatorio-status-vaga">
            Status da vaga
          </label>
          <select
            id="relatorio-status-vaga"
            value={statusVagaFiltro}
            onChange={(event) =>
              setStatusVagaFiltro(
                event.target.value as 'todos' | VagaStatus,
              )
            }
          >
            <option value="todos">Todos</option>

            {Object.entries(statusVagaLabels).map(
              ([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ),
            )}
          </select>
        </div>
      </div>

      {error && (
        <div className="reports-message error">{error}</div>
      )}

      <div className="reports-kpis">
        <article className="reports-kpi-card">
          <span>Candidatos</span>
          <strong>{indicadores.candidatos}</strong>
          <small>No período selecionado</small>
        </article>

        <article className="reports-kpi-card">
          <span>Vagas</span>
          <strong>{indicadores.vagas}</strong>
          <small>Criadas no período</small>
        </article>

        <article className="reports-kpi-card">
          <span>Candidaturas</span>
          <strong>{indicadores.candidaturas}</strong>
          <small>{indicadores.candidaturasAtivas} ativas</small>
        </article>

        <article className="reports-kpi-card">
          <span>Entrevistas</span>
          <strong>{indicadores.entrevistas}</strong>
          <small>{indicadores.entrevistasRealizadas} realizadas</small>
        </article>

        <article className="reports-kpi-card">
          <span>Onboardings</span>
          <strong>{indicadores.onboardings}</strong>
          <small>{indicadores.onboardingsConcluidos} concluídos</small>
        </article>

        <article className="reports-kpi-card highlight">
          <span>Taxa de contratação</span>
          <strong>
            {formatPercentage(indicadores.taxaContratacao)}
          </strong>
          <small>{indicadores.contratosAtivos} contratos ativos</small>
        </article>
      </div>

      <div className="reports-grid">
        <article className="reports-card">
          <div className="reports-card-header">
            <div>
              <span>Vagas</span>
              <h3>Por status</h3>
            </div>
          </div>

          <ReportBarList items={vagasPorStatus} />
        </article>

        <article className="reports-card">
          <div className="reports-card-header">
            <div>
              <span>Pipeline</span>
              <h3>Candidaturas por etapa</h3>
            </div>
          </div>

          <ReportBarList items={candidaturasPorEtapa} />
        </article>

        <article className="reports-card">
          <div className="reports-card-header">
            <div>
              <span>Candidaturas</span>
              <h3>Por status</h3>
            </div>
          </div>

          <ReportBarList items={candidaturasPorStatus} />
        </article>

        <article className="reports-card">
          <div className="reports-card-header">
            <div>
              <span>Agenda</span>
              <h3>Entrevistas por status</h3>
            </div>
          </div>

          <ReportBarList items={entrevistasPorStatus} />
        </article>

        <article className="reports-card">
          <div className="reports-card-header">
            <div>
              <span>Admissão</span>
              <h3>Onboarding por status</h3>
            </div>
          </div>

          <ReportBarList items={onboardingsPorStatus} />
        </article>

        <article className="reports-card">
          <div className="reports-card-header">
            <div>
              <span>Contratos</span>
              <h3>Por status</h3>
            </div>
          </div>

          <ReportBarList items={contratosPorStatus} />
        </article>
      </div>

      <article className="reports-table-card">
        <div className="reports-card-header">
          <div>
            <span>Movimentação</span>
            <h3>Vagas com maior volume no período</h3>
          </div>
        </div>

        <div className="reports-table-wrapper">
          <table className="reports-table">
            <thead>
              <tr>
                <th>Código</th>
                <th>Cargo</th>
                <th>Setor</th>
                <th>Status</th>
                <th>Candidatos</th>
                <th>Entrevistas</th>
                <th>Contratados</th>
              </tr>
            </thead>

            <tbody>
              {movimentacaoVagas.length > 0 ? (
                movimentacaoVagas.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <strong className="reports-code">
                        {item.codigo}
                      </strong>
                    </td>
                    <td>{item.cargo}</td>
                    <td>{item.setor}</td>
                    <td>{item.status}</td>
                    <td>{item.candidatos}</td>
                    <td>{item.entrevistas}</td>
                    <td>{item.contratados}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7}>
                    <div className="reports-empty">
                      Nenhuma movimentação encontrada para os filtros
                      selecionados.
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </article>
    </section>
  )
}

export default Relatorios