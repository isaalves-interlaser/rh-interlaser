import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from 'react'
import { supabase } from '../lib/supabase'
import './Agenda.css'

type EntrevistaTipo =
  | 'rh'
  | 'gestor'
  | 'tecnica'
  | 'pratica'
  | 'admissional'
  | 'outro'

type EntrevistaModalidade =
  | 'presencial'
  | 'google_meet'
  | 'teams'
  | 'zoom'
  | 'telefone'
  | 'outro'

type EntrevistaStatus =
  | 'agendada'
  | 'confirmada'
  | 'realizada'
  | 'cancelada'
  | 'nao_compareceu'

type EntrevistaResultado =
  | 'pendente'
  | 'aprovado'
  | 'aprovado_ressalvas'
  | 'reprovado'

type AgendaEventoTipo =
  | 'entrevista'
  | 'teste_pratico'
  | 'exame_admissional'

type Entrevista = {
  id: string
  candidatura_id: string
  tipo: EntrevistaTipo
  modalidade: EntrevistaModalidade
  status: EntrevistaStatus
  resultado: EntrevistaResultado
  inicio: string
  fim: string
  entrevistador_id: string | null
  gestor_nome: string | null
  gestor_email: string | null
  local: string | null
  link_reuniao: string | null
  google_event_id: string | null
  google_event_link: string | null
  google_sync_status: string
  google_sync_error: string | null
  observacoes: string | null
  parecer: string | null
  nota: number | null
  created_at: string
  updated_at: string
}

type Candidatura = {
  id: string
  candidato_id: string
  vaga_id: string
  status: string
  teste_inicio: string | null
  teste_local: string | null
  exame_inicio: string | null
  exame_local: string | null
  exame_status: 'em_andamento' | 'apto' | 'inapto' | null
}

type Candidato = {
  id: string
  nome_completo: string
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
}

type AgendaCard = {
  id: string
  tipoAgenda: AgendaEventoTipo
  titulo: string
  detalhe: string
  inicio: string
  fim: string | null
  local: string | null
  observacoes: string | null
  statusLabel: string
  statusClass: string
  candidato: Candidato
  vaga: Vaga
  entrevistador: Perfil | null
  entrevista: Entrevista | null
}

type EntrevistaForm = {
  candidatura_id: string
  tipo: EntrevistaTipo
  modalidade: EntrevistaModalidade
  status: EntrevistaStatus
  resultado: EntrevistaResultado
  inicio: string
  fim: string
  entrevistador_id: string
  gestor_nome: string
  gestor_email: string
  local: string
  link_reuniao: string
  observacoes: string
  parecer: string
  nota: string
}

const initialForm: EntrevistaForm = {
  candidatura_id: '',
  tipo: 'rh',
  modalidade: 'google_meet',
  status: 'agendada',
  resultado: 'pendente',
  inicio: '',
  fim: '',
  entrevistador_id: '',
  gestor_nome: '',
  gestor_email: '',
  local: '',
  link_reuniao: '',
  observacoes: '',
  parecer: '',
  nota: '',
}

const tipoLabels: Record<EntrevistaTipo, string> = {
  rh: 'Entrevista RH',
  gestor: 'Entrevista com gestor',
  tecnica: 'Entrevista técnica',
  pratica: 'Teste prático',
  admissional: 'Exame admissional',
  outro: 'Entrevista',
}

const agendaTipoLabels: Record<AgendaEventoTipo, string> = {
  entrevista: 'Entrevista',
  teste_pratico: 'Teste prático',
  exame_admissional: 'Exame admissional',
}

const agendaTipoHelp: Record<AgendaEventoTipo, string> = {
  entrevista: 'Compromissos de entrevista com candidato.',
  teste_pratico: 'Testes práticos agendados pela pipeline.',
  exame_admissional: 'Exames admissionais agendados pela pipeline.',
}

const agendaTipoClass: Record<AgendaEventoTipo, string> = {
  entrevista: 'kind-entrevista',
  teste_pratico: 'kind-teste',
  exame_admissional: 'kind-exame',
}

const statusLabels: Record<EntrevistaStatus, string> = {
  agendada: 'Agendada',
  confirmada: 'Confirmada',
  realizada: 'Realizada',
  cancelada: 'Cancelada',
  nao_compareceu: 'Não compareceu',
}

const resultadoLabels: Record<EntrevistaResultado, string> = {
  pendente: 'Pendente',
  aprovado: 'Aprovado',
  aprovado_ressalvas: 'Aprovado com ressalvas',
  reprovado: 'Reprovado',
}

function nullableText(value: string) {
  const normalized = value.trim()
  return normalized || null
}

function toLocalInput(value: string) {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return ''
  }

  const local = new Date(
    date.getTime() - date.getTimezoneOffset() * 60_000,
  )

  return local.toISOString().slice(0, 16)
}

function startOfToday() {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return today
}

function minInterviewInputValue() {
  return toLocalInput(startOfToday().toISOString())
}

function isScheduledStatus(status: EntrevistaStatus) {
  return status === 'agendada' || status === 'confirmada'
}

function toAgendaTipoFromEntrevista(
  tipo: EntrevistaTipo,
): AgendaEventoTipo {
  if (tipo === 'pratica') {
    return 'teste_pratico'
  }

  if (tipo === 'admissional') {
    return 'exame_admissional'
  }

  return 'entrevista'
}

function addMinutesIso(value: string, minutes: number) {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return null
  }

  return new Date(date.getTime() + minutes * 60_000).toISOString()
}

function exameStatusLabel(
  status: Candidatura['exame_status'],
) {
  if (status === 'apto') {
    return 'Apto'
  }

  if (status === 'inapto') {
    return 'Inapto'
  }

  return 'Agendado'
}

function exameStatusClass(
  status: Candidatura['exame_status'],
) {
  if (status === 'apto') {
    return 'status-realizada'
  }

  if (status === 'inapto') {
    return 'status-cancelada'
  }

  return 'status-confirmada'
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'full',
  }).format(new Date(value))
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

function endThirtyMinutesAfter(startValue: string) {
  const start = new Date(startValue)

  if (Number.isNaN(start.getTime())) {
    return ''
  }

  return toLocalInput(
    new Date(start.getTime() + 30 * 60 * 1000).toISOString(),
  )
}

function validEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())
}

async function readFunctionError(
  error: unknown,
  fallback: string,
) {
  const candidate = error as {
    message?: string
    context?: Response
  }

  if (candidate.context) {
    try {
      const body = await candidate.context.clone().json()
      if (body?.error) {
        return String(body.error)
      }
    } catch {
      // Usa a mensagem padrão.
    }
  }

  return candidate.message ?? fallback
}

function dateKey(value: Date | string) {
  const date = typeof value === 'string' ? new Date(value) : value
  const local = new Date(
    date.getTime() - date.getTimezoneOffset() * 60_000,
  )
  return local.toISOString().slice(0, 10)
}

function monthLabel(value: Date) {
  return new Intl.DateTimeFormat('pt-BR', {
    month: 'long',
    year: 'numeric',
  }).format(value)
}

function Agenda() {
  const [entrevistas, setEntrevistas] = useState<Entrevista[]>([])
  const [candidaturas, setCandidaturas] = useState<Candidatura[]>([])
  const [candidatos, setCandidatos] = useState<Candidato[]>([])
  const [vagas, setVagas] = useState<Vaga[]>([])
  const [perfis, setPerfis] = useState<Perfil[]>([])
  const [form, setForm] = useState<EntrevistaForm>(initialForm)
  const [entrevistaEditandoId, setEntrevistaEditandoId] =
    useState<string | null>(null)
  const [modalAberto, setModalAberto] = useState(false)
  const [carregando, setCarregando] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [excluindoId, setExcluindoId] = useState<string | null>(null)
  const [sincronizandoId, setSincronizandoId] =
    useState<string | null>(null)
  const [pesquisa, setPesquisa] = useState('')
  const [filtroStatus, setFiltroStatus] = useState<
    'todos' | EntrevistaStatus
  >('todos')
  const [filtroTipo, setFiltroTipo] = useState<
    'todos' | AgendaEventoTipo
  >('todos')
  const [erro, setErro] = useState('')
  const [mensagem, setMensagem] = useState('')
  const [modoVisualizacao, setModoVisualizacao] = useState<
    'lista' | 'calendario'
  >('lista')
  const [mesReferencia, setMesReferencia] = useState(() => {
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth(), 1)
  })

  const minInterviewDate = useMemo(() => minInterviewInputValue(), [])

  const carregarDados = useCallback(async () => {
    setCarregando(true)
    setErro('')

    const [
      entrevistasResult,
      candidaturasResult,
      candidatosResult,
      vagasResult,
      perfisResult,
    ] = await Promise.all([
      supabase
        .from('entrevistas')
        .select(
          `
            id,
            candidatura_id,
            tipo,
            modalidade,
            status,
            resultado,
            inicio,
            fim,
            entrevistador_id,
            gestor_nome,
            gestor_email,
            local,
            link_reuniao,
            google_event_id,
            google_event_link,
            google_sync_status,
            google_sync_error,
            observacoes,
            parecer,
            nota,
            created_at,
            updated_at
          `,
        )
        .order('inicio', { ascending: true }),

      supabase
        .from('candidaturas')
        .select(
          'id, candidato_id, vaga_id, status, teste_inicio, teste_local, exame_inicio, exame_local, exame_status',
        ),

      supabase
        .from('candidatos')
        .select('id, nome_completo')
        .order('nome_completo'),

      supabase
        .from('vagas')
        .select('id, numero, cargo, setor')
        .order('numero', { ascending: false }),

      supabase
        .from('profiles')
        .select('id, full_name, active')
        .eq('active', true)
        .order('full_name'),
    ])

    const error =
      entrevistasResult.error ??
      candidaturasResult.error ??
      candidatosResult.error ??
      vagasResult.error ??
      perfisResult.error

    if (error) {
      console.error('Erro ao carregar agenda:', error.message)
      setErro('Não foi possível carregar a agenda.')
      setCarregando(false)
      return
    }

    setEntrevistas((entrevistasResult.data ?? []) as Entrevista[])
    setCandidaturas(
      (candidaturasResult.data ?? []) as Candidatura[],
    )
    setCandidatos((candidatosResult.data ?? []) as Candidato[])
    setVagas((vagasResult.data ?? []) as Vaga[])
    setPerfis((perfisResult.data ?? []) as Perfil[])
    setCarregando(false)
  }, [])

  useEffect(() => {
    carregarDados()
  }, [carregarDados])

  useEffect(() => {
    if (!erro && !mensagem) {
      return
    }

    const timer = window.setTimeout(
      () => {
        setErro('')
        setMensagem('')
      },
      erro ? 8000 : 4500,
    )

    return () => window.clearTimeout(timer)
  }, [erro, mensagem])

  const cards = useMemo<AgendaCard[]>(() => {
    const candidatureMap = new Map(
      candidaturas.map((item) => [item.id, item]),
    )
    const candidateMap = new Map(
      candidatos.map((item) => [item.id, item]),
    )
    const vacancyMap = new Map(vagas.map((item) => [item.id, item]))
    const profileMap = new Map(
      perfis.map((item) => [item.id, item]),
    )

    const interviewCards: AgendaCard[] = entrevistas.flatMap(
      (entrevista) => {
        const candidatura = candidatureMap.get(
          entrevista.candidatura_id,
        )

        if (!candidatura) {
          return []
        }

        const candidato = candidateMap.get(
          candidatura.candidato_id,
        )
        const vaga = vacancyMap.get(candidatura.vaga_id)

        if (!candidato || !vaga) {
          return []
        }

        const tipoAgenda = toAgendaTipoFromEntrevista(
          entrevista.tipo,
        )

        const card: AgendaCard = {
          id: `entrevista-${entrevista.id}`,
          tipoAgenda,
          titulo: agendaTipoLabels[tipoAgenda],
          detalhe: tipoLabels[entrevista.tipo],
          inicio: entrevista.inicio,
          fim: entrevista.fim,
          local: entrevista.local,
          observacoes: entrevista.observacoes,
          statusLabel: statusLabels[entrevista.status],
          statusClass: `status-${entrevista.status}`,
          entrevista,
          candidato,
          vaga,
          entrevistador: entrevista.entrevistador_id
            ? profileMap.get(entrevista.entrevistador_id) ?? null
            : null,
        }

        return [card]
      },
    )

    const processCards: AgendaCard[] = candidaturas.flatMap((candidatura) => {
      const candidato = candidateMap.get(candidatura.candidato_id)
      const vaga = vacancyMap.get(candidatura.vaga_id)

      if (!candidato || !vaga) {
        return []
      }

      const eventos: AgendaCard[] = []

      if (candidatura.teste_inicio) {
        eventos.push({
          id: `teste-${candidatura.id}`,
          tipoAgenda: 'teste_pratico',
          titulo: 'Teste prático',
          detalhe: 'Teste prático agendado pela pipeline',
          inicio: candidatura.teste_inicio,
          fim: addMinutesIso(candidatura.teste_inicio, 60),
          local: candidatura.teste_local,
          observacoes: null,
          statusLabel: 'Agendado',
          statusClass: 'status-confirmada',
          entrevista: null,
          candidato,
          vaga,
          entrevistador: null,
        })
      }

      if (candidatura.exame_inicio) {
        eventos.push({
          id: `exame-${candidatura.id}`,
          tipoAgenda: 'exame_admissional',
          titulo: 'Exame admissional',
          detalhe: 'Exame admissional agendado pela pipeline',
          inicio: candidatura.exame_inicio,
          fim: addMinutesIso(candidatura.exame_inicio, 60),
          local: candidatura.exame_local,
          observacoes: null,
          statusLabel: exameStatusLabel(candidatura.exame_status),
          statusClass: exameStatusClass(candidatura.exame_status),
          entrevista: null,
          candidato,
          vaga,
          entrevistador: null,
        })
      }

      return eventos
    })

    return [...interviewCards, ...processCards].sort(
      (a, b) =>
        new Date(a.inicio).getTime() - new Date(b.inicio).getTime(),
    )
  }, [
    candidatos,
    candidaturas,
    entrevistas,
    perfis,
    vagas,
  ])

  const cardsFiltrados = useMemo<AgendaCard[]>(() => {
    const termo = pesquisa.trim().toLowerCase()

    return cards.filter((card) => {
      const atendeStatus =
        filtroStatus === 'todos' ||
        card.entrevista?.status === filtroStatus

      const atendeTipo =
        filtroTipo === 'todos' || card.tipoAgenda === filtroTipo

      const atendePesquisa =
        !termo ||
        card.candidato.nome_completo
          .toLowerCase()
          .includes(termo) ||
        card.vaga.cargo.toLowerCase().includes(termo) ||
        card.vaga.setor.toLowerCase().includes(termo) ||
        card.titulo.toLowerCase().includes(termo) ||
        card.local?.toLowerCase().includes(termo) ||
        card.entrevistador?.full_name
          .toLowerCase()
          .includes(termo)

      return atendeStatus && atendeTipo && atendePesquisa
    })
  }, [cards, filtroStatus, filtroTipo, pesquisa])

  const grupos = useMemo<[string, AgendaCard[]][]>(() => {
    const map = new Map<string, AgendaCard[]>()

    for (const card of cardsFiltrados) {
      const key = new Date(card.inicio)
        .toISOString()
        .slice(0, 10)

      const current = map.get(key) ?? []
      current.push(card)
      map.set(key, current)
    }

    return Array.from(map.entries()).sort(([a], [b]) =>
      a.localeCompare(b),
    )
  }, [cardsFiltrados])

  const calendarDays = useMemo<Array<{ date: Date; key: string; currentMonth: boolean; cards: AgendaCard[] }>>(() => {
    const year = mesReferencia.getFullYear()
    const month = mesReferencia.getMonth()
    const first = new Date(year, month, 1)
    const firstGridDay = new Date(year, month, 1 - first.getDay())

    return Array.from({ length: 42 }, (_, index) => {
      const date = new Date(firstGridDay)
      date.setDate(firstGridDay.getDate() + index)
      const key = dateKey(date)

      return {
        date,
        key,
        currentMonth: date.getMonth() === month,
        cards: cardsFiltrados.filter(
          (card) => dateKey(card.inicio) === key,
        ),
      }
    })
  }, [cardsFiltrados, mesReferencia])

  function changeMonth(offset: number) {
    setMesReferencia((current) =>
      new Date(
        current.getFullYear(),
        current.getMonth() + offset,
        1,
      ),
    )
  }

  function abrirNovaEntrevista() {
    const now = new Date()
    now.setMinutes(Math.ceil(now.getMinutes() / 30) * 30)
    const end = new Date(now.getTime() + 30 * 60 * 1000)

    setForm({
      ...initialForm,
      inicio: toLocalInput(now.toISOString()),
      fim: toLocalInput(end.toISOString()),
    })
    setEntrevistaEditandoId(null)
    setErro('')
    setMensagem('')
    setModalAberto(true)
  }

  function abrirEdicao(entrevista: Entrevista) {
    setForm({
      candidatura_id: entrevista.candidatura_id,
      tipo: entrevista.tipo,
      modalidade: 'google_meet',
      status: entrevista.status,
      resultado: entrevista.resultado,
      inicio: toLocalInput(entrevista.inicio),
      fim: toLocalInput(entrevista.fim),
      entrevistador_id: entrevista.entrevistador_id ?? '',
      gestor_nome: entrevista.gestor_nome ?? '',
      gestor_email: entrevista.gestor_email ?? '',
      local: entrevista.local ?? '',
      link_reuniao: entrevista.link_reuniao ?? '',
      observacoes: entrevista.observacoes ?? '',
      parecer: entrevista.parecer ?? '',
      nota:
        entrevista.nota === null ? '' : String(entrevista.nota),
    })
    setEntrevistaEditandoId(entrevista.id)
    setErro('')
    setMensagem('')
    setModalAberto(true)
  }

  function fecharModal() {
    if (salvando) {
      return
    }

    setModalAberto(false)
    setEntrevistaEditandoId(null)
    setForm(initialForm)
    setErro('')
  }


  async function sincronizarEntrevistaGoogle(
    entrevistaId: string,
  ) {
    setSincronizandoId(entrevistaId)

    const { data, error } = await supabase.functions.invoke(
      'sincronizar-entrevista-google',
      {
        body: { entrevistaId },
      },
    )

    setSincronizandoId(null)

    if (error) {
      throw new Error(
        data?.error ??
          (await readFunctionError(
            error,
            'Não foi possível conectar ao Google Agenda.',
          )),
      )
    }

    if (!data?.ok) {
      throw new Error(
        data?.error ??
          'O Google Agenda não confirmou o agendamento.',
      )
    }

    return data as {
      ok: true
      meetLink: string
      eventLink: string | null
    }
  }

  async function gerarGoogleMeet(entrevista: Entrevista) {
    setErro('')
    setMensagem('')

    try {
      await sincronizarEntrevistaGoogle(entrevista.id)
      setMensagem(
        'Google Meet criado e convite enviado ao candidato.',
      )
      await carregarDados()
    } catch (syncError) {
      setErro(
        syncError instanceof Error
          ? syncError.message
          : 'Não foi possível criar o Google Meet.',
      )
    }
  }

  async function salvarEntrevista(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault()
    setErro('')
    setMensagem('')

    if (!form.candidatura_id) {
      setErro('Selecione o candidato e a vaga.')
      return
    }

    if (!form.inicio || !form.fim) {
      setErro('Informe o início e o término.')
      return
    }

    const inicio = new Date(form.inicio)
    const fim = new Date(form.fim)

    if (
      Number.isNaN(inicio.getTime()) ||
      Number.isNaN(fim.getTime()) ||
      fim <= inicio
    ) {
      setErro('O horário final deve ser posterior ao inicial.')
      return
    }

    if (inicio < startOfToday()) {
      setErro('Não é permitido marcar entrevista em data anterior a hoje.')
      return
    }

    if (isScheduledStatus(form.status) && inicio < new Date()) {
      setErro(
        'Para entrevistas agendadas ou confirmadas, informe um horário a partir de agora.',
      )
      return
    }

    if (form.tipo === 'gestor' && !form.gestor_nome.trim()) {
      setErro('Informe o nome do gestor.')
      return
    }

    if (
      form.tipo === 'gestor' &&
      !validEmail(form.gestor_email)
    ) {
      setErro('Informe um e-mail válido para o gestor.')
      return
    }

    const nota = form.nota.trim() ? Number(form.nota) : null

    if (
      nota !== null &&
      (!Number.isFinite(nota) || nota < 0 || nota > 10)
    ) {
      setErro('A nota deve estar entre 0 e 10.')
      return
    }

    setSalvando(true)

    const candidateConflictQuery = supabase
      .from('entrevistas')
      .select('id')
      .eq('candidatura_id', form.candidatura_id)
      .in('status', ['agendada', 'confirmada'])
      .lt('inicio', fim.toISOString())
      .gt('fim', inicio.toISOString())

    if (entrevistaEditandoId) {
      candidateConflictQuery.neq('id', entrevistaEditandoId)
    }

    const {
      data: candidateConflict,
      error: candidateConflictError,
    } = await candidateConflictQuery.limit(1).maybeSingle()

    if (candidateConflictError) {
      setSalvando(false)
      setErro('Não foi possível verificar conflitos de horário.')
      return
    }

    if (candidateConflict) {
      setSalvando(false)
      setErro('O candidato já possui uma entrevista neste horário.')
      return
    }

    if (form.entrevistador_id) {
      const interviewerQuery = supabase
        .from('entrevistas')
        .select('id')
        .eq('entrevistador_id', form.entrevistador_id)
        .in('status', ['agendada', 'confirmada'])
        .lt('inicio', fim.toISOString())
        .gt('fim', inicio.toISOString())

      if (entrevistaEditandoId) {
        interviewerQuery.neq('id', entrevistaEditandoId)
      }

      const {
        data: interviewerConflict,
        error: interviewerConflictError,
      } = await interviewerQuery.limit(1).maybeSingle()

      if (interviewerConflictError) {
        setSalvando(false)
        setErro('Não foi possível verificar a agenda do entrevistador.')
        return
      }

      if (interviewerConflict) {
        setSalvando(false)
        setErro('O entrevistador já está ocupado neste horário.')
        return
      }
    }

    if (form.tipo === 'gestor') {
      const managerQuery = supabase
        .from('entrevistas')
        .select('id')
        .eq(
          'gestor_email',
          form.gestor_email.trim().toLowerCase(),
        )
        .in('status', ['agendada', 'confirmada'])
        .lt('inicio', fim.toISOString())
        .gt('fim', inicio.toISOString())

      if (entrevistaEditandoId) {
        managerQuery.neq('id', entrevistaEditandoId)
      }

      const {
        data: managerConflict,
        error: managerConflictError,
      } = await managerQuery.limit(1).maybeSingle()

      if (managerConflictError) {
        setSalvando(false)
        setErro('Não foi possível verificar a agenda do gestor.')
        return
      }

      if (managerConflict) {
        setSalvando(false)
        setErro('O gestor já está ocupado neste horário.')
        return
      }
    }

    const payload = {
      candidatura_id: form.candidatura_id,
      tipo: form.tipo,
      modalidade: 'google_meet',
      status: form.status,
      resultado: form.resultado,
      inicio: inicio.toISOString(),
      fim: fim.toISOString(),
      entrevistador_id: form.entrevistador_id || null,
      gestor_nome:
        form.tipo === 'gestor'
          ? form.gestor_nome.trim()
          : null,
      gestor_email:
        form.tipo === 'gestor'
          ? form.gestor_email.trim().toLowerCase()
          : null,
      local: null,
      link_reuniao: nullableText(form.link_reuniao),
      observacoes: nullableText(form.observacoes),
      parecer: nullableText(form.parecer),
      nota,
    }

    const result = entrevistaEditandoId
      ? await supabase
          .from('entrevistas')
          .update(payload)
          .eq('id', entrevistaEditandoId)
          .select()
          .single()
      : await supabase
          .from('entrevistas')
          .insert(payload)
          .select()
          .single()

    setSalvando(false)

    if (result.error || !result.data?.id) {
      console.error(
        'Erro ao salvar entrevista:',
        result.error?.message,
      )
      setErro('Não foi possível salvar a entrevista.')
      return
    }

    try {
      await sincronizarEntrevistaGoogle(result.data.id)
    } catch (syncError) {
      setErro(
        syncError instanceof Error
          ? `Entrevista salva, mas o Google Agenda falhou: ${syncError.message}`
          : 'Entrevista salva, mas o Google Agenda falhou.',
      )
      await carregarDados()
      return
    }

    setModalAberto(false)
    setEntrevistaEditandoId(null)
    setForm(initialForm)
    setMensagem(
      entrevistaEditandoId
        ? 'Entrevista e Google Meet atualizados.'
        : 'Entrevista, Google Meet e convite criados.',
    )

    await carregarDados()
  }

  async function atualizarStatus(
    entrevista: Entrevista,
    status: EntrevistaStatus,
  ) {
    setErro('')
    setMensagem('')

    const { error } = await supabase
      .from('entrevistas')
      .update({ status })
      .eq('id', entrevista.id)

    if (error) {
      console.error(
        'Erro ao atualizar entrevista:',
        error.message,
      )
      setErro('Não foi possível atualizar a entrevista.')
      return
    }

    setMensagem('Situação da entrevista atualizada.')
    await carregarDados()
  }

  async function excluirEntrevista(entrevista: Entrevista) {
    const confirmou = window.confirm(
      'Excluir definitivamente esta entrevista?',
    )

    if (!confirmou) {
      return
    }

    setExcluindoId(entrevista.id)
    setErro('')
    setMensagem('')

    const { error } = await supabase
      .from('entrevistas')
      .delete()
      .eq('id', entrevista.id)

    setExcluindoId(null)

    if (error) {
      console.error(
        'Erro ao excluir entrevista:',
        error.message,
      )
      setErro('Não foi possível excluir a entrevista.')
      return
    }

    setMensagem('Entrevista excluída com sucesso.')
    await carregarDados()
  }

  if (carregando) {
    return (
      <section className="agenda-panel agenda-loading">
        <div className="agenda-loading-icon">AG</div>
        <p>Carregando agenda...</p>
      </section>
    )
  }

  return (
    <>
      <section className="agenda-panel">
        <header className="agenda-header">
          <div>
            <span className="agenda-eyebrow">Recrutamento</span>
            <h2>Agenda do RH</h2>
            <p>
              Acompanhe entrevistas, testes práticos e exames admissionais
              com cores e filtros por tipo.
            </p>
          </div>

          <div className="agenda-header-actions">
            <button
              className="agenda-secondary-button"
              type="button"
              onClick={carregarDados}
            >
              Atualizar
            </button>

            <button
              className="agenda-primary-button"
              type="button"
              onClick={abrirNovaEntrevista}
            >
              + Agendar entrevista
            </button>
          </div>
        </header>

        <div className="agenda-toolbar">
          <div className="agenda-field">
            <label htmlFor="agenda-pesquisa">Pesquisar</label>
            <input
              id="agenda-pesquisa"
              type="search"
              placeholder="Candidato, vaga ou entrevistador..."
              value={pesquisa}
              onChange={(event) => setPesquisa(event.target.value)}
            />
          </div>

          <div className="agenda-field">
            <label htmlFor="agenda-status">Situação</label>
            <select
              id="agenda-status"
              value={filtroStatus}
              onChange={(event) =>
                setFiltroStatus(
                  event.target.value as
                    | 'todos'
                    | EntrevistaStatus,
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

          <div className="agenda-field">
            <label htmlFor="agenda-tipo-filtro">Tipo</label>
            <select
              id="agenda-tipo-filtro"
              value={filtroTipo}
              onChange={(event) =>
                setFiltroTipo(
                  event.target.value as
                    | 'todos'
                    | AgendaEventoTipo,
                )
              }
            >
              <option value="todos">Todos</option>
              {Object.entries(agendaTipoLabels).map(
                ([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ),
              )}
            </select>
          </div>

          <div className="agenda-view-switch">
            <span>Visualização</span>
            <div>
              <button
                className={
                  modoVisualizacao === 'lista'
                    ? 'active'
                    : ''
                }
                type="button"
                onClick={() => setModoVisualizacao('lista')}
              >
                Lista
              </button>
              <button
                className={
                  modoVisualizacao === 'calendario'
                    ? 'active'
                    : ''
                }
                type="button"
                onClick={() =>
                  setModoVisualizacao('calendario')
                }
              >
                Calendário
              </button>
            </div>
          </div>

          <div className="agenda-summary">
            <span>Total</span>
            <strong>{cardsFiltrados.length}</strong>
          </div>

          <div className="agenda-summary">
            <span>Confirmadas</span>
            <strong>
              {
                cardsFiltrados.filter(
                  (card) =>
                    card.entrevista?.status === 'confirmada' ||
                    card.statusClass === 'status-confirmada',
                ).length
              }
            </strong>
          </div>
        </div>

        <div className="agenda-legend" aria-label="Legenda da agenda">
          {Object.entries(agendaTipoLabels).map(([value, label]) => {
            const tipo = value as AgendaEventoTipo

            return (
              <span
                className={`agenda-legend-item ${agendaTipoClass[tipo]}`}
                key={value}
                title={agendaTipoHelp[tipo]}
              >
                <i aria-hidden="true" />
                {label}
              </span>
            )
          })}
        </div>

        {modoVisualizacao === 'lista' ? (
          <div className="agenda-content">
          {grupos.map(([date, group]) => (
            <section className="agenda-day" key={date}>
              <header className="agenda-day-header">
                <h3>{formatDate(group[0].inicio)}</h3>
                <span>{group.length} compromisso(s)</span>
              </header>

              <div className="agenda-list">
                {group.map((card) => (
                  <article
                    className={`agenda-card ${agendaTipoClass[card.tipoAgenda]}`}
                    key={card.id}
                  >
                    <div className={`agenda-time ${agendaTipoClass[card.tipoAgenda]}`}>
                      <strong>
                        {formatTime(card.inicio)}
                      </strong>
                      <span>
                        {card.fim ? `até ${formatTime(card.fim)}` : 'horário único'}
                      </span>
                    </div>

                    <div className="agenda-card-main">
                      <div className="agenda-card-title">
                        <div>
                          <h4>{card.candidato.nome_completo}</h4>
                          <span className={`agenda-kind-badge ${agendaTipoClass[card.tipoAgenda]}`}>
                            {card.titulo}
                          </span>
                          <span>
                            VAG-
                            {String(card.vaga.numero).padStart(
                              6,
                              '0',
                            )}{' '}
                            — {card.vaga.cargo}
                          </span>
                        </div>

                        <span
                          className={`agenda-status ${card.statusClass}`}
                        >
                          {card.statusLabel}
                        </span>
                      </div>

                      <div className="agenda-card-info">
                        <span>
                          {card.detalhe}
                        </span>
                        {card.entrevista ? (
                          <>
                            <span>Google Meet</span>
                            <span>
                              Entrevistador:{' '}
                              {card.entrevistador?.full_name ??
                                'Não definido'}
                            </span>
                            {card.entrevista.tipo === 'gestor' &&
                              card.entrevista.gestor_nome && (
                                <span>
                                  Gestor:{' '}
                                  {card.entrevista.gestor_nome}
                                </span>
                              )}
                          </>
                        ) : (
                          <span>Gerenciado pela Pipeline</span>
                        )}
                      </div>

                      {(card.local || card.entrevista?.link_reuniao) && (
                        <div className="agenda-location">
                          {card.local && <span>{card.local}</span>}
                          {card.entrevista?.link_reuniao && (
                            <a
                              href={card.entrevista.link_reuniao}
                              target="_blank"
                              rel="noreferrer"
                            >
                              Abrir Google Meet
                            </a>
                          )}
                        </div>
                      )}

                      {card.entrevista?.status === 'realizada' && (
                        <div className="agenda-result">
                          <span>
                            Resultado:{' '}
                            <strong>
                              {
                                resultadoLabels[
                                  card.entrevista.resultado
                                ]
                              }
                            </strong>
                          </span>

                          <span>
                            Nota:{' '}
                            <strong>
                              {card.entrevista.nota ?? '—'}
                            </strong>
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="agenda-actions">
                      {card.entrevista ? (
                        <>
                          {!card.entrevista.link_reuniao &&
                            !['cancelada', 'realizada'].includes(
                              card.entrevista.status,
                            ) && (
                              <button
                                className="primary"
                                type="button"
                                onClick={() =>
                                  gerarGoogleMeet(card.entrevista!)
                                }
                                disabled={
                                  sincronizandoId ===
                                  card.entrevista.id
                                }
                              >
                                {sincronizandoId ===
                                card.entrevista.id
                                  ? 'Gerando...'
                                  : 'Gerar Google Meet'}
                              </button>
                            )}

                          <button
                            type="button"
                            onClick={() =>
                              abrirEdicao(card.entrevista!)
                            }
                          >
                            Editar
                          </button>

                          {card.entrevista.status === 'agendada' && (
                            <button
                              className="primary"
                              type="button"
                              onClick={() =>
                                atualizarStatus(
                                  card.entrevista!,
                                  'confirmada',
                                )
                              }
                            >
                              Confirmar
                            </button>
                          )}

                          {![
                            'realizada',
                            'cancelada',
                            'nao_compareceu',
                          ].includes(card.entrevista.status) && (
                            <button
                              type="button"
                              onClick={() =>
                                atualizarStatus(
                                  card.entrevista!,
                                  'cancelada',
                                )
                              }
                            >
                              Cancelar
                            </button>
                          )}

                          <button
                            className="danger"
                            type="button"
                            onClick={() =>
                              excluirEntrevista(card.entrevista!)
                            }
                            disabled={
                              excluindoId === card.entrevista.id
                            }
                          >
                            {excluindoId === card.entrevista.id
                              ? 'Excluindo...'
                              : 'Excluir'}
                          </button>
                        </>
                      ) : (
                        <span className="agenda-pipeline-note">
                          Ajuste pela Pipeline
                        </span>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ))}

          {grupos.length === 0 && (
            <div className="agenda-empty">
              <div>AG</div>
              <strong>Nenhum compromisso encontrado</strong>
              <p>
                Agende uma entrevista ou altere os filtros de tipo e situação.
              </p>
            </div>
          )}
          </div>
        ) : (
          <div className="agenda-calendar">
            <header className="agenda-calendar-header">
              <button
                type="button"
                onClick={() => changeMonth(-1)}
                aria-label="Mês anterior"
              >
                ‹
              </button>

              <div>
                <strong>{monthLabel(mesReferencia)}</strong>
                <button
                  type="button"
                  onClick={() => {
                    const now = new Date()
                    setMesReferencia(
                      new Date(
                        now.getFullYear(),
                        now.getMonth(),
                        1,
                      ),
                    )
                  }}
                >
                  Hoje
                </button>
              </div>

              <button
                type="button"
                onClick={() => changeMonth(1)}
                aria-label="Próximo mês"
              >
                ›
              </button>
            </header>

            <div className="agenda-calendar-weekdays">
              {[
                'Dom',
                'Seg',
                'Ter',
                'Qua',
                'Qui',
                'Sex',
                'Sáb',
              ].map((day) => (
                <span key={day}>{day}</span>
              ))}
            </div>

            <div className="agenda-calendar-grid">
              {calendarDays.map((day) => (
                <section
                  className={
                    day.currentMonth
                      ? 'agenda-calendar-day'
                      : 'agenda-calendar-day outside'
                  }
                  key={day.key}
                >
                  <header>
                    <span>{day.date.getDate()}</span>
                    {day.cards.length > 0 && (
                      <small>{day.cards.length}</small>
                    )}
                  </header>

                  <div>
                    {day.cards.slice(0, 3).map((card) => (
                      <button
                        type="button"
                        className={`agenda-calendar-event ${agendaTipoClass[card.tipoAgenda]} ${card.statusClass}`}
                        key={card.id}
                        onClick={() =>
                          card.entrevista && abrirEdicao(card.entrevista)
                        }
                        title={`${formatTime(
                          card.inicio,
                        )} — ${
                          card.candidato.nome_completo
                        } — ${card.titulo}`}
                      >
                        <strong>
                          {formatTime(
                            card.inicio,
                          )}
                        </strong>
                        <span>
                          {card.candidato.nome_completo}
                        </span>
                      </button>
                    ))}

                    {day.cards.length > 3 && (
                      <small className="agenda-calendar-more">
                        +{day.cards.length - 3} compromisso(s)
                      </small>
                    )}
                  </div>
                </section>
              ))}
            </div>
          </div>
        )}
      </section>

      {(erro || mensagem) && (
        <div
          className={
            erro
              ? 'agenda-toast error'
              : 'agenda-toast success'
          }
          role={erro ? 'alert' : 'status'}
        >
          <div>
            <strong>{erro ? 'Não foi possível concluir' : 'Tudo certo'}</strong>
            <span>{erro || mensagem}</span>
          </div>
          <button
            type="button"
            onClick={() => {
              setErro('')
              setMensagem('')
            }}
            aria-label="Fechar mensagem"
          >
            ×
          </button>
        </div>
      )}

      {modalAberto && (
        <div
          className="agenda-modal-overlay"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              fecharModal()
            }
          }}
        >
          <section
            className="agenda-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="agenda-modal-title"
          >
            <header className="agenda-modal-header">
              <div>
                <span className="agenda-eyebrow">
                  {entrevistaEditandoId ? 'Edição' : 'Agenda'}
                </span>
                <h2 id="agenda-modal-title">
                  {entrevistaEditandoId
                    ? 'Editar entrevista'
                    : 'Agendar entrevista'}
                </h2>
              </div>

              <button
                type="button"
                onClick={fecharModal}
                disabled={salvando}
                aria-label="Fechar"
              >
                ×
              </button>
            </header>

            <form onSubmit={salvarEntrevista}>
              <div className="agenda-form-section">
                <div className="agenda-form-grid">
                  <div className="agenda-field full">
                    <label htmlFor="agenda-candidatura">
                      Candidato e vaga *
                    </label>
                    <select
                      id="agenda-candidatura"
                      value={form.candidatura_id}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          candidatura_id: event.target.value,
                        }))
                      }
                      disabled={salvando}
                    >
                      <option value="">Selecione</option>
                      {candidaturas.map((candidatura) => {
                        const candidato = candidatos.find(
                          (item) =>
                            item.id ===
                            candidatura.candidato_id,
                        )
                        const vaga = vagas.find(
                          (item) =>
                            item.id === candidatura.vaga_id,
                        )

                        if (!candidato || !vaga) {
                          return null
                        }

                        return (
                          <option
                            key={candidatura.id}
                            value={candidatura.id}
                          >
                            {candidato.nome_completo} — VAG-
                            {String(vaga.numero).padStart(
                              6,
                              '0',
                            )}{' '}
                            — {vaga.cargo}
                          </option>
                        )
                      })}
                    </select>
                  </div>

                  <div className="agenda-field">
                    <label htmlFor="agenda-tipo">Tipo *</label>
                    <select
                      id="agenda-tipo"
                      value={form.tipo}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          tipo:
                            event.target.value as EntrevistaTipo,
                        }))
                      }
                      disabled={salvando}
                    >
                      {([
                        ['rh', 'Entrevista'],
                        ['pratica', 'Teste prático'],
                        ['admissional', 'Exame admissional'],
                      ] as Array<[EntrevistaTipo, string]>).map(
                        ([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ),
                      )}
                    </select>
                  </div>

                  <div className="agenda-meet-fixed">
                    <div className="agenda-meet-fixed-icon">M</div>
                    <div>
                      <strong>Google Meet</strong>
                      <span>
                        O link será gerado automaticamente pelo
                        Google Agenda.
                      </span>
                    </div>
                  </div>

                  <div className="agenda-field">
                    <label htmlFor="agenda-inicio">
                      Início *
                    </label>
                    <input
                      id="agenda-inicio"
                      type="datetime-local"
                      min={minInterviewDate}
                      value={form.inicio}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          inicio: event.target.value,
                          fim: endThirtyMinutesAfter(
                            event.target.value,
                          ),
                        }))
                      }
                      disabled={salvando}
                    />
                  </div>

                  <div className="agenda-field">
                    <label htmlFor="agenda-fim">
                      Término *
                    </label>
                    <input
                      id="agenda-fim"
                      type="datetime-local"
                      min={form.inicio || minInterviewDate}
                      value={form.fim}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          fim: event.target.value,
                        }))
                      }
                      disabled={salvando}
                    />
                  </div>

                  <div className="agenda-field">
                    <label htmlFor="agenda-entrevistador">
                      Entrevistador
                    </label>
                    <select
                      id="agenda-entrevistador"
                      value={form.entrevistador_id}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          entrevistador_id:
                            event.target.value,
                        }))
                      }
                      disabled={salvando}
                    >
                      <option value="">Não definido</option>
                      {perfis.map((perfil) => (
                        <option key={perfil.id} value={perfil.id}>
                          {perfil.full_name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {form.tipo === 'gestor' && (
                    <>
                      <div className="agenda-field">
                        <label htmlFor="agenda-manager-name">
                          Nome do gestor *
                        </label>
                        <input
                          id="agenda-manager-name"
                          type="text"
                          value={form.gestor_nome}
                          onChange={(event) =>
                            setForm((current) => ({
                              ...current,
                              gestor_nome:
                                event.target.value,
                            }))
                          }
                          disabled={salvando}
                        />
                      </div>

                      <div className="agenda-field">
                        <label htmlFor="agenda-manager-email">
                          E-mail do gestor *
                        </label>
                        <input
                          id="agenda-manager-email"
                          type="email"
                          value={form.gestor_email}
                          onChange={(event) =>
                            setForm((current) => ({
                              ...current,
                              gestor_email:
                                event.target.value,
                            }))
                          }
                          disabled={salvando}
                        />
                      </div>
                    </>
                  )}

                  <div className="agenda-field">
                    <label htmlFor="agenda-status-form">
                      Situação
                    </label>
                    <select
                      id="agenda-status-form"
                      value={form.status}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          status:
                            event.target
                              .value as EntrevistaStatus,
                        }))
                      }
                      disabled={salvando}
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

                </div>

                <div className="agenda-field full space-top">
                  <label htmlFor="agenda-observacoes">
                    Observações
                  </label>
                  <textarea
                    id="agenda-observacoes"
                    rows={3}
                    value={form.observacoes}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        observacoes: event.target.value,
                      }))
                    }
                    disabled={salvando}
                  />
                </div>
              </div>

              <div className="agenda-form-section">
                <h3>Resultado da entrevista</h3>

                <div className="agenda-form-grid">
                  <div className="agenda-field">
                    <label htmlFor="agenda-resultado">
                      Resultado
                    </label>
                    <select
                      id="agenda-resultado"
                      value={form.resultado}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          resultado:
                            event.target
                              .value as EntrevistaResultado,
                        }))
                      }
                      disabled={salvando}
                    >
                      {Object.entries(resultadoLabels).map(
                        ([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ),
                      )}
                    </select>
                  </div>

                  <div className="agenda-field">
                    <label htmlFor="agenda-nota">
                      Nota de 0 a 10
                    </label>
                    <input
                      id="agenda-nota"
                      type="number"
                      min="0"
                      max="10"
                      step="0.1"
                      value={form.nota}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          nota: event.target.value,
                        }))
                      }
                      disabled={salvando}
                    />
                  </div>
                </div>

                <div className="agenda-field full space-top">
                  <label htmlFor="agenda-parecer">
                    Parecer
                  </label>
                  <textarea
                    id="agenda-parecer"
                    rows={4}
                    value={form.parecer}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        parecer: event.target.value,
                      }))
                    }
                    disabled={salvando}
                  />
                </div>
              </div>

              {erro && (
                <div className="agenda-message error">
                  {erro}
                </div>
              )}

              <footer className="agenda-modal-actions">
                <button
                  className="agenda-secondary-button"
                  type="button"
                  onClick={fecharModal}
                  disabled={salvando}
                >
                  Cancelar
                </button>

                <button
                  className="agenda-primary-button"
                  type="submit"
                  disabled={salvando}
                >
                  {salvando
                    ? 'Salvando...'
                    : entrevistaEditandoId
                      ? 'Salvar alterações'
                      : 'Agendar entrevista'}
                </button>
              </footer>
            </form>
          </section>
        </div>
      )}
    </>
  )
}

export default Agenda
