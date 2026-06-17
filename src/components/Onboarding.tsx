import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from 'react'
import { supabase } from '../lib/supabase'
import DocumentacaoAdmissional from './DocumentacaoAdmissional'
import './Onboarding.css'

type OnboardingStatus =
  | 'nao_iniciado'
  | 'em_andamento'
  | 'bloqueado'
  | 'concluido'
  | 'cancelado'

type TaskCategory =
  | 'documentacao'
  | 'exame'
  | 'integracao'
  | 'beneficios'
  | 'outro'

type TaskStatus =
  | 'pendente'
  | 'em_andamento'
  | 'concluida'
  | 'nao_aplicavel'
  | 'bloqueada'

type TaskViewFilter =
  | 'todas'
  | 'pendentes'
  | 'atrasadas'
  | 'concluidas'

type OnboardingRecord = {
  id: string
  candidatura_id: string
  responsavel_id: string | null
  data_prevista_inicio: string
  data_admissao: string | null
  status: OnboardingStatus
  observacoes: string | null
  created_at: string
  updated_at: string
}

type OnboardingTask = {
  id: string
  onboarding_id: string
  titulo: string
  categoria: TaskCategory
  status: TaskStatus
  responsavel_id: string | null
  obrigatoria: boolean
  prazo: string | null
  ordem: number
  observacoes: string | null
  concluida_por: string | null
  concluida_em: string | null
  created_at: string
  updated_at: string
}

type Candidatura = {
  id: string
  candidato_id: string
  vaga_id: string
  etapa: string
  status: string
}

type Candidato = {
  id: string
  numero: number
  nome_completo: string
  email: string | null
  telefone: string | null
  whatsapp: string | null
}

type Vaga = {
  id: string
  numero: number
  cargo: string
  setor: string
}

type Perfil = {
  id: string
  full_name: string
  active: boolean
  role: 'rh'
}

type OnboardingView = {
  onboarding: OnboardingRecord
  candidatura: Candidatura
  candidato: Candidato
  vaga: Vaga
  responsavel: Perfil | null
  tasks: OnboardingTask[]
}

type OnboardingForm = {
  candidatura_id: string
  responsavel_id: string
  data_prevista_inicio: string
  data_admissao: string
  status: OnboardingStatus
  observacoes: string
}

type TaskForm = {
  titulo: string
  categoria: TaskCategory
  responsavel_id: string
  obrigatoria: boolean
  prazo: string
  observacoes: string
}

const initialOnboardingForm: OnboardingForm = {
  candidatura_id: '',
  responsavel_id: '',
  data_prevista_inicio: '',
  data_admissao: '',
  status: 'nao_iniciado',
  observacoes: '',
}

const initialTaskForm: TaskForm = {
  titulo: '',
  categoria: 'outro',
  responsavel_id: '',
  obrigatoria: true,
  prazo: '',
  observacoes: '',
}

const onboardingStatusLabels: Record<OnboardingStatus, string> = {
  nao_iniciado: 'Não iniciado',
  em_andamento: 'Em andamento',
  bloqueado: 'Bloqueado',
  concluido: 'Concluído',
  cancelado: 'Cancelado',
}

const taskStatusLabels: Record<TaskStatus, string> = {
  pendente: 'Pendente',
  em_andamento: 'Em andamento',
  concluida: 'Concluída',
  nao_aplicavel: 'Não aplicável',
  bloqueada: 'Bloqueada',
}

const categoryLabels: Record<TaskCategory, string> = {
  documentacao: 'Documentação',
  exame: 'Exame admissional',
  integracao: 'Integração',
  beneficios: 'Benefícios e assinaturas',
  outro: 'Outros',
}

const categoryOrder: TaskCategory[] = [
  'documentacao',
  'exame',
  'integracao',
  'beneficios',
  'outro',
]

const taskViewFilterLabels: Record<TaskViewFilter, string> = {
  todas: 'Todas',
  pendentes: 'Pendentes',
  atrasadas: 'Atrasadas',
  concluidas: 'Concluídas',
}

function nullableText(value: string) {
  const normalized = value.trim()
  return normalized || null
}

function formatDate(value: string | null) {
  if (!value) {
    return '—'
  }

  const date = new Date(`${value}T00:00:00`)

  if (Number.isNaN(date.getTime())) {
    return '—'
  }

  return new Intl.DateTimeFormat('pt-BR').format(date)
}

function formatPhone(value: string | null) {
  if (!value) {
    return 'Não informado'
  }

  if (value.length === 11) {
    return `(${value.slice(0, 2)}) ${value.slice(2, 7)}-${value.slice(7)}`
  }

  if (value.length === 10) {
    return `(${value.slice(0, 2)}) ${value.slice(2, 6)}-${value.slice(6)}`
  }

  return value
}

function progressForTasks(tasks: OnboardingTask[]) {
  const relevant = tasks.filter(
    (task) => task.status !== 'nao_aplicavel',
  )

  if (relevant.length === 0) {
    return 0
  }

  const completed = relevant.filter(
    (task) => task.status === 'concluida',
  ).length

  return Math.round((completed / relevant.length) * 100)
}


function isTaskOverdue(task: OnboardingTask) {
  if (
    !task.prazo ||
    task.status === 'concluida' ||
    task.status === 'nao_aplicavel'
  ) {
    return false
  }

  const deadline = new Date(`${task.prazo}T23:59:59`)
  return deadline.getTime() < Date.now()
}

function taskDeadlineText(task: OnboardingTask) {
  if (!task.prazo) {
    return 'Sem prazo definido'
  }

  const deadline = new Date(`${task.prazo}T23:59:59`)
  const today = new Date()
  const todayStart = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
  )
  const deadlineStart = new Date(
    deadline.getFullYear(),
    deadline.getMonth(),
    deadline.getDate(),
  )
  const difference = Math.round(
    (deadlineStart.getTime() - todayStart.getTime()) /
      86_400_000,
  )

  if (task.status === 'concluida') {
    return `Concluída · prazo ${formatDate(task.prazo)}`
  }

  if (difference < 0) {
    const days = Math.abs(difference)
    return `Atrasada há ${days} dia${days === 1 ? '' : 's'}`
  }

  if (difference === 0) {
    return 'Vence hoje'
  }

  if (difference === 1) {
    return 'Vence amanhã'
  }

  return `Vence em ${difference} dias`
}

function Onboarding() {
  const [onboardings, setOnboardings] = useState<OnboardingRecord[]>([])
  const [tasks, setTasks] = useState<OnboardingTask[]>([])
  const [candidaturas, setCandidaturas] = useState<Candidatura[]>([])
  const [candidatos, setCandidatos] = useState<Candidato[]>([])
  const [vagas, setVagas] = useState<Vaga[]>([])
  const [perfis, setPerfis] = useState<Perfil[]>([])

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<
    'todos' | OnboardingStatus
  >('todos')

  const [onboardingForm, setOnboardingForm] =
    useState<OnboardingForm>(initialOnboardingForm)
  const [taskForm, setTaskForm] =
    useState<TaskForm>(initialTaskForm)

  const [editingOnboardingId, setEditingOnboardingId] =
    useState<string | null>(null)
  const [onboardingModalOpen, setOnboardingModalOpen] =
    useState(false)
  const [taskModalOpen, setTaskModalOpen] = useState(false)

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [updatingTaskId, setUpdatingTaskId] =
    useState<string | null>(null)
  const [deletingTaskId, setDeletingTaskId] =
    useState<string | null>(null)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const loadData = useCallback(async () => {
    setLoading(true)
    setError('')

    const [
      onboardingsResult,
      tasksResult,
      applicationsResult,
      candidatesResult,
      vacanciesResult,
      profilesResult,
    ] = await Promise.all([
      supabase
        .from('onboardings')
        .select(
          `
            id,
            candidatura_id,
            responsavel_id,
            data_prevista_inicio,
            data_admissao,
            status,
            observacoes,
            created_at,
            updated_at
          `,
        )
        .order('data_prevista_inicio', { ascending: true }),

      supabase
        .from('onboarding_tarefas')
        .select(
          `
            id,
            onboarding_id,
            titulo,
            categoria,
            status,
            responsavel_id,
            obrigatoria,
            prazo,
            ordem,
            observacoes,
            concluida_por,
            concluida_em,
            created_at,
            updated_at
          `,
        )
        .order('ordem', { ascending: true }),

      supabase
        .from('candidaturas')
        .select('id, candidato_id, vaga_id, etapa, status'),

      supabase
        .from('candidatos')
        .select(
          'id, numero, nome_completo, email, telefone, whatsapp',
        )
        .order('nome_completo'),

      supabase
        .from('vagas')
        .select('id, numero, cargo, setor')
        .order('numero', { ascending: false }),

      supabase
        .from('profiles')
        .select('id, full_name, active, role')
        .eq('active', true)
        .eq('role', 'rh')
        .order('full_name'),
    ])

    const queryError =
      onboardingsResult.error ??
      tasksResult.error ??
      applicationsResult.error ??
      candidatesResult.error ??
      vacanciesResult.error ??
      profilesResult.error

    if (queryError) {
      console.error(
        'Erro ao carregar onboarding:',
        queryError.message,
      )
      setError('Não foi possível carregar o onboarding.')
      setLoading(false)
      return
    }

    const loadedOnboardings =
      (onboardingsResult.data ?? []) as OnboardingRecord[]

    setOnboardings(loadedOnboardings)
    setTasks((tasksResult.data ?? []) as OnboardingTask[])
    setCandidaturas(
      (applicationsResult.data ?? []) as Candidatura[],
    )
    setCandidatos((candidatesResult.data ?? []) as Candidato[])
    setVagas((vacanciesResult.data ?? []) as Vaga[])
    setPerfis((profilesResult.data ?? []) as Perfil[])

    setSelectedId((current) => {
      if (
        current &&
        loadedOnboardings.some((item) => item.id === current)
      ) {
        return current
      }

      return loadedOnboardings[0]?.id ?? null
    })

    setLoading(false)
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  const views = useMemo(() => {
    const applicationMap = new Map(
      candidaturas.map((item) => [item.id, item]),
    )
    const candidateMap = new Map(
      candidatos.map((item) => [item.id, item]),
    )
    const vacancyMap = new Map(vagas.map((item) => [item.id, item]))
    const profileMap = new Map(
      perfis.map((item) => [item.id, item]),
    )

    return onboardings
      .map((onboarding) => {
        const application = applicationMap.get(
          onboarding.candidatura_id,
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
          onboarding,
          candidatura: application,
          candidato: candidate,
          vaga: vacancy,
          responsavel: onboarding.responsavel_id
            ? profileMap.get(onboarding.responsavel_id) ?? null
            : null,
          tasks: tasks.filter(
            (task) => task.onboarding_id === onboarding.id,
          ),
        } satisfies OnboardingView
      })
      .filter((item): item is OnboardingView => item !== null)
  }, [
    candidatos,
    candidaturas,
    onboardings,
    perfis,
    tasks,
    vagas,
  ])

  const filteredViews = useMemo(() => {
    const term = search.trim().toLowerCase()

    return views.filter((view) => {
      const matchesStatus =
        statusFilter === 'todos' ||
        view.onboarding.status === statusFilter

      const matchesSearch =
        !term ||
        view.candidato.nome_completo
          .toLowerCase()
          .includes(term) ||
        view.vaga.cargo.toLowerCase().includes(term) ||
        view.vaga.setor.toLowerCase().includes(term) ||
        String(view.candidato.numero).includes(term) ||
        String(view.vaga.numero).includes(term)

      return matchesStatus && matchesSearch
    })
  }, [search, statusFilter, views])

  const selectedView =
    views.find((view) => view.onboarding.id === selectedId) ?? null

  const availableApplications = useMemo(() => {
    const used = new Set(
      onboardings.map((item) => item.candidatura_id),
    )

    return candidaturas.filter(
      (application) =>
        !used.has(application.id) &&
        (application.status === 'contratado' ||
          application.etapa === 'contratado'),
    )
  }, [candidaturas, onboardings])

  function openNewOnboarding() {
    setOnboardingForm(initialOnboardingForm)
    setEditingOnboardingId(null)
    setError('')
    setMessage('')
    setOnboardingModalOpen(true)
  }

  function openEditOnboarding(view: OnboardingView) {
    setOnboardingForm({
      candidatura_id: view.onboarding.candidatura_id,
      responsavel_id: view.onboarding.responsavel_id ?? '',
      data_prevista_inicio:
        view.onboarding.data_prevista_inicio,
      data_admissao: view.onboarding.data_admissao ?? '',
      status: view.onboarding.status,
      observacoes: view.onboarding.observacoes ?? '',
    })
    setEditingOnboardingId(view.onboarding.id)
    setError('')
    setMessage('')
    setOnboardingModalOpen(true)
  }

  function closeOnboardingModal() {
    if (saving) {
      return
    }

    setOnboardingModalOpen(false)
    setEditingOnboardingId(null)
    setOnboardingForm(initialOnboardingForm)
    setError('')
  }

  function openNewTask() {
    if (!selectedView) {
      return
    }

    setTaskForm({
      ...initialTaskForm,
      responsavel_id:
        selectedView.onboarding.responsavel_id ?? '',
      prazo: selectedView.onboarding.data_prevista_inicio,
    })
    setError('')
    setMessage('')
    setTaskModalOpen(true)
  }

  function closeTaskModal() {
    if (saving) {
      return
    }

    setTaskModalOpen(false)
    setTaskForm(initialTaskForm)
    setError('')
  }

  async function saveOnboarding(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault()
    setError('')
    setMessage('')

    if (!editingOnboardingId && !onboardingForm.candidatura_id) {
      setError('Selecione o candidato contratado.')
      return
    }

    if (!onboardingForm.data_prevista_inicio) {
      setError('Informe a data prevista de início.')
      return
    }

    setSaving(true)

    const payload = {
      candidatura_id: onboardingForm.candidatura_id,
      responsavel_id:
        onboardingForm.responsavel_id || null,
      data_prevista_inicio:
        onboardingForm.data_prevista_inicio,
      data_admissao: onboardingForm.data_admissao || null,
      status: onboardingForm.status,
      observacoes: nullableText(onboardingForm.observacoes),
    }

    const result = editingOnboardingId
      ? await supabase
          .from('onboardings')
          .update({
            responsavel_id: payload.responsavel_id,
            data_prevista_inicio:
              payload.data_prevista_inicio,
            data_admissao: payload.data_admissao,
            status: payload.status,
            observacoes: payload.observacoes,
          })
          .eq('id', editingOnboardingId)
          .select()
          .single()
      : await supabase
          .from('onboardings')
          .insert(payload)
          .select()
          .single()

    setSaving(false)

    if (result.error) {
      console.error(
        'Erro ao salvar onboarding:',
        result.error.message,
      )
      setError('Não foi possível salvar o onboarding.')
      return
    }

    const saved = result.data as OnboardingRecord

    setSelectedId(saved.id)
    setOnboardingModalOpen(false)
    setEditingOnboardingId(null)
    setOnboardingForm(initialOnboardingForm)
    setMessage(
      editingOnboardingId
        ? 'Onboarding atualizado com sucesso.'
        : 'Onboarding criado com checklist padrão.',
    )

    await loadData()
  }

  async function addTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setMessage('')

    if (!selectedView) {
      return
    }

    const title = taskForm.titulo.trim()

    if (title.length < 3) {
      setError('Informe o título da tarefa.')
      return
    }

    setSaving(true)

    const maxOrder = selectedView.tasks.reduce(
      (highest, task) => Math.max(highest, task.ordem),
      0,
    )

    const { error: insertError } = await supabase
      .from('onboarding_tarefas')
      .insert({
        onboarding_id: selectedView.onboarding.id,
        titulo: title,
        categoria: taskForm.categoria,
        responsavel_id: taskForm.responsavel_id || null,
        obrigatoria: taskForm.obrigatoria,
        prazo: taskForm.prazo || null,
        ordem: maxOrder + 10,
        observacoes: nullableText(taskForm.observacoes),
      })

    setSaving(false)

    if (insertError) {
      console.error(
        'Erro ao criar tarefa:',
        insertError.message,
      )
      setError('Não foi possível criar a tarefa.')
      return
    }

    setTaskModalOpen(false)
    setTaskForm(initialTaskForm)
    setMessage('Tarefa criada com sucesso.')
    await loadData()
  }

  async function updateTaskStatus(
    task: OnboardingTask,
    status: TaskStatus,
  ) {
    setUpdatingTaskId(task.id)
    setError('')
    setMessage('')

    const { error: updateError } = await supabase
      .from('onboarding_tarefas')
      .update({ status })
      .eq('id', task.id)

    setUpdatingTaskId(null)

    if (updateError) {
      console.error(
        'Erro ao atualizar tarefa:',
        updateError.message,
      )
      setError('Não foi possível atualizar a tarefa.')
      return
    }

    setMessage('Tarefa atualizada.')
    await loadData()
  }

  async function deleteTask(task: OnboardingTask) {
    const confirmed = window.confirm(
      `Excluir a tarefa “${task.titulo}”?`,
    )

    if (!confirmed) {
      return
    }

    setDeletingTaskId(task.id)
    setError('')
    setMessage('')

    const { error: deleteError } = await supabase
      .from('onboarding_tarefas')
      .delete()
      .eq('id', task.id)

    setDeletingTaskId(null)

    if (deleteError) {
      console.error(
        'Erro ao excluir tarefa:',
        deleteError.message,
      )
      setError('Não foi possível excluir a tarefa.')
      return
    }

    setMessage('Tarefa excluída.')
    await loadData()
  }

  async function deleteOnboarding(view: OnboardingView) {
    const confirmed = window.confirm(
      `Excluir o onboarding de ${view.candidato.nome_completo}?`,
    )

    if (!confirmed) {
      return
    }

    setError('')
    setMessage('')

    const { error: deleteError } = await supabase
      .from('onboardings')
      .delete()
      .eq('id', view.onboarding.id)

    if (deleteError) {
      console.error(
        'Erro ao excluir onboarding:',
        deleteError.message,
      )
      setError('Não foi possível excluir o onboarding.')
      return
    }

    setSelectedId(null)
    setMessage('Onboarding excluído com sucesso.')
    await loadData()
  }

  if (loading) {
    return (
      <section className="onboarding-shell onboarding-loading">
        <div className="onboarding-loading-icon">ON</div>
        <p>Carregando onboardings...</p>
      </section>
    )
  }

  return (
    <>
      <section className="onboarding-shell">
        <header className="onboarding-page-header">
          <div>
            <span className="onboarding-eyebrow">
              Admissão
            </span>
            <h2>Onboarding de colaboradores</h2>
            <p>
              Acompanhe documentos, acessos, equipamentos e
              integrações.
            </p>
          </div>

          <div className="onboarding-header-actions">
            <button
              className="onboarding-secondary-button"
              type="button"
              onClick={loadData}
            >
              Atualizar
            </button>

            <button
              className="onboarding-primary-button"
              type="button"
              onClick={openNewOnboarding}
            >
              + Novo onboarding
            </button>
          </div>
        </header>

        <div className="onboarding-toolbar">
          <div className="onboarding-field">
            <label htmlFor="onboarding-search">
              Pesquisar
            </label>
            <input
              id="onboarding-search"
              type="search"
              placeholder="Candidato, vaga ou setor..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>

          <div className="onboarding-field">
            <label htmlFor="onboarding-status-filter">
              Situação
            </label>
            <select
              id="onboarding-status-filter"
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(
                  event.target.value as
                    | 'todos'
                    | OnboardingStatus,
                )
              }
            >
              <option value="todos">Todas</option>
              {Object.entries(onboardingStatusLabels).map(
                ([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ),
              )}
            </select>
          </div>

          <div className="onboarding-summary">
            <span>Total</span>
            <strong>{views.length}</strong>
          </div>

          <div className="onboarding-summary">
            <span>Em andamento</span>
            <strong>
              {
                views.filter(
                  (view) =>
                    view.onboarding.status ===
                    'em_andamento',
                ).length
              }
            </strong>
          </div>

          <div className="onboarding-summary overdue">
            <span>Com atraso</span>
            <strong>
              {
                views.filter((view) =>
                  view.tasks.some(isTaskOverdue),
                ).length
              }
            </strong>
          </div>
        </div>

        {error && (
          <div className="onboarding-message error" role="alert">
            {error}
          </div>
        )}

        {message && (
          <div
            className="onboarding-message success"
            role="status"
          >
            {message}
          </div>
        )}

        <div className="onboarding-layout">
          <div className="onboarding-list-panel">
            <header className="onboarding-list-panel-header">
              <div>
                <span>Colaboradores</span>
                <strong>Processos de integração</strong>
              </div>

              <small>{filteredViews.length}</small>
            </header>

            <div className="onboarding-list">
              {filteredViews.map((view) => {
                const progress = progressForTasks(view.tasks)
                const overdueCount = view.tasks.filter(
                  isTaskOverdue,
                ).length

                return (
                  <button
                    className={
                      selectedId === view.onboarding.id
                        ? 'onboarding-list-card active'
                        : 'onboarding-list-card'
                    }
                    type="button"
                    key={view.onboarding.id}
                    onClick={() =>
                      setSelectedId(view.onboarding.id)
                    }
                  >
                    <div className="onboarding-avatar">
                      {view.candidato.nome_completo
                        .charAt(0)
                        .toUpperCase()}
                    </div>

                    <div className="onboarding-list-content">
                      <div className="onboarding-list-title">
                        <strong>
                          {view.candidato.nome_completo}
                        </strong>

                        <span
                          className={`onboarding-status status-${view.onboarding.status}`}
                        >
                          {
                            onboardingStatusLabels[
                              view.onboarding.status
                            ]
                          }
                        </span>
                      </div>

                      <span>
                        VAG-
                        {String(view.vaga.numero).padStart(
                          6,
                          '0',
                        )}{' '}
                        — {view.vaga.cargo}
                      </span>

                      <div className="onboarding-mini-progress">
                        <div>
                          <span
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                        <small>{progress}%</small>
                      </div>

                      <div className="onboarding-list-footer">
                        <small>
                          Início:{' '}
                          {formatDate(
                            view.onboarding
                              .data_prevista_inicio,
                          )}
                        </small>

                        {overdueCount > 0 && (
                          <span>
                            {overdueCount} atrasada
                            {overdueCount === 1 ? '' : 's'}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                )
              })}

              {filteredViews.length === 0 && (
                <div className="onboarding-empty-list">
                  <div>ON</div>
                  <strong>Nenhum onboarding encontrado</strong>
                  <p>
                    Crie um onboarding para um candidato
                    contratado.
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="onboarding-detail-panel">
            {selectedView ? (
              <OnboardingDetails
                view={selectedView}
                profiles={perfis}
                updatingTaskId={updatingTaskId}
                deletingTaskId={deletingTaskId}
                onEdit={() =>
                  openEditOnboarding(selectedView)
                }
                onDelete={() =>
                  deleteOnboarding(selectedView)
                }
                onAddTask={openNewTask}
                onUpdateTaskStatus={updateTaskStatus}
                onDeleteTask={deleteTask}
              />
            ) : (
              <div className="onboarding-no-selection">
                <div>ON</div>
                <strong>Selecione um onboarding</strong>
                <p>
                  Os detalhes e o checklist aparecerão aqui.
                </p>
              </div>
            )}
          </div>
        </div>
      </section>

      {onboardingModalOpen && (
        <div
          className="onboarding-modal-overlay"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeOnboardingModal()
            }
          }}
        >
          <section
            className="onboarding-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="onboarding-modal-title"
          >
            <header className="onboarding-modal-header">
              <div>
                <span className="onboarding-eyebrow">
                  {editingOnboardingId ? 'Edição' : 'Admissão'}
                </span>
                <h2 id="onboarding-modal-title">
                  {editingOnboardingId
                    ? 'Editar onboarding'
                    : 'Novo onboarding'}
                </h2>
              </div>

              <button
                type="button"
                onClick={closeOnboardingModal}
                disabled={saving}
                aria-label="Fechar"
              >
                ×
              </button>
            </header>

            <form onSubmit={saveOnboarding}>
              <div className="onboarding-form-section">
                <div className="onboarding-form-grid">
                  <div className="onboarding-field full">
                    <label htmlFor="onboarding-candidatura">
                      Candidato contratado *
                    </label>

                    <select
                      id="onboarding-candidatura"
                      value={
                        onboardingForm.candidatura_id
                      }
                      onChange={(event) =>
                        setOnboardingForm((current) => ({
                          ...current,
                          candidatura_id:
                            event.target.value,
                        }))
                      }
                      disabled={
                        saving || Boolean(editingOnboardingId)
                      }
                    >
                      <option value="">Selecione</option>

                      {editingOnboardingId &&
                        selectedView && (
                          <option
                            value={
                              selectedView.candidatura.id
                            }
                          >
                            {
                              selectedView.candidato
                                .nome_completo
                            }{' '}
                            — VAG-
                            {String(
                              selectedView.vaga.numero,
                            ).padStart(6, '0')}{' '}
                            — {selectedView.vaga.cargo}
                          </option>
                        )}

                      {!editingOnboardingId &&
                        availableApplications.map(
                          (application) => {
                            const candidate =
                              candidatos.find(
                                (item) =>
                                  item.id ===
                                  application.candidato_id,
                              )
                            const vacancy = vagas.find(
                              (item) =>
                                item.id ===
                                application.vaga_id,
                            )

                            if (!candidate || !vacancy) {
                              return null
                            }

                            return (
                              <option
                                key={application.id}
                                value={application.id}
                              >
                                {candidate.nome_completo} —
                                VAG-
                                {String(
                                  vacancy.numero,
                                ).padStart(6, '0')}{' '}
                                — {vacancy.cargo}
                              </option>
                            )
                          },
                        )}
                    </select>

                    {!editingOnboardingId &&
                      availableApplications.length === 0 && (
                        <small>
                          Nenhuma candidatura contratada está
                          disponível.
                        </small>
                      )}
                  </div>

                  <div className="onboarding-field">
                    <label htmlFor="onboarding-responsavel">
                      Responsável
                    </label>

                    <select
                      id="onboarding-responsavel"
                      value={onboardingForm.responsavel_id}
                      onChange={(event) =>
                        setOnboardingForm((current) => ({
                          ...current,
                          responsavel_id:
                            event.target.value,
                        }))
                      }
                      disabled={saving}
                    >
                      <option value="">
                        Selecione uma pessoa do RH
                      </option>
                      {perfis.map((profile) => (
                        <option
                          key={profile.id}
                          value={profile.id}
                        >
                          {profile.full_name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="onboarding-field">
                    <label htmlFor="onboarding-status">
                      Situação
                    </label>

                    <select
                      id="onboarding-status"
                      value={onboardingForm.status}
                      onChange={(event) =>
                        setOnboardingForm((current) => ({
                          ...current,
                          status:
                            event.target
                              .value as OnboardingStatus,
                        }))
                      }
                      disabled={saving}
                    >
                      {Object.entries(
                        onboardingStatusLabels,
                      ).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="onboarding-field">
                    <label htmlFor="onboarding-data-prevista">
                      Data prevista de início *
                    </label>

                    <input
                      id="onboarding-data-prevista"
                      type="date"
                      value={
                        onboardingForm.data_prevista_inicio
                      }
                      onChange={(event) =>
                        setOnboardingForm((current) => ({
                          ...current,
                          data_prevista_inicio:
                            event.target.value,
                        }))
                      }
                      disabled={saving}
                    />
                  </div>

                  <div className="onboarding-field">
                    <label htmlFor="onboarding-data-admissao">
                      Data de admissão
                    </label>

                    <input
                      id="onboarding-data-admissao"
                      type="date"
                      value={onboardingForm.data_admissao}
                      onChange={(event) =>
                        setOnboardingForm((current) => ({
                          ...current,
                          data_admissao:
                            event.target.value,
                        }))
                      }
                      disabled={saving}
                    />
                  </div>
                </div>

                <div className="onboarding-field full space-top">
                  <label htmlFor="onboarding-observacoes">
                    Observações
                  </label>

                  <textarea
                    id="onboarding-observacoes"
                    rows={4}
                    value={onboardingForm.observacoes}
                    onChange={(event) =>
                      setOnboardingForm((current) => ({
                        ...current,
                        observacoes: event.target.value,
                      }))
                    }
                    disabled={saving}
                  />
                </div>
              </div>

              {error && (
                <div className="onboarding-message error">
                  {error}
                </div>
              )}

              <footer className="onboarding-modal-actions">
                <button
                  className="onboarding-secondary-button"
                  type="button"
                  onClick={closeOnboardingModal}
                  disabled={saving}
                >
                  Cancelar
                </button>

                <button
                  className="onboarding-primary-button"
                  type="submit"
                  disabled={saving}
                >
                  {saving
                    ? 'Salvando...'
                    : editingOnboardingId
                      ? 'Salvar alterações'
                      : 'Criar onboarding'}
                </button>
              </footer>
            </form>
          </section>
        </div>
      )}

      {taskModalOpen && (
        <div
          className="onboarding-modal-overlay"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeTaskModal()
            }
          }}
        >
          <section
            className="onboarding-modal small"
            role="dialog"
            aria-modal="true"
            aria-labelledby="task-modal-title"
          >
            <header className="onboarding-modal-header">
              <div>
                <span className="onboarding-eyebrow">
                  Checklist
                </span>
                <h2 id="task-modal-title">Nova tarefa</h2>
              </div>

              <button
                type="button"
                onClick={closeTaskModal}
                disabled={saving}
                aria-label="Fechar"
              >
                ×
              </button>
            </header>

            <form onSubmit={addTask}>
              <div className="onboarding-form-section">
                <div className="onboarding-field full">
                  <label htmlFor="task-title">
                    Título *
                  </label>

                  <input
                    id="task-title"
                    type="text"
                    value={taskForm.titulo}
                    onChange={(event) =>
                      setTaskForm((current) => ({
                        ...current,
                        titulo: event.target.value,
                      }))
                    }
                    disabled={saving}
                    autoFocus
                  />
                </div>

                <div className="onboarding-form-grid space-top">
                  <div className="onboarding-field">
                    <label htmlFor="task-category">
                      Categoria
                    </label>

                    <select
                      id="task-category"
                      value={taskForm.categoria}
                      onChange={(event) =>
                        setTaskForm((current) => ({
                          ...current,
                          categoria:
                            event.target
                              .value as TaskCategory,
                        }))
                      }
                      disabled={saving}
                    >
                      {Object.entries(categoryLabels).map(
                        ([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ),
                      )}
                    </select>
                  </div>

                  <div className="onboarding-field">
                    <label htmlFor="task-responsible">
                      Responsável
                    </label>

                    <select
                      id="task-responsible"
                      value={taskForm.responsavel_id}
                      onChange={(event) =>
                        setTaskForm((current) => ({
                          ...current,
                          responsavel_id:
                            event.target.value,
                        }))
                      }
                      disabled={saving}
                    >
                      <option value="">
                        Selecione uma pessoa do RH
                      </option>
                      {perfis.map((profile) => (
                        <option
                          key={profile.id}
                          value={profile.id}
                        >
                          {profile.full_name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="onboarding-field">
                    <label htmlFor="task-deadline">
                      Prazo
                    </label>

                    <input
                      id="task-deadline"
                      type="date"
                      value={taskForm.prazo}
                      onChange={(event) =>
                        setTaskForm((current) => ({
                          ...current,
                          prazo: event.target.value,
                        }))
                      }
                      disabled={saving}
                    />
                  </div>

                  <label className="onboarding-required-option">
                    <input
                      type="checkbox"
                      checked={taskForm.obrigatoria}
                      onChange={(event) =>
                        setTaskForm((current) => ({
                          ...current,
                          obrigatoria:
                            event.target.checked,
                        }))
                      }
                      disabled={saving}
                    />

                    <span>
                      <strong>Tarefa obrigatória</strong>
                      <small>
                        Faz parte do progresso principal.
                      </small>
                    </span>
                  </label>
                </div>

                <div className="onboarding-field full space-top">
                  <label htmlFor="task-notes">
                    Observações
                  </label>

                  <textarea
                    id="task-notes"
                    rows={3}
                    value={taskForm.observacoes}
                    onChange={(event) =>
                      setTaskForm((current) => ({
                        ...current,
                        observacoes: event.target.value,
                      }))
                    }
                    disabled={saving}
                  />
                </div>
              </div>

              {error && (
                <div className="onboarding-message error">
                  {error}
                </div>
              )}

              <footer className="onboarding-modal-actions">
                <button
                  className="onboarding-secondary-button"
                  type="button"
                  onClick={closeTaskModal}
                  disabled={saving}
                >
                  Cancelar
                </button>

                <button
                  className="onboarding-primary-button"
                  type="submit"
                  disabled={saving}
                >
                  {saving ? 'Criando...' : 'Criar tarefa'}
                </button>
              </footer>
            </form>
          </section>
        </div>
      )}
    </>
  )
}

type OnboardingDetailsProps = {
  view: OnboardingView
  profiles: Perfil[]
  updatingTaskId: string | null
  deletingTaskId: string | null
  onEdit: () => void
  onDelete: () => void
  onAddTask: () => void
  onUpdateTaskStatus: (
    task: OnboardingTask,
    status: TaskStatus,
  ) => Promise<void>
  onDeleteTask: (task: OnboardingTask) => Promise<void>
}

function OnboardingDetails({
  view,
  profiles,
  updatingTaskId,
  deletingTaskId,
  onEdit,
  onDelete,
  onAddTask,
  onUpdateTaskStatus,
  onDeleteTask,
}: OnboardingDetailsProps) {
  const [taskFilter, setTaskFilter] =
    useState<TaskViewFilter>('todas')

  const [documentsOpen, setDocumentsOpen] = useState(true)
  const [openCategories, setOpenCategories] = useState<
    Set<TaskCategory>
  >(() => new Set<TaskCategory>(['exame', 'integracao']))

  function toggleCategory(category: TaskCategory) {
    setOpenCategories((current) => {
      const next = new Set(current)

      if (next.has(category)) {
        next.delete(category)
      } else {
        next.add(category)
      }

      return next
    })
  }

  const progress = progressForTasks(view.tasks)
  const completedCount = view.tasks.filter(
    (task) => task.status === 'concluida',
  ).length
  const overdueCount = view.tasks.filter(isTaskOverdue).length
  const pendingCount = view.tasks.filter(
    (task) =>
      task.status === 'pendente' ||
      task.status === 'em_andamento' ||
      task.status === 'bloqueada',
  ).length

  const visibleTasks = view.tasks.filter((task) => {
    if (taskFilter === 'pendentes') {
      return (
        task.status === 'pendente' ||
        task.status === 'em_andamento' ||
        task.status === 'bloqueada'
      )
    }

    if (taskFilter === 'atrasadas') {
      return isTaskOverdue(task)
    }

    if (taskFilter === 'concluidas') {
      return task.status === 'concluida'
    }

    return true
  })

  const groupedTasks = categoryOrder
    .map((category) => ({
      category,
      tasks: visibleTasks.filter(
        (task) => task.categoria === category,
      ),
    }))
    .filter((group) => group.tasks.length > 0)

  const profileName = (id: string | null) =>
    profiles.find((profile) => profile.id === id)
      ?.full_name ?? 'Não definido'

  return (
    <>
      <section className="onboarding-detail-hero">
        <div className="onboarding-detail-identity">
          <div className="onboarding-detail-avatar">
            {view.candidato.nome_completo
              .charAt(0)
              .toUpperCase()}
          </div>

          <div>
            <span className="onboarding-eyebrow">
              CAN-
              {String(view.candidato.numero).padStart(6, '0')}
            </span>
            <h3>{view.candidato.nome_completo}</h3>
            <p>
              VAG-
              {String(view.vaga.numero).padStart(6, '0')} —{' '}
              {view.vaga.cargo}
              <span>•</span>
              {view.vaga.setor}
            </p>
          </div>
        </div>

        <div className="onboarding-detail-hero-actions">
          <span
            className={`onboarding-status status-${view.onboarding.status}`}
          >
            {onboardingStatusLabels[view.onboarding.status]}
          </span>

          <div>
            <button type="button" onClick={onEdit}>
              Editar onboarding
            </button>

            <button
              className="danger"
              type="button"
              onClick={onDelete}
            >
              Excluir
            </button>
          </div>
        </div>
      </section>

      <section className="onboarding-overview-grid">
        <article className="onboarding-progress-card v2">
          <div className="onboarding-progress-top">
            <div>
              <span>Progresso geral</span>
              <strong>{progress}%</strong>
            </div>

            <small>
              {completedCount} de {view.tasks.length} tarefas
            </small>
          </div>

          <div className="onboarding-progress-bar">
            <span style={{ width: `${progress}%` }} />
          </div>

          <p>
            {progress === 100
              ? 'Checklist concluído. O processo está pronto para finalização.'
              : `${pendingCount} tarefa${pendingCount === 1 ? '' : 's'} ainda precisa${pendingCount === 1 ? '' : 'm'} de acompanhamento.`}
          </p>
        </article>

        <div className="onboarding-kpi-grid">
          <article>
            <span>Total de tarefas</span>
            <strong>{view.tasks.length}</strong>
            <small>Checklist completo</small>
          </article>

          <article className="completed">
            <span>Concluídas</span>
            <strong>{completedCount}</strong>
            <small>Itens finalizados</small>
          </article>

          <article className={overdueCount > 0 ? 'overdue' : ''}>
            <span>Atrasadas</span>
            <strong>{overdueCount}</strong>
            <small>Precisam de atenção</small>
          </article>
        </div>
      </section>

      <section className="onboarding-info-section">
        <div className="onboarding-info-grid v2">
          <article>
            <span>Responsável pelo onboarding</span>
            <strong>
              {view.responsavel?.full_name ?? 'Não definido'}
            </strong>
          </article>

          <article>
            <span>Início previsto</span>
            <strong>
              {formatDate(
                view.onboarding.data_prevista_inicio,
              )}
            </strong>
          </article>

          <article>
            <span>Data de admissão</span>
            <strong>
              {formatDate(view.onboarding.data_admissao)}
            </strong>
          </article>

          <article>
            <span>Contato do colaborador</span>
            <strong>
              {formatPhone(
                view.candidato.whatsapp ??
                  view.candidato.telefone,
              )}
            </strong>
          </article>
        </div>

        {view.onboarding.observacoes && (
          <div className="onboarding-notes v2">
            <div>i</div>
            <div>
              <span>Observações do processo</span>
              <p>{view.onboarding.observacoes}</p>
            </div>
          </div>
        )}
      </section>

      <section className="onboarding-collapsible-section">
        <button
          className="onboarding-collapsible-trigger"
          type="button"
          onClick={() => setDocumentsOpen((current) => !current)}
          aria-expanded={documentsOpen}
        >
          <div>
            <span className="onboarding-collapsible-icon">DOC</span>
            <span>
              <strong>Documentação admissional</strong>
              <small>
                Acompanhe os arquivos enviados pelo candidato.
              </small>
            </span>
          </div>

          <span
            className={
              documentsOpen
                ? 'onboarding-collapse-arrow open'
                : 'onboarding-collapse-arrow'
            }
          >
            ›
          </span>
        </button>

        {documentsOpen && (
          <div className="onboarding-collapsible-content">
            <DocumentacaoAdmissional
              candidaturaId={view.candidatura.id}
            />
          </div>
        )}
      </section>

      <section className="onboarding-checklist v2">
        <header className="onboarding-checklist-header">
          <div>
            <span className="onboarding-eyebrow">
              Plano de integração
            </span>
            <h4>Checklist de admissão</h4>
            <p>
              Organize as pendências por categoria, responsável e
              prazo.
            </p>
          </div>

          <button
            className="onboarding-primary-button"
            type="button"
            onClick={onAddTask}
          >
            + Nova tarefa
          </button>
        </header>

        <nav
          className="onboarding-task-filters"
          aria-label="Filtrar tarefas do onboarding"
        >
          {(Object.keys(
            taskViewFilterLabels,
          ) as TaskViewFilter[]).map((filter) => {
            const count =
              filter === 'todas'
                ? view.tasks.length
                : filter === 'pendentes'
                  ? pendingCount
                  : filter === 'atrasadas'
                    ? overdueCount
                    : completedCount

            return (
              <button
                className={
                  taskFilter === filter ? 'active' : ''
                }
                type="button"
                key={filter}
                onClick={() => setTaskFilter(filter)}
              >
                <span>{taskViewFilterLabels[filter]}</span>
                <small>{count}</small>
              </button>
            )
          })}
        </nav>

        <div className="onboarding-task-groups">
          {groupedTasks.map((group) => (
            <section
              className="onboarding-task-group"
              key={group.category}
            >
              <button
                className="onboarding-task-group-trigger"
                type="button"
                onClick={() => toggleCategory(group.category)}
                aria-expanded={openCategories.has(group.category)}
              >
                <div>
                  <span
                    className={`onboarding-category-icon category-${group.category}`}
                  >
                    {categoryLabels[group.category]
                      .charAt(0)
                      .toUpperCase()}
                  </span>

                  <div>
                    <h5>{categoryLabels[group.category]}</h5>
                    <p>
                      {group.tasks.length} tarefa
                      {group.tasks.length === 1 ? '' : 's'}
                    </p>
                  </div>
                </div>

                <span
                  className={
                    openCategories.has(group.category)
                      ? 'onboarding-collapse-arrow open'
                      : 'onboarding-collapse-arrow'
                  }
                >
                  ›
                </span>
              </button>

              {openCategories.has(group.category) && (
                <div className="onboarding-task-list v2">
                {group.tasks.map((task) => {
                  const overdue = isTaskOverdue(task)
                  const automatedDocumentTask =
                    task.categoria === 'documentacao' &&
                    task.titulo
                      .toLowerCase()
                      .includes('documentos admissionais')

                  return (
                    <article
                      className={[
                        'onboarding-task-card',
                        `task-${task.status}`,
                        overdue ? 'overdue' : '',
                      ]
                        .filter(Boolean)
                        .join(' ')}
                      key={task.id}
                    >
                      <button
                        className="onboarding-task-check v2"
                        type="button"
                        onClick={() =>
                          onUpdateTaskStatus(
                            task,
                            task.status === 'concluida'
                              ? 'pendente'
                              : 'concluida',
                          )
                        }
                        disabled={
                          updatingTaskId === task.id ||
                          automatedDocumentTask
                        }
                        aria-label={
                          task.status === 'concluida'
                            ? 'Reabrir tarefa'
                            : 'Concluir tarefa'
                        }
                      >
                        {task.status === 'concluida'
                          ? '✓'
                          : ''}
                      </button>

                      <div className="onboarding-task-main">
                        <div className="onboarding-task-heading">
                          <div>
                            <strong>{task.titulo}</strong>

                            <div className="onboarding-task-badges">
                              {task.obrigatoria && (
                                <span className="required">
                                  Obrigatória
                                </span>
                              )}

                              {automatedDocumentTask && (
                                <span className="automatic">
                                  Atualização automática
                                </span>
                              )}

                              {overdue && (
                                <span className="late">
                                  Em atraso
                                </span>
                              )}
                            </div>
                          </div>

                          <span
                            className={`onboarding-task-status status-${task.status}`}
                          >
                            {taskStatusLabels[task.status]}
                          </span>
                        </div>

                        <div className="onboarding-task-details">
                          <span>
                            <strong>Responsável:</strong>{' '}
                            {profileName(task.responsavel_id)}
                          </span>

                          <span className={overdue ? 'late' : ''}>
                            <strong>Prazo:</strong>{' '}
                            {taskDeadlineText(task)}
                          </span>
                        </div>

                        {task.observacoes && (
                          <p>{task.observacoes}</p>
                        )}
                      </div>

                      <div className="onboarding-task-actions v2">
                        <select
                          value={task.status}
                          onChange={(event) =>
                            onUpdateTaskStatus(
                              task,
                              event.target.value as TaskStatus,
                            )
                          }
                          disabled={
                            updatingTaskId === task.id ||
                            automatedDocumentTask
                          }
                          aria-label={`Situação da tarefa ${task.titulo}`}
                        >
                          {Object.entries(
                            taskStatusLabels,
                          ).map(([value, label]) => (
                            <option key={value} value={value}>
                              {label}
                            </option>
                          ))}
                        </select>

                        {!automatedDocumentTask && (
                          <button
                            className="danger"
                            type="button"
                            onClick={() => onDeleteTask(task)}
                            disabled={deletingTaskId === task.id}
                          >
                            {deletingTaskId === task.id
                              ? 'Excluindo...'
                              : 'Excluir'}
                          </button>
                        )}
                      </div>
                    </article>
                  )
                })}
                </div>
              )}
            </section>
          ))}

          {visibleTasks.length === 0 && (
            <div className="onboarding-empty-tasks v2">
              <div>✓</div>
              <strong>Nenhuma tarefa neste filtro</strong>
              <p>
                Selecione outro filtro ou crie uma nova tarefa.
              </p>
            </div>
          )}
        </div>
      </section>
    </>
  )
}

export default Onboarding
