import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { supabase } from '../lib/supabase'
import { moverCurriculoDrive } from '../lib/googleDriveRh'
import SolicitacaoDocumentosModal from './SolicitacaoDocumentosModal'
import AdicionarCandidatoPipelineModal from './AdicionarCandidatoPipelineModal'
import './Pipeline.css'

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

type Candidato = {
  id: string
  numero: number
  nome_completo: string
  email: string | null
  whatsapp: string | null
  telefone: string | null
  cidade: string | null
  uf: string | null
}

type Vaga = {
  id: string
  numero: number
  cargo: string
  setor: string
  status: string
}

type Candidatura = {
  id: string
  candidato_id: string
  vaga_id: string
  etapa: CandidaturaEtapa
  status: CandidaturaStatus
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

type CardData = {
  candidatura: Candidatura
  candidato: Candidato
  vaga: Vaga
}

type StatusModalData = {
  candidaturaId: string
  candidatoNome: string
  status: CandidaturaStatus
}

type Perfil = {
  id: string
  full_name: string
  role: 'admin' | 'rh' | 'gestor' | 'consulta'
}

type InterviewStage =
  | 'entrevista_rh'
  | 'entrevista_gestor'

type InterviewModalData = {
  candidaturaId: string
  candidatoNome: string
  vagaLabel: string
  novaEtapa: InterviewStage
  tipo: 'rh' | 'gestor'
  inicio: string
  fim: string
  entrevistadorId: string
  gestorNome: string
  gestorEmail: string
  observacoes: string
}

type ProcessModalData = {
  candidaturaId: string
  candidatoNome: string
  vagaLabel: string
  tipo: 'teste' | 'exame'
  inicio: string
  local: string
  observacoes: string
  exameStatus:
    | 'em_andamento'
    | 'apto'
    | 'inapto'
    | 'cancelado'
}

const etapas: Array<{
  id: CandidaturaEtapa
  label: string
  shortLabel: string
}> = [
  { id: 'recebido', label: 'Recebido', shortLabel: 'Recebido' },
  {
    id: 'em_analise',
    label: 'Em análise',
    shortLabel: 'Em análise',
  },
  {
    id: 'entrevista_rh',
    label: 'Entrevista RH',
    shortLabel: 'Entrevista RH',
  },
  {
    id: 'entrevista_gestor',
    label: 'Entrevista com gestor',
    shortLabel: 'Entrevista com gestor',
  },
  {
    id: 'teste_pratico',
    label: 'Teste prático',
    shortLabel: 'Teste',
  },
  {
    id: 'documentacao',
    label: 'Documentação',
    shortLabel: 'Documentação',
  },
  {
    id: 'exame_admissional',
    label: 'Exame admissional',
    shortLabel: 'Exame',
  },
  {
    id: 'contratado',
    label: 'Contratado',
    shortLabel: 'Contratado',
  },
]

const statusLabels: Record<CandidaturaStatus, string> = {
  ativo: 'Ativo',
  reprovado: 'Reprovado',
  desistente: 'Desistente',
  suspenso: 'Suspenso',
  banco_talentos: 'Banco de talentos',
  contratado: 'Contratado',
}

function formatPhone(value: string | null) {
  if (!value) {
    return 'Sem telefone'
  }

  if (value.length === 11) {
    return `(${value.slice(0, 2)}) ${value.slice(2, 7)}-${value.slice(7)}`
  }

  if (value.length === 10) {
    return `(${value.slice(0, 2)}) ${value.slice(2, 6)}-${value.slice(6)}`
  }

  return value
}

function formatDate(value: string | null) {
  if (!value) {
    return 'Sem prazo'
  }

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return 'Sem prazo'
  }

  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
  }).format(date)
}

function daysSince(value: string) {
  const start = new Date(value).getTime()
  const now = Date.now()
  const difference = Math.max(0, now - start)
  return Math.floor(difference / 86_400_000)
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

function nullableText(value: string) {
  const normalized = value.trim()
  return normalized || null
}

function defaultInterviewPeriod() {
  const start = new Date()
  start.setSeconds(0, 0)
  start.setMinutes(Math.ceil(start.getMinutes() / 30) * 30)

  const end = new Date(start.getTime() + 30 * 60 * 1000)

  return {
    inicio: toLocalInput(start.toISOString()),
    fim: toLocalInput(end.toISOString()),
  }
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

function Pipeline() {
  const [candidatos, setCandidatos] = useState<Candidato[]>([])
  const [vagas, setVagas] = useState<Vaga[]>([])
  const [candidaturas, setCandidaturas] = useState<Candidatura[]>([])
  const [perfis, setPerfis] = useState<Perfil[]>([])
  const [vagaSelecionada, setVagaSelecionada] = useState('todas')
  const [statusSelecionado, setStatusSelecionado] =
    useState<'todos' | CandidaturaStatus>('ativo')
  const [pesquisa, setPesquisa] = useState('')
  const [carregando, setCarregando] = useState(true)
  const [movendoId, setMovendoId] = useState<string | null>(null)
  const [erro, setErro] = useState('')
  const [mensagem, setMensagem] = useState('')
  const [draggedId, setDraggedId] = useState<string | null>(null)
  const [statusModal, setStatusModal] =
    useState<StatusModalData | null>(null)
  const [statusObservacao, setStatusObservacao] = useState('')
  const [salvandoStatus, setSalvandoStatus] = useState(false)
  const [entrevistaModal, setEntrevistaModal] =
    useState<InterviewModalData | null>(null)
  const [salvandoEntrevista, setSalvandoEntrevista] =
    useState(false)
  const [processModal, setProcessModal] =
    useState<ProcessModalData | null>(null)
  const [salvandoProcesso, setSalvandoProcesso] =
    useState(false)
  const [documentacaoId, setDocumentacaoId] =
    useState<string | null>(null)
  const [finalizandoId, setFinalizandoId] =
    useState<string | null>(null)
  const [adicionarCandidatoAberto, setAdicionarCandidatoAberto] =
    useState(false)
  const [modoVisualizacao, setModoVisualizacao] = useState<
    'confortavel' | 'compacta'
  >('confortavel')

  const carregarDados = useCallback(async () => {
    setCarregando(true)
    setErro('')

    const [
      candidatosResult,
      vagasResult,
      candidaturasResult,
      perfisResult,
    ] = await Promise.all([
        supabase
          .from('candidatos')
          .select(
            'id, numero, nome_completo, email, whatsapp, telefone, cidade, uf',
          )
          .order('nome_completo'),

        supabase
          .from('vagas')
          .select('id, numero, cargo, setor, status')
          .order('numero', { ascending: false }),

        supabase
          .from('candidaturas')
          .select(
            `
              id,
              candidato_id,
              vaga_id,
              etapa,
              status,
              responsavel_id,
              data_entrada,
              proxima_acao,
              proxima_acao_em,
              motivo_reprovacao,
              parecer_final,
              observacoes,
              teste_inicio,
              teste_local,
              exame_inicio,
              exame_local,
              exame_status,
              created_at,
              updated_at
            `,
          )
          .order('updated_at', { ascending: false }),

        supabase
          .from('profiles')
          .select('id, full_name, role')
          .eq('active', true)
          .order('full_name'),
      ])

    if (candidatosResult.error) {
      console.error(
        'Erro ao carregar candidatos:',
        candidatosResult.error.message,
      )
      setErro('Não foi possível carregar os candidatos.')
      setCarregando(false)
      return
    }

    if (vagasResult.error) {
      console.error(
        'Erro ao carregar vagas:',
        vagasResult.error.message,
      )
      setErro('Não foi possível carregar as vagas.')
      setCarregando(false)
      return
    }

    if (candidaturasResult.error) {
      console.error(
        'Erro ao carregar candidaturas:',
        candidaturasResult.error.message,
      )
      setErro('Não foi possível carregar o pipeline.')
      setCarregando(false)
      return
    }

    if (perfisResult.error) {
      console.error(
        'Erro ao carregar entrevistadores:',
        perfisResult.error.message,
      )
      setErro(
        'Não foi possível carregar os entrevistadores disponíveis.',
      )
      setCarregando(false)
      return
    }

    setCandidatos((candidatosResult.data ?? []) as Candidato[])
    setVagas((vagasResult.data ?? []) as Vaga[])
    setCandidaturas(
      (candidaturasResult.data ?? []) as Candidatura[],
    )
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

  const cards = useMemo(() => {
    const candidatoMap = new Map(
      candidatos.map((candidato) => [candidato.id, candidato]),
    )
    const vagaMap = new Map(vagas.map((vaga) => [vaga.id, vaga]))

    return candidaturas
      .map((candidatura) => {
        const candidato = candidatoMap.get(candidatura.candidato_id)
        const vaga = vagaMap.get(candidatura.vaga_id)

        if (!candidato || !vaga) {
          return null
        }

        return {
          candidatura,
          candidato,
          vaga,
        } satisfies CardData
      })
      .filter((item): item is CardData => item !== null)
  }, [candidatos, candidaturas, vagas])

  const responsaveisRh = useMemo(
    () =>
      perfis.filter(
        (perfil) => perfil.role === 'rh',
      ),
    [perfis],
  )

  const documentacaoCard = documentacaoId
    ? cards.find(
        (card) =>
          card.candidatura.id === documentacaoId,
      ) ?? null
    : null

  const cardsFiltrados = useMemo(() => {
    const termo = pesquisa.trim().toLowerCase()

    return cards.filter((card) => {
      const atendeVaga =
        vagaSelecionada === 'todas' ||
        card.vaga.id === vagaSelecionada

      const atendeStatus =
        statusSelecionado === 'todos' ||
        card.candidatura.status === statusSelecionado

      const atendePesquisa =
        !termo ||
        card.candidato.nome_completo
          .toLowerCase()
          .includes(termo) ||
        card.vaga.cargo.toLowerCase().includes(termo) ||
        card.vaga.setor.toLowerCase().includes(termo) ||
        String(card.candidato.numero).includes(termo) ||
        String(card.vaga.numero).includes(termo)

      return atendeVaga && atendeStatus && atendePesquisa
    })
  }, [
    cards,
    pesquisa,
    statusSelecionado,
    vagaSelecionada,
  ])

  const contagemPorEtapa = useMemo(() => {
    return etapas.reduce<Record<CandidaturaEtapa, number>>(
      (accumulator, etapa) => {
        accumulator[etapa.id] = cardsFiltrados.filter(
          (card) => card.candidatura.etapa === etapa.id,
        ).length

        return accumulator
      },
      {
        recebido: 0,
        em_analise: 0,
        entrevista_rh: 0,
        entrevista_gestor: 0,
        teste_pratico: 0,
        exame_admissional: 0,
        documentacao: 0,
        contratado: 0,
      },
    )
  }, [cardsFiltrados])

  function abrirAgendamentoEntrevista(
    candidaturaId: string,
    novaEtapa: InterviewStage,
  ) {
    const card = cards.find(
      (item) => item.candidatura.id === candidaturaId,
    )

    if (!card) {
      setErro('Não foi possível localizar a candidatura.')
      setDraggedId(null)
      return
    }

    const period = defaultInterviewPeriod()

    setEntrevistaModal({
      candidaturaId,
      candidatoNome: card.candidato.nome_completo,
      vagaLabel: `VAG-${String(card.vaga.numero).padStart(
        6,
        '0',
      )} — ${card.vaga.cargo}`,
      novaEtapa,
      tipo:
        novaEtapa === 'entrevista_rh'
          ? 'rh'
          : 'gestor',
      inicio: period.inicio,
      fim: period.fim,
      entrevistadorId: '',
      gestorNome: '',
      gestorEmail: '',
      observacoes: '',
    })

    setDraggedId(null)
    setErro('')
    setMensagem('')
  }

  function fecharEntrevistaModal() {
    if (salvandoEntrevista) {
      return
    }

    setEntrevistaModal(null)
    setErro('')
  }


  async function sincronizarEntrevistaGoogle(
    entrevistaId: string,
  ) {
    const { data, error } = await supabase.functions.invoke(
      'sincronizar-entrevista-google',
      {
        body: { entrevistaId },
      },
    )

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

  async function salvarEntrevista() {
    if (!entrevistaModal) {
      return
    }

    setErro('')
    setMensagem('')

    if (!entrevistaModal.inicio || !entrevistaModal.fim) {
      setErro('Informe o início e o término da entrevista.')
      return
    }

    const inicio = new Date(entrevistaModal.inicio)
    const fim = new Date(entrevistaModal.fim)

    if (
      Number.isNaN(inicio.getTime()) ||
      Number.isNaN(fim.getTime()) ||
      fim <= inicio
    ) {
      setErro(
        'O horário final deve ser posterior ao horário inicial.',
      )
      return
    }

    if (
      entrevistaModal.tipo === 'gestor' &&
      !entrevistaModal.gestorNome.trim()
    ) {
      setErro('Informe o nome do gestor.')
      return
    }

    if (
      entrevistaModal.tipo === 'gestor' &&
      !validEmail(entrevistaModal.gestorEmail)
    ) {
      setErro('Informe um e-mail válido para o gestor.')
      return
    }

    setSalvandoEntrevista(true)

    const conflictBase = supabase
      .from('entrevistas')
      .select('id, tipo, inicio, fim')
      .in('status', ['agendada', 'confirmada'])
      .lt('inicio', fim.toISOString())
      .gt('fim', inicio.toISOString())

    const { data: candidateConflict, error: candidateConflictError } =
      await conflictBase
        .eq(
          'candidatura_id',
          entrevistaModal.candidaturaId,
        )
        .limit(1)
        .maybeSingle()

    if (candidateConflictError) {
      setSalvandoEntrevista(false)
      setErro('Não foi possível verificar conflitos de horário.')
      return
    }

    if (candidateConflict) {
      setSalvandoEntrevista(false)
      setErro(
        'O candidato já possui outra entrevista neste horário.',
      )
      return
    }

    if (entrevistaModal.entrevistadorId) {
      const { data: interviewerConflict, error: interviewerError } =
        await supabase
          .from('entrevistas')
          .select('id')
          .in('status', ['agendada', 'confirmada'])
          .eq(
            'entrevistador_id',
            entrevistaModal.entrevistadorId,
          )
          .lt('inicio', fim.toISOString())
          .gt('fim', inicio.toISOString())
          .limit(1)
          .maybeSingle()

      if (interviewerError) {
        setSalvandoEntrevista(false)
        setErro('Não foi possível verificar a agenda do entrevistador.')
        return
      }

      if (interviewerConflict) {
        setSalvandoEntrevista(false)
        setErro(
          'O entrevistador já possui uma entrevista neste horário.',
        )
        return
      }
    }

    if (entrevistaModal.tipo === 'gestor') {
      const { data: managerConflict, error: managerConflictError } =
        await supabase
          .from('entrevistas')
          .select('id')
          .in('status', ['agendada', 'confirmada'])
          .eq(
            'gestor_email',
            entrevistaModal.gestorEmail.trim().toLowerCase(),
          )
          .lt('inicio', fim.toISOString())
          .gt('fim', inicio.toISOString())
          .limit(1)
          .maybeSingle()

      if (managerConflictError) {
        setSalvandoEntrevista(false)
        setErro('Não foi possível verificar a agenda do gestor.')
        return
      }

      if (managerConflict) {
        setSalvandoEntrevista(false)
        setErro(
          'O gestor já possui uma entrevista neste horário.',
        )
        return
      }
    }

    const { data: existingInterview, error: existingError } =
      await supabase
        .from('entrevistas')
        .select('id')
        .eq(
          'candidatura_id',
          entrevistaModal.candidaturaId,
        )
        .eq('tipo', entrevistaModal.tipo)
        .in('status', ['agendada', 'confirmada'])
        .limit(1)
        .maybeSingle()

    if (existingError) {
      console.error(
        'Erro ao validar entrevista existente:',
        existingError.message,
      )
      setSalvandoEntrevista(false)
      setErro(
        'Não foi possível verificar a agenda da candidatura.',
      )
      return
    }

    if (existingInterview) {
      setSalvandoEntrevista(false)
      setErro(
        'Já existe uma entrevista deste tipo agendada ou confirmada para esta candidatura.',
      )
      return
    }

    const { data: createdInterview, error: interviewError } =
      await supabase
        .from('entrevistas')
        .insert({
          candidatura_id:
            entrevistaModal.candidaturaId,
          tipo: entrevistaModal.tipo,
          modalidade: 'google_meet',
          status: 'agendada',
          resultado: 'pendente',
          inicio: inicio.toISOString(),
          fim: fim.toISOString(),
          entrevistador_id:
            entrevistaModal.entrevistadorId || null,
          gestor_nome:
            entrevistaModal.tipo === 'gestor'
              ? entrevistaModal.gestorNome.trim()
              : null,
          gestor_email:
            entrevistaModal.tipo === 'gestor'
              ? entrevistaModal.gestorEmail
                  .trim()
                  .toLowerCase()
              : null,
          local: null,
          link_reuniao: null,
          observacoes: nullableText(
            entrevistaModal.observacoes,
          ),
        })
        .select('id')
        .single()

    if (interviewError || !createdInterview) {
      console.error(
        'Erro ao criar entrevista:',
        interviewError?.message,
      )
      setSalvandoEntrevista(false)
      setErro(
        'Não foi possível criar a entrevista na agenda.',
      )
      return
    }

    try {
      await sincronizarEntrevistaGoogle(createdInterview.id)
    } catch (syncError) {
      await supabase
        .from('entrevistas')
        .delete()
        .eq('id', createdInterview.id)

      setSalvandoEntrevista(false)
      setErro(
        syncError instanceof Error
          ? syncError.message
          : 'Não foi possível criar o evento no Google Agenda.',
      )
      return
    }

    const label =
      entrevistaModal.novaEtapa === 'entrevista_rh'
        ? 'Entrevista RH'
        : 'Entrevista com gestor'

    const { data: updatedApplication, error: applicationError } =
      await supabase
        .from('candidaturas')
        .update({
          etapa: entrevistaModal.novaEtapa,
          status: 'ativo',
          proxima_acao: label,
          proxima_acao_em: inicio.toISOString(),
          observacoes: `${label} agendada pela Pipeline.`,
        })
        .eq('id', entrevistaModal.candidaturaId)
        .select(
          `
            id,
            candidato_id,
            vaga_id,
            etapa,
            status,
            responsavel_id,
            data_entrada,
            proxima_acao,
            proxima_acao_em,
            motivo_reprovacao,
            parecer_final,
            observacoes,
            teste_inicio,
            teste_local,
            exame_inicio,
            exame_local,
            exame_status,
            created_at,
            updated_at
          `,
        )
        .single()

    if (applicationError) {
      console.error(
        'Erro ao mover candidatura após agendamento:',
        applicationError.message,
      )

      await supabase
        .from('entrevistas')
        .delete()
        .eq('id', createdInterview.id)

      setSalvandoEntrevista(false)
      setErro(
        'A entrevista não foi salva porque a candidatura não pôde ser movimentada.',
      )
      return
    }

    setCandidaturas((current) =>
      current.map((item) =>
        item.id === entrevistaModal.candidaturaId
          ? (updatedApplication as Candidatura)
          : item,
      ),
    )

    setEntrevistaModal(null)
    setSalvandoEntrevista(false)
    setMensagem(
      `${label} agendada, Google Meet criado e convite enviado.`,
    )
  }

  function abrirProcesso(
    candidaturaId: string,
    tipo: 'teste' | 'exame',
  ) {
    const card = cards.find(
      (item) => item.candidatura.id === candidaturaId,
    )

    if (!card) {
      setErro('Não foi possível localizar a candidatura.')
      setDraggedId(null)
      return
    }

    const savedStart =
      tipo === 'teste'
        ? card.candidatura.teste_inicio
        : card.candidatura.exame_inicio

    const start =
      savedStart ??
      new Date(
        Math.ceil(Date.now() / 1_800_000) * 1_800_000,
      ).toISOString()

    setProcessModal({
      candidaturaId,
      candidatoNome: card.candidato.nome_completo,
      vagaLabel: `VAG-${String(card.vaga.numero).padStart(
        6,
        '0',
      )} — ${card.vaga.cargo}`,
      tipo,
      inicio: toLocalInput(start),
      local:
        (tipo === 'teste'
          ? card.candidatura.teste_local
          : card.candidatura.exame_local) ?? '',
      observacoes: '',
      exameStatus:
        card.candidatura.exame_status ?? 'em_andamento',
    })

    setDraggedId(null)
    setErro('')
    setMensagem('')
  }

  function fecharProcessModal() {
    if (salvandoProcesso) {
      return
    }

    setProcessModal(null)
    setErro('')
  }

  async function salvarProcesso() {
    if (!processModal) {
      return
    }

    setErro('')
    setMensagem('')

    if (!processModal.inicio) {
      setErro(
        processModal.tipo === 'teste'
          ? 'Informe a data e o horário do teste.'
          : 'Informe a data e o horário do exame.',
      )
      return
    }

    if (!processModal.local.trim()) {
      setErro(
        processModal.tipo === 'teste'
          ? 'Informe o local do teste.'
          : 'Informe a clínica ou o local do exame.',
      )
      return
    }

    const inicio = new Date(processModal.inicio)

    if (Number.isNaN(inicio.getTime())) {
      setErro('Informe uma data e um horário válidos.')
      return
    }

    setSalvandoProcesso(true)

    const isTest = processModal.tipo === 'teste'
    const etapa: CandidaturaEtapa = isTest
      ? 'teste_pratico'
      : 'exame_admissional'
    const label = isTest
      ? 'Teste prático'
      : 'Exame admissional'

    const payload = isTest
      ? {
          etapa,
          status: 'ativo' as const,
          teste_inicio: inicio.toISOString(),
          teste_local: processModal.local.trim(),
          proxima_acao: label,
          proxima_acao_em: inicio.toISOString(),
          observacoes:
            processModal.observacoes.trim() ||
            `${label} agendado.`,
        }
      : {
          etapa,
          status: 'ativo' as const,
          exame_inicio: inicio.toISOString(),
          exame_local: processModal.local.trim(),
          exame_status: processModal.exameStatus,
          proxima_acao:
            processModal.exameStatus === 'apto'
              ? 'Exame admissional concluído: apto'
              : processModal.exameStatus === 'inapto'
                ? 'Exame admissional concluído: inapto'
                : label,
          proxima_acao_em: inicio.toISOString(),
          observacoes:
            processModal.observacoes.trim() ||
            `${label} registrado.`,
        }

    const { data, error } = await supabase
      .from('candidaturas')
      .update(payload)
      .eq('id', processModal.candidaturaId)
      .select(
        `
          id,
          candidato_id,
          vaga_id,
          etapa,
          status,
          responsavel_id,
          data_entrada,
          proxima_acao,
          proxima_acao_em,
          motivo_reprovacao,
          parecer_final,
          observacoes,
          teste_inicio,
          teste_local,
          exame_inicio,
          exame_local,
          exame_status,
          created_at,
          updated_at
        `,
      )
      .single()

    setSalvandoProcesso(false)

    if (error) {
      console.error(`Erro ao salvar ${label}:`, error.message)
      setErro(`Não foi possível salvar ${label.toLowerCase()}.`)
      return
    }

    setCandidaturas((current) =>
      current.map((item) =>
        item.id === processModal.candidaturaId
          ? (data as Candidatura)
          : item,
      ),
    )

    setProcessModal(null)
    setMensagem(
      isTest
        ? 'Teste prático agendado.'
        : 'Exame admissional atualizado e sincronizado com o Onboarding.',
    )
  }

  async function finalizarContratacao(
    candidaturaId: string,
  ) {
    setFinalizandoId(candidaturaId)
    setErro('')
    setMensagem('')

    const { data, error } = await supabase.functions.invoke(
      'finalizar-contratacao',
      {
        body: { candidaturaId },
      },
    )

    setFinalizandoId(null)
    setDraggedId(null)

    if (error || !data?.ok || !data?.candidature) {
      const message =
        data?.error ??
        (error
          ? await readFunctionError(
              error,
              'Não foi possível finalizar a contratação.',
            )
          : 'Não foi possível finalizar a contratação.')
      setErro(message)
      return
    }

    setCandidaturas((current) =>
      current.map((item) =>
        item.id === candidaturaId
          ? (data.candidature as Candidatura)
          : item,
      ),
    )

    setMensagem(
      data.message ??
        'Contratação finalizada e vaga fechada.',
    )
  }

  function onDocumentacaoSuccess(
    candidature: Candidatura,
    message: string,
  ) {
    setCandidaturas((current) =>
      current.map((item) =>
        item.id === candidature.id
          ? candidature
          : item,
      ),
    )
    setDocumentacaoId(null)
    setMensagem(message)
    setErro('')
  }

  async function moverCandidatura(
    candidaturaId: string,
    novaEtapa: CandidaturaEtapa,
  ) {
    const candidatura = candidaturas.find(
      (item) => item.id === candidaturaId,
    )

    if (!candidatura || candidatura.etapa === novaEtapa) {
      setDraggedId(null)
      return
    }

    if (
      novaEtapa === 'entrevista_rh' ||
      novaEtapa === 'entrevista_gestor'
    ) {
      abrirAgendamentoEntrevista(
        candidaturaId,
        novaEtapa,
      )
      return
    }

    if (novaEtapa === 'teste_pratico') {
      abrirProcesso(candidaturaId, 'teste')
      return
    }

    if (novaEtapa === 'documentacao') {
      setDocumentacaoId(candidaturaId)
      setDraggedId(null)
      setErro('')
      setMensagem('')
      return
    }

    if (novaEtapa === 'exame_admissional') {
      const { data: documentRequest, error: documentRequestError } =
        await supabase
          .from('solicitacoes_documentos')
          .select('id')
          .eq('candidatura_id', candidaturaId)
          .maybeSingle()

      if (documentRequestError) {
        setDraggedId(null)
        setErro(
          'Não foi possível verificar a documentação do candidato.',
        )
        return
      }

      if (!documentRequest) {
        setDraggedId(null)
        setErro(
          'Solicite os documentos antes de encaminhar o candidato ao exame admissional.',
        )
        return
      }

      abrirProcesso(candidaturaId, 'exame')
      return
    }

    if (novaEtapa === 'contratado') {
      await finalizarContratacao(candidaturaId)
      return
    }

    setMovendoId(candidaturaId)
    setErro('')
    setMensagem('')

    const novoStatus: CandidaturaStatus =
      candidatura.status === 'contratado'
        ? 'ativo'
        : candidatura.status

    const { data, error } = await supabase
      .from('candidaturas')
      .update({
        etapa: novaEtapa,
        status: novoStatus,
        observacoes: `Movido para ${etapas.find((item) => item.id === novaEtapa)?.label ?? novaEtapa}.`,
      })
      .eq('id', candidaturaId)
      .select(
        `
          id,
          candidato_id,
          vaga_id,
          etapa,
          status,
          responsavel_id,
          data_entrada,
          proxima_acao,
          proxima_acao_em,
          motivo_reprovacao,
          parecer_final,
          observacoes,
          created_at,
          updated_at
        `,
      )
      .single()

    setMovendoId(null)
    setDraggedId(null)

    if (error) {
      console.error(
        'Erro ao movimentar candidatura:',
        error.message,
      )
      setErro('Não foi possível movimentar o candidato.')
      return
    }

    setCandidaturas((current) =>
      current.map((item) =>
        item.id === candidaturaId
          ? (data as Candidatura)
          : item,
      ),
    )

    setMensagem('Candidato movimentado com sucesso.')
  }

  function abrirStatusModal(
    card: CardData,
    status: CandidaturaStatus,
  ) {
    setStatusObservacao(
      status === 'reprovado'
        ? card.candidatura.motivo_reprovacao ?? ''
        : card.candidatura.observacoes ?? '',
    )

    setStatusModal({
      candidaturaId: card.candidatura.id,
      candidatoNome: card.candidato.nome_completo,
      status,
    })

    setErro('')
    setMensagem('')
  }

  function fecharStatusModal() {
    if (salvandoStatus) {
      return
    }

    setStatusModal(null)
    setStatusObservacao('')
    setErro('')
  }

  async function salvarStatus() {
    if (!statusModal) {
      return
    }

    const observacao = statusObservacao.trim()

    if (
      statusModal.status === 'reprovado' &&
      observacao.length < 3
    ) {
      setErro('Informe o motivo da reprovação.')
      return
    }

    setSalvandoStatus(true)
    setErro('')

    const payload: {
      status: CandidaturaStatus
      etapa?: CandidaturaEtapa
      motivo_reprovacao?: string | null
      observacoes?: string | null
    } = {
      status: statusModal.status,
      observacoes: observacao || null,
    }

    if (statusModal.status === 'reprovado') {
      payload.motivo_reprovacao = observacao
    } else {
      payload.motivo_reprovacao = null
    }

    if (statusModal.status === 'contratado') {
      payload.etapa = 'contratado'
    }

    const { data, error } = await supabase
      .from('candidaturas')
      .update(payload)
      .eq('id', statusModal.candidaturaId)
      .select(
        `
          id,
          candidato_id,
          vaga_id,
          etapa,
          status,
          responsavel_id,
          data_entrada,
          proxima_acao,
          proxima_acao_em,
          motivo_reprovacao,
          parecer_final,
          observacoes,
          created_at,
          updated_at
        `,
      )
      .single()

    setSalvandoStatus(false)

    if (error) {
      console.error(
        'Erro ao atualizar situação:',
        error.message,
      )
      setErro('Não foi possível alterar a situação.')
      return
    }

    let avisoDrive = ''

    if (
      statusModal.status === 'reprovado' ||
      statusModal.status === 'banco_talentos'
    ) {
      try {
        await moverCurriculoDrive({
          candidaturaId: statusModal.candidaturaId,
          destino:
            statusModal.status === 'reprovado'
              ? 'reprovados'
              : 'banco_talentos',
        })
        avisoDrive = ' Currículo movido no Google Drive.'
      } catch (driveError) {
        console.error(
          'Erro ao mover currículo no Google Drive:',
          driveError,
        )
        avisoDrive =
          ' A situação foi atualizada, mas o currículo não foi movido no Google Drive.'
      }
    }

    setCandidaturas((current) =>
      current.map((item) =>
        item.id === statusModal.candidaturaId
          ? (data as Candidatura)
          : item,
      ),
    )

    setStatusModal(null)
    setStatusObservacao('')
    setMensagem(`Situação atualizada com sucesso.${avisoDrive}`)
  }

  function irParaEtapa(etapaId: CandidaturaEtapa) {
    document
      .getElementById(`pipeline-stage-${etapaId}`)
      ?.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'start',
      })
  }

  if (carregando) {
    return (
      <section className="pipeline-panel pipeline-loading">
        <div className="pipeline-loading-icon">PL</div>
        <p>Carregando pipeline...</p>
      </section>
    )
  }

  return (
    <>
      <section className="pipeline-panel">
        <header className="pipeline-header">
          <div>
            <span className="pipeline-eyebrow">
              Recrutamento
            </span>
            <h2>Pipeline de candidatos</h2>
            <p>
              Arraste os cartões entre as etapas do processo
              seletivo.
            </p>
          </div>

          <div className="pipeline-header-actions">
            <button
              className="pipeline-secondary-button"
              type="button"
              onClick={carregarDados}
            >
              Atualizar
            </button>

            <button
              className="pipeline-primary-button"
              type="button"
              onClick={() => {
                setAdicionarCandidatoAberto(true)
                setErro('')
                setMensagem('')
              }}
            >
              + Adicionar candidato
            </button>
          </div>
        </header>

        <div className="pipeline-toolbar">
          <div className="pipeline-field">
            <label htmlFor="pipeline-pesquisa">Pesquisar</label>
            <input
              id="pipeline-pesquisa"
              type="search"
              placeholder="Candidato, vaga ou setor..."
              value={pesquisa}
              onChange={(event) => setPesquisa(event.target.value)}
            />
          </div>

          <div className="pipeline-field">
            <label htmlFor="pipeline-vaga">Vaga</label>
            <select
              id="pipeline-vaga"
              value={vagaSelecionada}
              onChange={(event) =>
                setVagaSelecionada(event.target.value)
              }
            >
              <option value="todas">Todas as vagas</option>
              {vagas.map((vaga) => (
                <option key={vaga.id} value={vaga.id}>
                  VAG-{String(vaga.numero).padStart(6, '0')} —{' '}
                  {vaga.cargo}
                </option>
              ))}
            </select>
          </div>

          <div className="pipeline-field">
            <label htmlFor="pipeline-status">Situação</label>
            <select
              id="pipeline-status"
              value={statusSelecionado}
              onChange={(event) =>
                setStatusSelecionado(
                  event.target.value as
                    | 'todos'
                    | CandidaturaStatus,
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

          <div className="pipeline-summary">
            <span>Resultados</span>
            <strong>{cardsFiltrados.length}</strong>
          </div>

          <div className="pipeline-view-switch">
            <span>Visualização</span>

            <div>
              <button
                className={
                  modoVisualizacao === 'confortavel'
                    ? 'active'
                    : ''
                }
                type="button"
                onClick={() =>
                  setModoVisualizacao('confortavel')
                }
              >
                Confortável
              </button>

              <button
                className={
                  modoVisualizacao === 'compacta'
                    ? 'active'
                    : ''
                }
                type="button"
                onClick={() =>
                  setModoVisualizacao('compacta')
                }
              >
                Compacta
              </button>
            </div>
          </div>
        </div>

        <nav
          className="pipeline-stage-navigation"
          aria-label="Navegação pelas etapas"
        >
          {etapas.map((etapa) => (
            <button
              key={etapa.id}
              type="button"
              onClick={() => irParaEtapa(etapa.id)}
            >
              <span className={`stage-dot dot-${etapa.id}`} />
              <strong>{etapa.shortLabel}</strong>
              <small>{contagemPorEtapa[etapa.id]}</small>
            </button>
          ))}
        </nav>

        <div
          className={`pipeline-board-wrapper mode-${modoVisualizacao}`}
        >
          <div className="pipeline-board">
            {etapas.map((etapa) => {
              const cardsDaEtapa = cardsFiltrados.filter(
                (card) => card.candidatura.etapa === etapa.id,
              )

              return (
                <section
                  id={`pipeline-stage-${etapa.id}`}
                  className={
                    draggedId
                      ? 'pipeline-column drag-active'
                      : 'pipeline-column'
                  }
                  key={etapa.id}
                  onDragOver={(event) => {
                    event.preventDefault()
                  }}
                  onDrop={(event) => {
                    event.preventDefault()

                    if (draggedId) {
                      moverCandidatura(draggedId, etapa.id)
                    }
                  }}
                >
                  <header className="pipeline-column-header">
                    <div>
                      <span className={`stage-dot dot-${etapa.id}`} />
                      <strong>{etapa.shortLabel}</strong>
                    </div>

                    <span>{cardsDaEtapa.length}</span>
                  </header>

                  <div className="pipeline-column-content">
                    {cardsDaEtapa.map((card) => (
                      <article
                        className={
                          movendoId === card.candidatura.id ||
                          finalizandoId === card.candidatura.id
                            ? 'pipeline-card moving'
                            : 'pipeline-card'
                        }
                        key={card.candidatura.id}
                        draggable={
                          movendoId !== card.candidatura.id &&
                          finalizandoId !== card.candidatura.id
                        }
                        onDragStart={(event) => {
                          event.dataTransfer.effectAllowed = 'move'
                          event.dataTransfer.setData(
                            'text/plain',
                            card.candidatura.id,
                          )
                          setDraggedId(card.candidatura.id)
                        }}
                        onDragEnd={() => setDraggedId(null)}
                      >
                        <div className="pipeline-card-top">
                          <span className="pipeline-candidate-code">
                            CAN-
                            {String(
                              card.candidato.numero,
                            ).padStart(6, '0')}
                          </span>

                          <button
                            className="pipeline-card-menu"
                            type="button"
                            title="Opções de situação"
                            onClick={(event) => {
                              const menu =
                                event.currentTarget.nextElementSibling

                              if (menu instanceof HTMLElement) {
                                menu.hidden = !menu.hidden
                              }
                            }}
                          >
                            ⋮
                          </button>

                          <div
                            className="pipeline-status-menu"
                            hidden
                          >
                            {(
                              [
                                'ativo',
                                'suspenso',
                                'banco_talentos',
                                'desistente',
                                'reprovado',
                              ] as CandidaturaStatus[]
                            ).map((status) => (
                              <button
                                key={status}
                                type="button"
                                onClick={(event) => {
                                  const menu =
                                    event.currentTarget.parentElement

                                  if (menu) {
                                    menu.hidden = true
                                  }

                                  abrirStatusModal(card, status)
                                }}
                              >
                                {statusLabels[status]}
                              </button>
                            ))}
                          </div>
                        </div>

                        <h3>{card.candidato.nome_completo}</h3>

                        <div className="pipeline-vacancy">
                          <strong>
                            VAG-
                            {String(card.vaga.numero).padStart(
                              6,
                              '0',
                            )}{' '}
                            — {card.vaga.cargo}
                          </strong>
                          <span>{card.vaga.setor}</span>
                        </div>

                        <div className="pipeline-card-info">
                          <span>
                            {formatPhone(
                              card.candidato.whatsapp ??
                                card.candidato.telefone,
                            )}
                          </span>

                          <span>
                            {[card.candidato.cidade, card.candidato.uf]
                              .filter(Boolean)
                              .join(' / ') || 'Sem cidade'}
                          </span>
                        </div>

                        {card.candidatura.proxima_acao && (
                          <div className="pipeline-next-action">
                            <span>Próxima ação</span>
                            <strong>
                              {card.candidatura.proxima_acao}
                            </strong>
                            <small>
                              {formatDate(
                                card.candidatura.proxima_acao_em,
                              )}
                            </small>
                          </div>
                        )}

                        {(card.candidatura.etapa ===
                          'teste_pratico' ||
                          card.candidatura.etapa ===
                            'exame_admissional') && (
                          <div className="pipeline-card-process-actions">
                            <button
                              type="button"
                              onClick={() =>
                                abrirProcesso(
                                  card.candidatura.id,
                                  card.candidatura.etapa ===
                                    'teste_pratico'
                                    ? 'teste'
                                    : 'exame',
                                )
                              }
                            >
                              {card.candidatura.etapa ===
                              'teste_pratico'
                                ? 'Editar teste'
                                : 'Atualizar exame'}
                            </button>
                          </div>
                        )}

                        <footer className="pipeline-card-footer">
                          <span
                            className={`pipeline-status status-${card.candidatura.status}`}
                          >
                            {
                              statusLabels[
                                card.candidatura.status
                              ]
                            }
                          </span>

                          <span
                            className={
                              daysSince(
                                card.candidatura.updated_at,
                              ) >= 5
                                ? 'pipeline-days warning'
                                : 'pipeline-days'
                            }
                          >
                            {daysSince(
                              card.candidatura.updated_at,
                            )}{' '}
                            dia(s)
                          </span>
                        </footer>
                      </article>
                    ))}

                    {cardsDaEtapa.length === 0 && (
                      <div className="pipeline-empty-column">
                        Solte um candidato aqui
                      </div>
                    )}
                  </div>
                </section>
              )
            })}
          </div>
        </div>
      </section>

      {entrevistaModal && (
        <div
          className="pipeline-modal-overlay"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              fecharEntrevistaModal()
            }
          }}
        >
          <section
            className="pipeline-modal pipeline-interview-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="pipeline-interview-title"
          >
            <header className="pipeline-modal-header">
              <div>
                <span className="pipeline-eyebrow">
                  Agendamento
                </span>
                <h2 id="pipeline-interview-title">
                  {entrevistaModal.tipo === 'rh'
                    ? 'Entrevista RH'
                    : 'Entrevista com gestor'}
                </h2>
              </div>

              <button
                type="button"
                onClick={fecharEntrevistaModal}
                disabled={salvandoEntrevista}
                aria-label="Fechar"
              >
                ×
              </button>
            </header>

            <div className="pipeline-modal-body">
              <div className="pipeline-interview-summary">
                <div>
                  <span>Candidato</span>
                  <strong>
                    {entrevistaModal.candidatoNome}
                  </strong>
                </div>

                <div>
                  <span>Vaga</span>
                  <strong>{entrevistaModal.vagaLabel}</strong>
                </div>
              </div>

              <div className="pipeline-meet-fixed">
                <div className="pipeline-meet-fixed-icon">M</div>
                <div>
                  <strong>Entrevista pelo Google Meet</strong>
                  <span>
                    O link será criado automaticamente pela integração
                    com o Google Agenda.
                  </span>
                </div>
              </div>

              <div className="pipeline-form-grid">
                <div className="pipeline-field">
                  <label htmlFor="pipeline-interview-start">
                    Início *
                  </label>
                  <input
                    id="pipeline-interview-start"
                    type="datetime-local"
                    value={entrevistaModal.inicio}
                    onChange={(event) =>
                      setEntrevistaModal((current) =>
                        current
                          ? {
                              ...current,
                              inicio: event.target.value,
                              fim: endThirtyMinutesAfter(
                                event.target.value,
                              ),
                            }
                          : current,
                      )
                    }
                    disabled={salvandoEntrevista}
                  />
                </div>

                <div className="pipeline-field">
                  <label htmlFor="pipeline-interview-end">
                    Término *
                  </label>
                  <input
                    id="pipeline-interview-end"
                    type="datetime-local"
                    value={entrevistaModal.fim}
                    onChange={(event) =>
                      setEntrevistaModal((current) =>
                        current
                          ? {
                              ...current,
                              fim: event.target.value,
                            }
                          : current,
                      )
                    }
                    disabled={salvandoEntrevista}
                  />
                </div>

                <div className="pipeline-field">
                  <label htmlFor="pipeline-interviewer">
                    Entrevistador
                  </label>
                  <select
                    id="pipeline-interviewer"
                    value={
                      entrevistaModal.entrevistadorId
                    }
                    onChange={(event) =>
                      setEntrevistaModal((current) =>
                        current
                          ? {
                              ...current,
                              entrevistadorId:
                                event.target.value,
                            }
                          : current,
                      )
                    }
                    disabled={salvandoEntrevista}
                  >
                    <option value="">Não definido</option>
                    {perfis.map((perfil) => (
                      <option
                        key={perfil.id}
                        value={perfil.id}
                      >
                        {perfil.full_name}
                      </option>
                    ))}
                  </select>
                </div>

                {entrevistaModal.tipo === 'gestor' && (
                  <>
                    <div className="pipeline-field">
                      <label htmlFor="pipeline-manager-name">
                        Nome do gestor *
                      </label>
                      <input
                        id="pipeline-manager-name"
                        type="text"
                        value={entrevistaModal.gestorNome}
                        onChange={(event) =>
                          setEntrevistaModal((current) =>
                            current
                              ? {
                                  ...current,
                                  gestorNome:
                                    event.target.value,
                                }
                              : current,
                          )
                        }
                        placeholder="Nome completo do gestor"
                        disabled={salvandoEntrevista}
                      />
                    </div>

                    <div className="pipeline-field">
                      <label htmlFor="pipeline-manager-email">
                        E-mail do gestor *
                      </label>
                      <input
                        id="pipeline-manager-email"
                        type="email"
                        value={entrevistaModal.gestorEmail}
                        onChange={(event) =>
                          setEntrevistaModal((current) =>
                            current
                              ? {
                                  ...current,
                                  gestorEmail:
                                    event.target.value,
                                }
                              : current,
                          )
                        }
                        placeholder="gestor@empresa.com.br"
                        disabled={salvandoEntrevista}
                      />
                    </div>
                  </>
                )}

                <div className="pipeline-field full">
                  <label htmlFor="pipeline-interview-notes">
                    Observações
                  </label>
                  <textarea
                    id="pipeline-interview-notes"
                    rows={4}
                    value={entrevistaModal.observacoes}
                    onChange={(event) =>
                      setEntrevistaModal((current) =>
                        current
                          ? {
                              ...current,
                              observacoes:
                                event.target.value,
                            }
                          : current,
                      )
                    }
                    placeholder="Orientações para a entrevista..."
                    disabled={salvandoEntrevista}
                  />
                </div>
              </div>

              {erro && (
                <div className="pipeline-message error">
                  {erro}
                </div>
              )}
            </div>

            <footer className="pipeline-modal-actions">
              <button
                className="pipeline-secondary-button"
                type="button"
                onClick={fecharEntrevistaModal}
                disabled={salvandoEntrevista}
              >
                Cancelar
              </button>

              <button
                className="pipeline-primary-button"
                type="button"
                onClick={salvarEntrevista}
                disabled={salvandoEntrevista}
              >
                {salvandoEntrevista
                  ? 'Agendando...'
                  : 'Agendar e mover candidato'}
              </button>
            </footer>
          </section>
        </div>
      )}

      {processModal && (
        <div
          className="pipeline-modal-overlay"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              fecharProcessModal()
            }
          }}
        >
          <section
            className="pipeline-modal pipeline-process-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="pipeline-process-title"
          >
            <header className="pipeline-modal-header">
              <div>
                <span className="pipeline-eyebrow">
                  {processModal.tipo === 'teste'
                    ? 'Avaliação'
                    : 'Pré-admissão'}
                </span>
                <h2 id="pipeline-process-title">
                  {processModal.tipo === 'teste'
                    ? 'Agendar teste prático'
                    : 'Exame admissional'}
                </h2>
              </div>

              <button
                type="button"
                onClick={fecharProcessModal}
                disabled={salvandoProcesso}
                aria-label="Fechar"
              >
                ×
              </button>
            </header>

            <div className="pipeline-modal-body">
              <div className="pipeline-interview-summary">
                <div>
                  <span>Candidato</span>
                  <strong>{processModal.candidatoNome}</strong>
                </div>
                <div>
                  <span>Vaga</span>
                  <strong>{processModal.vagaLabel}</strong>
                </div>
              </div>

              <div className="pipeline-form-grid">
                <div className="pipeline-field">
                  <label htmlFor="pipeline-process-start">
                    Data e horário *
                  </label>
                  <input
                    id="pipeline-process-start"
                    type="datetime-local"
                    value={processModal.inicio}
                    onChange={(event) =>
                      setProcessModal((current) =>
                        current
                          ? {
                              ...current,
                              inicio: event.target.value,
                            }
                          : current,
                      )
                    }
                    disabled={salvandoProcesso}
                  />
                </div>

                <div className="pipeline-field">
                  <label htmlFor="pipeline-process-location">
                    {processModal.tipo === 'teste'
                      ? 'Local do teste *'
                      : 'Clínica ou local do exame *'}
                  </label>
                  <input
                    id="pipeline-process-location"
                    type="text"
                    value={processModal.local}
                    onChange={(event) =>
                      setProcessModal((current) =>
                        current
                          ? {
                              ...current,
                              local: event.target.value,
                            }
                          : current,
                      )
                    }
                    placeholder={
                      processModal.tipo === 'teste'
                        ? 'Informe onde o teste será realizado'
                        : 'Informe a clínica e/ou endereço'
                    }
                    disabled={salvandoProcesso}
                  />
                </div>

                {processModal.tipo === 'exame' && (
                  <div className="pipeline-field">
                    <label htmlFor="pipeline-exam-status">
                      Situação do exame
                    </label>
                    <select
                      id="pipeline-exam-status"
                      value={processModal.exameStatus}
                      onChange={(event) =>
                        setProcessModal((current) =>
                          current
                            ? {
                                ...current,
                                exameStatus:
                                  event.target.value as
                                    | 'em_andamento'
                                    | 'apto'
                                    | 'inapto'
                                    | 'cancelado',
                              }
                            : current,
                        )
                      }
                      disabled={salvandoProcesso}
                    >
                      <option value="em_andamento">
                        Em andamento
                      </option>
                      <option value="apto">Apto</option>
                      <option value="inapto">Inapto</option>
                      <option value="cancelado">Cancelado</option>
                    </select>
                  </div>
                )}

                <div className="pipeline-field full">
                  <label htmlFor="pipeline-process-notes">
                    Observações
                  </label>
                  <textarea
                    id="pipeline-process-notes"
                    rows={4}
                    value={processModal.observacoes}
                    onChange={(event) =>
                      setProcessModal((current) =>
                        current
                          ? {
                              ...current,
                              observacoes:
                                event.target.value,
                            }
                          : current,
                      )
                    }
                    disabled={salvandoProcesso}
                  />
                </div>
              </div>
            </div>

            <footer className="pipeline-modal-actions">
              <button
                className="pipeline-secondary-button"
                type="button"
                onClick={fecharProcessModal}
                disabled={salvandoProcesso}
              >
                Cancelar
              </button>
              <button
                className="pipeline-primary-button"
                type="button"
                onClick={salvarProcesso}
                disabled={salvandoProcesso}
              >
                {salvandoProcesso
                  ? 'Salvando...'
                  : processModal.tipo === 'teste'
                    ? 'Agendar teste'
                    : 'Salvar exame'}
              </button>
            </footer>
          </section>
        </div>
      )}

      {adicionarCandidatoAberto && (
        <AdicionarCandidatoPipelineModal
          candidatos={candidatos}
          vagas={vagas}
          responsaveisRh={responsaveisRh}
          candidaturas={candidaturas}
          onClose={() => setAdicionarCandidatoAberto(false)}
          onCreated={async (message) => {
            setMensagem(message)
            setErro('')
            await carregarDados()
          }}
          onError={(message) => {
            setErro(message)
            setMensagem('')
          }}
        />
      )}

      {documentacaoCard && (
        <SolicitacaoDocumentosModal
          candidaturaId={documentacaoCard.candidatura.id}
          candidato={{
            numero: documentacaoCard.candidato.numero,
            nome: documentacaoCard.candidato.nome_completo,
            email: documentacaoCard.candidato.email,
          }}
          vaga={{
            numero: documentacaoCard.vaga.numero,
            cargo: documentacaoCard.vaga.cargo,
            setor: documentacaoCard.vaga.setor,
          }}
          responsaveisRh={responsaveisRh}
          onClose={() => setDocumentacaoId(null)}
          onSuccess={onDocumentacaoSuccess}
        />
      )}

      {(erro || mensagem) && (
        <div
          className={
            erro
              ? 'pipeline-toast error'
              : 'pipeline-toast success'
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

      {statusModal && (
        <div
          className="pipeline-modal-overlay"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              fecharStatusModal()
            }
          }}
        >
          <section
            className="pipeline-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="pipeline-status-title"
          >
            <header className="pipeline-modal-header">
              <div>
                <span className="pipeline-eyebrow">
                  Situação do candidato
                </span>
                <h2 id="pipeline-status-title">
                  {statusLabels[statusModal.status]}
                </h2>
              </div>

              <button
                type="button"
                onClick={fecharStatusModal}
                disabled={salvandoStatus}
                aria-label="Fechar"
              >
                ×
              </button>
            </header>

            <div className="pipeline-modal-body">
              <p>
                Candidato: <strong>{statusModal.candidatoNome}</strong>
              </p>

              <div className="pipeline-field full">
                <label htmlFor="pipeline-status-observacao">
                  {statusModal.status === 'reprovado'
                    ? 'Motivo da reprovação *'
                    : 'Observação'}
                </label>

                <textarea
                  id="pipeline-status-observacao"
                  rows={4}
                  value={statusObservacao}
                  onChange={(event) =>
                    setStatusObservacao(event.target.value)
                  }
                  disabled={salvandoStatus}
                  placeholder={
                    statusModal.status === 'reprovado'
                      ? 'Informe o motivo da reprovação...'
                      : 'Registre uma observação, se necessário...'
                  }
                />
              </div>

              {erro && (
                <div className="pipeline-message error">
                  {erro}
                </div>
              )}
            </div>

            <footer className="pipeline-modal-actions">
              <button
                className="pipeline-secondary-button"
                type="button"
                onClick={fecharStatusModal}
                disabled={salvandoStatus}
              >
                Cancelar
              </button>

              <button
                className="pipeline-primary-button"
                type="button"
                onClick={salvarStatus}
                disabled={salvandoStatus}
              >
                {salvandoStatus
                  ? 'Salvando...'
                  : 'Confirmar alteração'}
              </button>
            </footer>
          </section>
        </div>
      )}
    </>
  )
}

export default Pipeline
