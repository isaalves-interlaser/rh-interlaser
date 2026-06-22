import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from 'react'
import { supabase } from '../lib/supabase'
import './Contratos.css'

type ContractStatus =
  | 'rascunho'
  | 'ativo'
  | 'encerrado'
  | 'cancelado'

type ExperienceStatus =
  | 'nao_iniciado'
  | 'adaptacao_14'
  | 'experiencia_44'
  | 'avaliacao_anual'
  | 'concluido'
  | 'encerrado'

type EvaluationStatus =
  | 'aguardando'
  | 'pendente'
  | 'aprovado'
  | 'reprovado'
  | 'acompanhamento'

type Contrato = {
  id: string
  candidatura_id: string
  candidato_id: string
  vaga_id: string
  empresa_id: string | null
  filial_id: string | null
  status: ContractStatus
  numero_contrato: string | null
  data_admissao: string | null
  tipo_contrato: string | null
  cargo: string | null
  setor: string | null
  salario: number | null
  jornada: string | null
  gestor_nome: string | null
  gestor_email: string | null
  observacoes: string | null
  experiencia_status: ExperienceStatus | null
  experiencia_inicio: string | null
  adaptacao_14_data: string | null
  adaptacao_14_status: EvaluationStatus | null
  adaptacao_14_parecer: string | null
  adaptacao_14_avaliado_em: string | null
  experiencia_44_data: string | null
  experiencia_44_status: EvaluationStatus | null
  experiencia_44_parecer: string | null
  experiencia_44_avaliado_em: string | null
  avaliacao_anual_data: string | null
  avaliacao_anual_status: EvaluationStatus | null
  avaliacao_anual_parecer: string | null
  avaliacao_anual_avaliado_em: string | null
  created_at: string
  updated_at: string
}

type Candidato = {
  id: string
  numero: number
  nome_completo: string
  email: string | null
  whatsapp: string | null
}

type Vaga = {
  id: string
  numero: number
  cargo: string
  setor: string
}

type Empresa = {
  id: string
  nome_fantasia: string
}

type Filial = {
  id: string
  codigo: string
  nome: string
}

type ContractView = {
  contrato: Contrato
  candidato: Candidato | null
  vaga: Vaga | null
  empresa: Empresa | null
  filial: Filial | null
}

type ContractForm = {
  status: ContractStatus
  numero_contrato: string
  data_admissao: string
  tipo_contrato: string
  cargo: string
  setor: string
  salario: string
  jornada: string
  gestor_nome: string
  gestor_email: string
  observacoes: string
  experiencia_status: ExperienceStatus
  experiencia_inicio: string
  adaptacao_14_data: string
  adaptacao_14_status: EvaluationStatus
  adaptacao_14_parecer: string
  experiencia_44_data: string
  experiencia_44_status: EvaluationStatus
  experiencia_44_parecer: string
  avaliacao_anual_data: string
  avaliacao_anual_status: EvaluationStatus
  avaliacao_anual_parecer: string
}

const statusLabels: Record<ContractStatus, string> = {
  rascunho: 'Pendente de preenchimento',
  ativo: 'Ativo',
  encerrado: 'Encerrado',
  cancelado: 'Cancelado',
}

const contractTypeLabels: Record<string, string> = {
  clt: 'CLT',
  pj: 'PJ',
  temporario: 'Temporário',
  estagio: 'Estágio',
  aprendiz: 'Aprendiz',
  terceiro: 'Terceiro',
}

const experienceStatusLabels: Record<ExperienceStatus, string> = {
  nao_iniciado: 'Não iniciado',
  adaptacao_14: 'Adaptação inicial - 14 dias',
  experiencia_44: 'Avaliação de experiência - 44 dias',
  avaliacao_anual: 'Avaliação anual - 1 ano',
  concluido: 'Acompanhamento concluído',
  encerrado: 'Encerrado',
}

const evaluationStatusLabels: Record<EvaluationStatus, string> = {
  aguardando: 'Aguardando período',
  pendente: 'Pendente de avaliação',
  aprovado: 'Aprovado',
  reprovado: 'Reprovado',
  acompanhamento: 'Necessita acompanhamento',
}

const evaluationOptions: Array<{ value: EvaluationStatus; label: string }> = [
  { value: 'aguardando', label: evaluationStatusLabels.aguardando },
  { value: 'pendente', label: evaluationStatusLabels.pendente },
  { value: 'aprovado', label: evaluationStatusLabels.aprovado },
  { value: 'reprovado', label: evaluationStatusLabels.reprovado },
  { value: 'acompanhamento', label: evaluationStatusLabels.acompanhamento },
]

function addDays(date: string, days: number) {
  if (!date) {
    return ''
  }

  const value = new Date(`${date}T00:00:00`)
  value.setDate(value.getDate() + days)

  return value.toISOString().slice(0, 10)
}

function getDefaultExperienceDates(admissionDate: string) {
  return {
    experiencia_inicio: admissionDate,
    adaptacao_14_data: addDays(admissionDate, 14),
    experiencia_44_data: addDays(admissionDate, 44),
    avaliacao_anual_data: addDays(admissionDate, 365),
  }
}

function getTodayIso() {
  return new Date().toISOString().slice(0, 10)
}

function isDue(date: string | null | undefined) {
  if (!date) {
    return false
  }

  return date <= getTodayIso()
}

function getCurrentExperienceStep(contrato: Contrato) {
  const adaptacaoStatus = contrato.adaptacao_14_status ?? 'aguardando'
  const experienciaStatus = contrato.experiencia_44_status ?? 'aguardando'
  const anualStatus = contrato.avaliacao_anual_status ?? 'aguardando'
  const adaptacaoDate = contrato.adaptacao_14_data
  const experienciaDate = contrato.experiencia_44_data
  const anualDate = contrato.avaliacao_anual_data

  if (adaptacaoStatus === 'reprovado' || experienciaStatus === 'reprovado') {
    return {
      label: 'Reprovado na experiência',
      date: adaptacaoStatus === 'reprovado' ? adaptacaoDate : experienciaDate,
      tone: 'danger',
    }
  }

  if (adaptacaoStatus !== 'aprovado') {
    return {
      label: 'Avaliação 14 dias',
      date: adaptacaoDate,
      tone: isDue(adaptacaoDate) ? 'warning' : 'neutral',
    }
  }

  if (experienciaStatus !== 'aprovado') {
    return {
      label: 'Avaliação 44 dias',
      date: experienciaDate,
      tone: isDue(experienciaDate) ? 'warning' : 'neutral',
    }
  }

  if (anualStatus !== 'aprovado') {
    return {
      label: 'Avaliação anual',
      date: anualDate,
      tone: isDue(anualDate) ? 'warning' : 'success',
    }
  }

  return {
    label: 'Acompanhamento concluído',
    date: anualDate,
    tone: 'success',
  }
}

function formatDate(value: string | null) {
  if (!value) {
    return 'Não informada'
  }

  return new Intl.DateTimeFormat('pt-BR').format(
    new Date(`${value}T00:00:00`),
  )
}

function formatMoney(value: number | null) {
  if (value === null) {
    return 'Não informado'
  }

  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value)
}

function Contratos() {
  const [contratos, setContratos] = useState<Contrato[]>([])
  const [candidatos, setCandidatos] = useState<Candidato[]>([])
  const [vagas, setVagas] = useState<Vaga[]>([])
  const [empresas, setEmpresas] = useState<Empresa[]>([])
  const [filiais, setFiliais] = useState<Filial[]>([])
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] =
    useState<'todos' | ContractStatus>('todos')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [editing, setEditing] =
    useState<ContractView | null>(null)
  const [form, setForm] = useState<ContractForm | null>(null)

  const loadData = useCallback(async () => {
    setLoading(true)
    setError('')

    const [
      contractsResult,
      candidatesResult,
      vacanciesResult,
      companiesResult,
      branchesResult,
    ] = await Promise.all([
      supabase
        .from('contratos')
        .select(
          'id, candidatura_id, candidato_id, vaga_id, empresa_id, filial_id, status, numero_contrato, data_admissao, tipo_contrato, cargo, setor, salario, jornada, gestor_nome, gestor_email, observacoes, experiencia_status, experiencia_inicio, adaptacao_14_data, adaptacao_14_status, adaptacao_14_parecer, adaptacao_14_avaliado_em, experiencia_44_data, experiencia_44_status, experiencia_44_parecer, experiencia_44_avaliado_em, avaliacao_anual_data, avaliacao_anual_status, avaliacao_anual_parecer, avaliacao_anual_avaliado_em, created_at, updated_at',
        )
        .order('created_at', { ascending: false }),
      supabase
        .from('candidatos')
        .select(
          'id, numero, nome_completo, email, whatsapp',
        ),
      supabase
        .from('vagas')
        .select('id, numero, cargo, setor'),
      supabase
        .from('empresas')
        .select('id, nome_fantasia'),
      supabase
        .from('filiais')
        .select('id, codigo, nome'),
    ])

    const firstError =
      contractsResult.error ??
      candidatesResult.error ??
      vacanciesResult.error ??
      companiesResult.error ??
      branchesResult.error

    if (firstError) {
      console.error(
        'Erro ao carregar contratos:',
        firstError.message,
      )
      setError(
        'Não foi possível carregar os contratos.',
      )
      setLoading(false)
      return
    }

    setContratos((contractsResult.data ?? []) as Contrato[])
    setCandidatos(
      (candidatesResult.data ?? []) as Candidato[],
    )
    setVagas((vacanciesResult.data ?? []) as Vaga[])
    setEmpresas((companiesResult.data ?? []) as Empresa[])
    setFiliais((branchesResult.data ?? []) as Filial[])
    setLoading(false)
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  useEffect(() => {
    if (!error && !message) {
      return
    }

    const timer = window.setTimeout(() => {
      setError('')
      setMessage('')
    }, 6000)

    return () => window.clearTimeout(timer)
  }, [error, message])

  const views = useMemo<ContractView[]>(() => {
    const candidateMap = new Map(
      candidatos.map((item) => [item.id, item]),
    )
    const vacancyMap = new Map(
      vagas.map((item) => [item.id, item]),
    )
    const companyMap = new Map(
      empresas.map((item) => [item.id, item]),
    )
    const branchMap = new Map(
      filiais.map((item) => [item.id, item]),
    )

    return contratos.map((contrato) => ({
      contrato,
      candidato:
        candidateMap.get(contrato.candidato_id) ?? null,
      vaga: vacancyMap.get(contrato.vaga_id) ?? null,
      empresa: contrato.empresa_id
        ? companyMap.get(contrato.empresa_id) ?? null
        : null,
      filial: contrato.filial_id
        ? branchMap.get(contrato.filial_id) ?? null
        : null,
    }))
  }, [candidatos, contratos, empresas, filiais, vagas])

  const filteredViews = useMemo(() => {
    const term = search.trim().toLowerCase()

    return views.filter((view) => {
      const matchesStatus =
        statusFilter === 'todos' ||
        view.contrato.status === statusFilter

      const matchesTerm =
        !term ||
        view.candidato?.nome_completo
          .toLowerCase()
          .includes(term) ||
        view.vaga?.cargo.toLowerCase().includes(term) ||
        view.empresa?.nome_fantasia
          .toLowerCase()
          .includes(term) ||
        view.filial?.nome.toLowerCase().includes(term) ||
        view.contrato.numero_contrato
          ?.toLowerCase()
          .includes(term) ||
        String(view.candidato?.numero ?? '').includes(term)

      return matchesStatus && Boolean(matchesTerm)
    })
  }, [search, statusFilter, views])

  const activeContracts = useMemo(
    () =>
      contratos.filter(
        (contrato) => contrato.status === 'ativo',
      ).length,
    [contratos],
  )

  const pendingContracts = useMemo(
    () =>
      contratos.filter(
        (contrato) => contrato.status === 'rascunho',
      ).length,
    [contratos],
  )

  function openEdit(view: ContractView) {
    const defaultDates = getDefaultExperienceDates(
      view.contrato.data_admissao ?? '',
    )

    setEditing(view)
    setForm({
      status: view.contrato.status,
      numero_contrato:
        view.contrato.numero_contrato ?? '',
      data_admissao: view.contrato.data_admissao ?? '',
      tipo_contrato:
        view.contrato.tipo_contrato ?? '',
      cargo:
        view.contrato.cargo ??
        view.vaga?.cargo ??
        '',
      setor:
        view.contrato.setor ??
        view.vaga?.setor ??
        '',
      salario:
        view.contrato.salario === null
          ? ''
          : String(view.contrato.salario),
      jornada: view.contrato.jornada ?? '',
      gestor_nome: view.contrato.gestor_nome ?? '',
      gestor_email: view.contrato.gestor_email ?? '',
      observacoes: view.contrato.observacoes ?? '',
      experiencia_status:
        view.contrato.experiencia_status ??
        (view.contrato.data_admissao
          ? 'adaptacao_14'
          : 'nao_iniciado'),
      experiencia_inicio:
        view.contrato.experiencia_inicio ??
        defaultDates.experiencia_inicio,
      adaptacao_14_data:
        view.contrato.adaptacao_14_data ??
        defaultDates.adaptacao_14_data,
      adaptacao_14_status:
        view.contrato.adaptacao_14_status ??
        (isDue(defaultDates.adaptacao_14_data)
          ? 'pendente'
          : 'aguardando'),
      adaptacao_14_parecer:
        view.contrato.adaptacao_14_parecer ?? '',
      experiencia_44_data:
        view.contrato.experiencia_44_data ??
        defaultDates.experiencia_44_data,
      experiencia_44_status:
        view.contrato.experiencia_44_status ?? 'aguardando',
      experiencia_44_parecer:
        view.contrato.experiencia_44_parecer ?? '',
      avaliacao_anual_data:
        view.contrato.avaliacao_anual_data ??
        defaultDates.avaliacao_anual_data,
      avaliacao_anual_status:
        view.contrato.avaliacao_anual_status ??
        'aguardando',
      avaliacao_anual_parecer:
        view.contrato.avaliacao_anual_parecer ?? '',
    })
    setError('')
    setMessage('')
  }

  function closeModal() {
    if (saving) {
      return
    }

    setEditing(null)
    setForm(null)
  }


  function updateAdmissionDate(value: string) {
    setForm((current) => {
      if (!current) {
        return current
      }

      const dates = getDefaultExperienceDates(value)

      return {
        ...current,
        data_admissao: value,
        experiencia_status: value
          ? current.experiencia_status === 'nao_iniciado'
            ? 'adaptacao_14'
            : current.experiencia_status
          : 'nao_iniciado',
        experiencia_inicio: dates.experiencia_inicio,
        adaptacao_14_data: dates.adaptacao_14_data,
        experiencia_44_data: dates.experiencia_44_data,
        avaliacao_anual_data: dates.avaliacao_anual_data,
        adaptacao_14_status: value
          ? current.adaptacao_14_status === 'aguardando' &&
            isDue(dates.adaptacao_14_data)
            ? 'pendente'
            : current.adaptacao_14_status
          : 'aguardando',
      }
    })
  }

  async function saveContract(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault()

    if (!editing || !form) {
      return
    }

    setError('')
    setMessage('')

    const salary = form.salario
      ? Number(form.salario.replace(',', '.'))
      : null

    if (
      form.gestor_email.trim() &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
        form.gestor_email.trim(),
      )
    ) {
      setError('Informe um e-mail válido para o gestor.')
      return
    }

    if (
      salary !== null &&
      (!Number.isFinite(salary) || salary < 0)
    ) {
      setError('Informe um salário válido.')
      return
    }

    if (
      form.adaptacao_14_status === 'reprovado' &&
      form.experiencia_44_status === 'aprovado'
    ) {
      setError(
        'Não é possível aprovar a experiência se a avaliação de 14 dias foi reprovada.',
      )
      return
    }

    const computedExperienceStatus: ExperienceStatus =
      form.adaptacao_14_status === 'reprovado' ||
      form.experiencia_44_status === 'reprovado'
        ? 'encerrado'
        : form.adaptacao_14_status !== 'aprovado'
          ? form.data_admissao
            ? 'adaptacao_14'
            : 'nao_iniciado'
          : form.experiencia_44_status !== 'aprovado'
            ? 'experiencia_44'
            : form.avaliacao_anual_status !== 'aprovado'
              ? 'avaliacao_anual'
              : 'concluido'

    setSaving(true)

    const { data, error: updateError } = await supabase
      .from('contratos')
      .update({
        status: form.status,
        numero_contrato:
          form.numero_contrato.trim() || null,
        data_admissao: form.data_admissao || null,
        tipo_contrato:
          form.tipo_contrato.trim() || null,
        cargo: form.cargo.trim() || null,
        setor: form.setor.trim() || null,
        salario: salary,
        jornada: form.jornada.trim() || null,
        gestor_nome: form.gestor_nome.trim() || null,
        gestor_email:
          form.gestor_email.trim().toLowerCase() || null,
        observacoes: form.observacoes.trim() || null,
        experiencia_status: computedExperienceStatus,
        experiencia_inicio: form.experiencia_inicio || null,
        adaptacao_14_data: form.adaptacao_14_data || null,
        adaptacao_14_status: form.adaptacao_14_status,
        adaptacao_14_parecer:
          form.adaptacao_14_parecer.trim() || null,
        adaptacao_14_avaliado_em:
          form.adaptacao_14_status === 'aprovado' ||
          form.adaptacao_14_status === 'reprovado' ||
          form.adaptacao_14_status === 'acompanhamento'
            ? new Date().toISOString()
            : editing.contrato.adaptacao_14_avaliado_em,
        experiencia_44_data: form.experiencia_44_data || null,
        experiencia_44_status: form.experiencia_44_status,
        experiencia_44_parecer:
          form.experiencia_44_parecer.trim() || null,
        experiencia_44_avaliado_em:
          form.experiencia_44_status === 'aprovado' ||
          form.experiencia_44_status === 'reprovado' ||
          form.experiencia_44_status === 'acompanhamento'
            ? new Date().toISOString()
            : editing.contrato.experiencia_44_avaliado_em,
        avaliacao_anual_data: form.avaliacao_anual_data || null,
        avaliacao_anual_status: form.avaliacao_anual_status,
        avaliacao_anual_parecer:
          form.avaliacao_anual_parecer.trim() || null,
        avaliacao_anual_avaliado_em:
          form.avaliacao_anual_status === 'aprovado' ||
          form.avaliacao_anual_status === 'reprovado' ||
          form.avaliacao_anual_status === 'acompanhamento'
            ? new Date().toISOString()
            : editing.contrato.avaliacao_anual_avaliado_em,
      })
      .eq('id', editing.contrato.id)
      .select()
      .single()

    setSaving(false)

    if (updateError) {
      console.error(
        'Erro ao atualizar contrato:',
        updateError.message,
      )
      setError('Não foi possível atualizar o contrato.')
      return
    }

    setContratos((current) =>
      current.map((contrato) =>
        contrato.id === editing.contrato.id
          ? (data as Contrato)
          : contrato,
      ),
    )

    setEditing(null)
    setForm(null)
    setMessage('Contrato atualizado com sucesso.')
  }

  if (loading) {
    return (
      <section className="contracts-panel contracts-loading">
        <div>CT</div>
        <p>Carregando contratos...</p>
      </section>
    )
  }

  return (
    <>
      <section className="contracts-panel">
        <header className="contracts-header">
          <div>
            <span>Admissões</span>
            <h2>Contratos</h2>
            <p>
              Centralize as informações dos candidatos já
              contratados sem poluir a Pipeline.
            </p>
          </div>

          <button type="button" onClick={loadData}>
            Atualizar
          </button>
        </header>

        <div className="contracts-toolbar">
          <div className="contracts-search">
            <label htmlFor="contract-search">
              Pesquisar
            </label>
            <input
              id="contract-search"
              type="search"
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
              placeholder="Candidato, vaga, empresa ou contrato..."
            />
          </div>

          <div className="contracts-filter">
            <label htmlFor="contract-status">
              Situação
            </label>
            <select
              id="contract-status"
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(
                  event.target.value as
                    | 'todos'
                    | ContractStatus,
                )
              }
            >
              <option value="todos">Todas</option>
              {Object.entries(statusLabels).map(
                ([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ),
              )}
            </select>
          </div>

          <div className="contracts-summary">
            <span>Total</span>
            <strong>{contratos.length}</strong>
          </div>

          <div className="contracts-summary">
            <span>Pendentes</span>
            <strong>{pendingContracts}</strong>
          </div>

          <div className="contracts-summary">
            <span>Ativos</span>
            <strong>{activeContracts}</strong>
          </div>
        </div>

        <div className="contracts-table-wrapper">
          <table className="contracts-table">
            <thead>
              <tr>
                <th>Candidato</th>
                <th>Cargo / unidade</th>
                <th>Admissão</th>
                <th>Experiência</th>
                <th>Contrato</th>
                <th>Salário</th>
                <th>Situação</th>
                <th />
              </tr>
            </thead>

            <tbody>
              {filteredViews.map((view) => (
                <tr key={view.contrato.id}>
                  <td>
                    <div className="contracts-person">
                      <div>
                        {view.candidato?.nome_completo
                          .charAt(0)
                          .toUpperCase() ?? '?'}
                      </div>

                      <span>
                        <strong>
                          {view.candidato?.nome_completo ??
                            'Candidato não encontrado'}
                        </strong>
                        <small>
                          CAN-
                          {String(
                            view.candidato?.numero ?? 0,
                          ).padStart(6, '0')}
                          {view.candidato?.email
                            ? ` · ${view.candidato.email}`
                            : ''}
                        </small>
                      </span>
                    </div>
                  </td>

                  <td>
                    <strong>
                      {view.contrato.cargo ??
                        view.vaga?.cargo ??
                        'Cargo não informado'}
                    </strong>
                    <small>
                      {view.empresa?.nome_fantasia ??
                        'Empresa não informada'}
                      {' · '}
                      {view.filial
                        ? `${view.filial.codigo} — ${view.filial.nome}`
                        : 'Filial não informada'}
                    </small>
                  </td>

                  <td>
                    {formatDate(view.contrato.data_admissao)}
                  </td>

                  <td>
                    {(() => {
                      const step = getCurrentExperienceStep(
                        view.contrato,
                      )

                      return (
                        <div className="contracts-experience-summary">
                          <span
                            className={`experience-pill ${step.tone}`}
                          >
                            {step.label}
                          </span>
                          <small>
                            Vencimento: {formatDate(step.date ?? null)}
                          </small>
                        </div>
                      )
                    })()}
                  </td>

                  <td>
                    <strong>
                      {view.contrato.numero_contrato ||
                        'Sem número'}
                    </strong>
                    <small>
                      {contractTypeLabels[
                        view.contrato.tipo_contrato ?? ''
                      ] ??
                        view.contrato.tipo_contrato ??
                        'Tipo não informado'}
                    </small>
                  </td>

                  <td>
                    {formatMoney(view.contrato.salario)}
                  </td>

                  <td>
                    <span
                      className={`contract-status status-${view.contrato.status}`}
                    >
                      {statusLabels[view.contrato.status]}
                    </span>
                  </td>

                  <td>
                    <button
                      type="button"
                      onClick={() => openEdit(view)}
                    >
                      Ver e editar
                    </button>
                  </td>
                </tr>
              ))}

              {filteredViews.length === 0 && (
                <tr>
                  <td colSpan={8}>
                    <div className="contracts-empty">
                      <strong>
                        Nenhum contrato encontrado
                      </strong>
                      <p>
                        Quando uma candidatura for contratada,
                        ela aparecerá automaticamente aqui.
                      </p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {(error || message) && (
        <div
          className={
            error
              ? 'contracts-toast error'
              : 'contracts-toast success'
          }
        >
          <div>
            <strong>{error ? 'Atenção' : 'Tudo certo'}</strong>
            <span>{error || message}</span>
          </div>
          <button
            type="button"
            onClick={() => {
              setError('')
              setMessage('')
            }}
          >
            ×
          </button>
        </div>
      )}

      {editing && form && (
        <div
          className="contracts-modal-overlay"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeModal()
            }
          }}
        >
          <section
            className="contracts-modal"
            role="dialog"
            aria-modal="true"
          >
            <header>
              <div>
                <span>Contrato</span>
                <h2>
                  {editing.candidato?.nome_completo ??
                    'Candidato contratado'}
                </h2>
                <p>
                  VAG-
                  {String(
                    editing.vaga?.numero ?? 0,
                  ).padStart(6, '0')}
                  {' · '}
                  {editing.vaga?.cargo ??
                    'Vaga não encontrada'}
                </p>
              </div>

              <button type="button" onClick={closeModal}>
                ×
              </button>
            </header>

            <form onSubmit={saveContract}>
              <div className="contracts-form">
                <div className="contracts-field">
                  <label htmlFor="contract-status-edit">
                    Situação
                  </label>
                  <select
                    id="contract-status-edit"
                    value={form.status}
                    onChange={(event) =>
                      setForm((current) =>
                        current
                          ? {
                              ...current,
                              status:
                                event.target
                                  .value as ContractStatus,
                            }
                          : current,
                      )
                    }
                    disabled={saving}
                  >
                    {Object.entries(statusLabels).map(
                      ([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ),
                    )}
                  </select>
                </div>

                <div className="contracts-field">
                  <label htmlFor="contract-number">
                    Número do contrato
                  </label>
                  <input
                    id="contract-number"
                    value={form.numero_contrato}
                    onChange={(event) =>
                      setForm((current) =>
                        current
                          ? {
                              ...current,
                              numero_contrato:
                                event.target.value,
                            }
                          : current,
                      )
                    }
                    disabled={saving}
                  />
                </div>

                <div className="contracts-field">
                  <label htmlFor="contract-admission-date">
                    Data de admissão
                  </label>
                  <input
                    id="contract-admission-date"
                    type="date"
                    value={form.data_admissao}
                    onChange={(event) =>
                      updateAdmissionDate(event.target.value)
                    }
                    disabled={saving}
                  />
                </div>

                <div className="contracts-field">
                  <label htmlFor="contract-type">
                    Tipo de contrato
                  </label>
                  <select
                    id="contract-type"
                    value={form.tipo_contrato}
                    onChange={(event) =>
                      setForm((current) =>
                        current
                          ? {
                              ...current,
                              tipo_contrato:
                                event.target.value,
                            }
                          : current,
                      )
                    }
                    disabled={saving}
                  >
                    <option value="">Não informado</option>
                    {Object.entries(
                      contractTypeLabels,
                    ).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="contracts-field">
                  <label htmlFor="contract-role">Cargo</label>
                  <input
                    id="contract-role"
                    value={form.cargo}
                    onChange={(event) =>
                      setForm((current) =>
                        current
                          ? {
                              ...current,
                              cargo: event.target.value,
                            }
                          : current,
                      )
                    }
                    disabled={saving}
                  />
                </div>

                <div className="contracts-field">
                  <label htmlFor="contract-department">
                    Setor
                  </label>
                  <input
                    id="contract-department"
                    value={form.setor}
                    onChange={(event) =>
                      setForm((current) =>
                        current
                          ? {
                              ...current,
                              setor: event.target.value,
                            }
                          : current,
                      )
                    }
                    disabled={saving}
                  />
                </div>

                <div className="contracts-field">
                  <label htmlFor="contract-salary">
                    Salário
                  </label>
                  <input
                    id="contract-salary"
                    type="number"
                    min={0}
                    step="0.01"
                    value={form.salario}
                    onChange={(event) =>
                      setForm((current) =>
                        current
                          ? {
                              ...current,
                              salario: event.target.value,
                            }
                          : current,
                      )
                    }
                    disabled={saving}
                  />
                </div>

                <div className="contracts-field">
                  <label htmlFor="contract-hours">
                    Jornada
                  </label>
                  <input
                    id="contract-hours"
                    value={form.jornada}
                    onChange={(event) =>
                      setForm((current) =>
                        current
                          ? {
                              ...current,
                              jornada: event.target.value,
                            }
                          : current,
                      )
                    }
                    placeholder="Ex.: segunda a sexta, 08h às 18h"
                    disabled={saving}
                  />
                </div>

                <div className="contracts-field">
                  <label htmlFor="contract-manager-name">
                    Gestor
                  </label>
                  <input
                    id="contract-manager-name"
                    value={form.gestor_nome}
                    onChange={(event) =>
                      setForm((current) =>
                        current
                          ? {
                              ...current,
                              gestor_nome:
                                event.target.value,
                            }
                          : current,
                      )
                    }
                    disabled={saving}
                  />
                </div>

                <div className="contracts-field">
                  <label htmlFor="contract-manager-email">
                    E-mail do gestor
                  </label>
                  <input
                    id="contract-manager-email"
                    type="email"
                    value={form.gestor_email}
                    onChange={(event) =>
                      setForm((current) =>
                        current
                          ? {
                              ...current,
                              gestor_email:
                                event.target.value,
                            }
                          : current,
                      )
                    }
                    disabled={saving}
                  />
                </div>

                <div className="contracts-section-title full">
                  <strong>Experiência e avaliações</strong>
                  <span>
                    Controle automático: 14 dias de adaptação,
                    mais 30 dias de experiência e avaliação anual.
                  </span>
                </div>

                <div className="contracts-experience-timeline full">
                  <article className="experience-step">
                    <span className="experience-step-number">1</span>
                    <div>
                      <strong>Adaptação inicial - 14 dias</strong>
                      <small>
                        Avaliar presença, adaptação ao setor,
                        postura e dificuldades iniciais.
                      </small>
                    </div>
                  </article>

                  <article className="experience-step">
                    <span className="experience-step-number">2</span>
                    <div>
                      <strong>Avaliação de experiência - 44 dias</strong>
                      <small>
                        Se aprovado nos 14 dias, acompanha mais
                        30 dias antes da próxima decisão.
                      </small>
                    </div>
                  </article>

                  <article className="experience-step">
                    <span className="experience-step-number">3</span>
                    <div>
                      <strong>Avaliação anual - 1 ano</strong>
                      <small>
                        Acompanhamento interno de desempenho após
                        a permanência no cargo.
                      </small>
                    </div>
                  </article>
                </div>

                <div className="contracts-field">
                  <label htmlFor="experience-status">
                    Status do acompanhamento
                  </label>
                  <select
                    id="experience-status"
                    value={form.experiencia_status}
                    onChange={(event) =>
                      setForm((current) =>
                        current
                          ? {
                              ...current,
                              experiencia_status:
                                event.target
                                  .value as ExperienceStatus,
                            }
                          : current,
                      )
                    }
                    disabled={saving}
                  >
                    {Object.entries(experienceStatusLabels).map(
                      ([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ),
                    )}
                  </select>
                </div>

                <div className="contracts-field">
                  <label htmlFor="experience-start">
                    Início do acompanhamento
                  </label>
                  <input
                    id="experience-start"
                    type="date"
                    value={form.experiencia_inicio}
                    onChange={(event) =>
                      setForm((current) =>
                        current
                          ? {
                              ...current,
                              experiencia_inicio:
                                event.target.value,
                            }
                          : current,
                      )
                    }
                    disabled={saving}
                  />
                </div>

                <div className="contracts-evaluation-card full">
                  <header>
                    <div>
                      <strong>Avaliação de adaptação - 14 dias</strong>
                      <span>
                        Vencimento: {formatDate(form.adaptacao_14_data || null)}
                      </span>
                    </div>
                  </header>

                  <div className="contracts-evaluation-grid">
                    <div className="contracts-field">
                      <label htmlFor="adaptation-date">
                        Data da avaliação
                      </label>
                      <input
                        id="adaptation-date"
                        type="date"
                        value={form.adaptacao_14_data}
                        onChange={(event) =>
                          setForm((current) =>
                            current
                              ? {
                                  ...current,
                                  adaptacao_14_data:
                                    event.target.value,
                                }
                              : current,
                          )
                        }
                        disabled={saving}
                      />
                    </div>

                    <div className="contracts-field">
                      <label htmlFor="adaptation-status">
                        Resultado
                      </label>
                      <select
                        id="adaptation-status"
                        value={form.adaptacao_14_status}
                        onChange={(event) =>
                          setForm((current) =>
                            current
                              ? {
                                  ...current,
                                  adaptacao_14_status:
                                    event.target
                                      .value as EvaluationStatus,
                                  experiencia_44_status:
                                    event.target.value === 'aprovado' &&
                                    current.experiencia_44_status ===
                                      'aguardando'
                                      ? 'pendente'
                                      : current.experiencia_44_status,
                                }
                              : current,
                          )
                        }
                        disabled={saving}
                      >
                        {evaluationOptions.map((option) => (
                          <option
                            key={option.value}
                            value={option.value}
                          >
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="contracts-field full">
                    <label htmlFor="adaptation-notes">
                      Parecer do RH/líder
                    </label>
                    <textarea
                      id="adaptation-notes"
                      rows={3}
                      value={form.adaptacao_14_parecer}
                      onChange={(event) =>
                        setForm((current) =>
                          current
                            ? {
                                ...current,
                                adaptacao_14_parecer:
                                  event.target.value,
                              }
                            : current,
                        )
                      }
                      placeholder="Registre adaptação, postura, presença, dificuldades e decisão da primeira avaliação."
                      disabled={saving}
                    />
                  </div>
                </div>

                <div className="contracts-evaluation-card full">
                  <header>
                    <div>
                      <strong>Avaliação de experiência - 44 dias</strong>
                      <span>
                        Vencimento: {formatDate(form.experiencia_44_data || null)}
                      </span>
                    </div>
                  </header>

                  <div className="contracts-evaluation-grid">
                    <div className="contracts-field">
                      <label htmlFor="experience-44-date">
                        Data da avaliação
                      </label>
                      <input
                        id="experience-44-date"
                        type="date"
                        value={form.experiencia_44_data}
                        onChange={(event) =>
                          setForm((current) =>
                            current
                              ? {
                                  ...current,
                                  experiencia_44_data:
                                    event.target.value,
                                }
                              : current,
                          )
                        }
                        disabled={saving}
                      />
                    </div>

                    <div className="contracts-field">
                      <label htmlFor="experience-44-status">
                        Resultado
                      </label>
                      <select
                        id="experience-44-status"
                        value={form.experiencia_44_status}
                        onChange={(event) =>
                          setForm((current) =>
                            current
                              ? {
                                  ...current,
                                  experiencia_44_status:
                                    event.target
                                      .value as EvaluationStatus,
                                  avaliacao_anual_status:
                                    event.target.value === 'aprovado' &&
                                    current.avaliacao_anual_status ===
                                      'aguardando'
                                      ? 'pendente'
                                      : current.avaliacao_anual_status,
                                }
                              : current,
                          )
                        }
                        disabled={saving}
                      >
                        {evaluationOptions.map((option) => (
                          <option
                            key={option.value}
                            value={option.value}
                          >
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="contracts-field full">
                    <label htmlFor="experience-44-notes">
                      Parecer do RH/líder
                    </label>
                    <textarea
                      id="experience-44-notes"
                      rows={3}
                      value={form.experiencia_44_parecer}
                      onChange={(event) =>
                        setForm((current) =>
                          current
                            ? {
                                ...current,
                                experiencia_44_parecer:
                                  event.target.value,
                              }
                            : current,
                        )
                      }
                      placeholder="Registre evolução, qualidade do trabalho, relacionamento, aprendizado e decisão."
                      disabled={saving}
                    />
                  </div>
                </div>

                <div className="contracts-evaluation-card full">
                  <header>
                    <div>
                      <strong>Avaliação anual - 1 ano</strong>
                      <span>
                        Vencimento: {formatDate(form.avaliacao_anual_data || null)}
                      </span>
                    </div>
                  </header>

                  <div className="contracts-evaluation-grid">
                    <div className="contracts-field">
                      <label htmlFor="annual-date">
                        Data da avaliação
                      </label>
                      <input
                        id="annual-date"
                        type="date"
                        value={form.avaliacao_anual_data}
                        onChange={(event) =>
                          setForm((current) =>
                            current
                              ? {
                                  ...current,
                                  avaliacao_anual_data:
                                    event.target.value,
                                }
                              : current,
                          )
                        }
                        disabled={saving}
                      />
                    </div>

                    <div className="contracts-field">
                      <label htmlFor="annual-status">
                        Resultado
                      </label>
                      <select
                        id="annual-status"
                        value={form.avaliacao_anual_status}
                        onChange={(event) =>
                          setForm((current) =>
                            current
                              ? {
                                  ...current,
                                  avaliacao_anual_status:
                                    event.target
                                      .value as EvaluationStatus,
                                }
                              : current,
                          )
                        }
                        disabled={saving}
                      >
                        {evaluationOptions.map((option) => (
                          <option
                            key={option.value}
                            value={option.value}
                          >
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="contracts-field full">
                    <label htmlFor="annual-notes">
                      Parecer do RH/líder
                    </label>
                    <textarea
                      id="annual-notes"
                      rows={3}
                      value={form.avaliacao_anual_parecer}
                      onChange={(event) =>
                        setForm((current) =>
                          current
                            ? {
                                ...current,
                                avaliacao_anual_parecer:
                                  event.target.value,
                              }
                            : current,
                        )
                      }
                      placeholder="Registre avaliação de desempenho, evolução no cargo e próximos encaminhamentos."
                      disabled={saving}
                    />
                  </div>
                </div>

                <div className="contracts-field full">
                  <label htmlFor="contract-notes">
                    Observações
                  </label>
                  <textarea
                    id="contract-notes"
                    rows={4}
                    value={form.observacoes}
                    onChange={(event) =>
                      setForm((current) =>
                        current
                          ? {
                              ...current,
                              observacoes:
                                event.target.value,
                            }
                          : current,
                      )
                    }
                    disabled={saving}
                  />
                </div>
              </div>

              <footer>
                <button type="button" onClick={closeModal}>
                  Cancelar
                </button>
                <button
                  className="primary"
                  type="submit"
                  disabled={saving}
                >
                  {saving
                    ? 'Salvando...'
                    : 'Salvar contrato'}
                </button>
              </footer>
            </form>
          </section>
        </div>
      )}
    </>
  )
}

export default Contratos
