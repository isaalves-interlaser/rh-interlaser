import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from 'react'
import { supabase } from '../lib/supabase'
import { criarPastaVagaDrive, moverCurriculoDrive } from '../lib/googleDriveRh'
import './Vagas.css'

type VagaStatus =
  | 'aberta'
  | 'em_selecao'
  | 'suspensa'
  | 'preenchida'

type VagaPrioridade = 'normal' | 'alta' | 'urgente'
type VagaContrato =
  | 'clt'
  | 'pj'
  | 'temporario'
  | 'estagio'
  | 'aprendiz'
  | 'terceiro'
type VagaModalidade = 'presencial' | 'hibrido' | 'remoto'
type Empresa = {
  id: string
  razao_social: string | null
  nome_fantasia: string | null
}

type Filial = {
  id: string
  empresa_id: string
  codigo: string | null
  nome: string | null
}

type Candidatura = {
  id: string
  candidato_id: string
  vaga_id: string
  etapa: string
  status: string
  data_entrada: string
  motivo_reprovacao: string | null
  observacoes: string | null
}

type Candidato = {
  id: string
  numero: number
  nome_completo: string
  email: string | null
  whatsapp: string | null
  origem: string | null
  observacoes: string | null
  curriculo_path: string | null
  curriculo_drive_file_id: string | null
  curriculo_drive_url: string | null
  curriculo_drive_nome: string | null
}

type TriagemFiltro =
  | 'todos'
  | 'novos'
  | 'em_analise'
  | 'banco_talentos'
  | 'reprovados'


type BeneficioConfig = {
  codigo: string
  nome: string
  descricao: string | null
  active: boolean
  padrao: boolean
  ordem: number
}

type Vaga = {
  id: string
  numero: number
  empresa_id: string
  filial_id: string
  cargo: string
  setor: string
  tipo_contrato: VagaContrato
  modalidade: VagaModalidade
  prioridade: VagaPrioridade
  status: VagaStatus
  data_limite: string | null
  publicar_portal: boolean
  resumo_publico: string | null
  descricao_publica: string | null
  atividades: string | null
  requisitos: string | null
  beneficios: string | null
  horario_trabalho: string | null
  salario_faixa: string | null
  observacoes_publicas: string | null
  created_at: string
  drive_folder_id: string | null
  drive_folder_url: string | null
}

type VagaForm = {
  empresa_id: string
  filial_id: string
  cargo: string
  setor: string
  tipo_contrato: VagaContrato
  modalidade: VagaModalidade
  prioridade: VagaPrioridade
  status: VagaStatus
  data_limite: string
  publicar_portal: boolean
  resumo_publico: string
  descricao_publica: string
  atividades: string
  requisitos: string
  beneficios: string
  horario_trabalho: string
  salario_faixa: string
  observacoes_publicas: string
}

const initialForm: VagaForm = {
  empresa_id: '',
  filial_id: '',
  cargo: '',
  setor: '',
  tipo_contrato: 'clt',
  modalidade: 'presencial',
  prioridade: 'normal',
  status: 'aberta',
  data_limite: '',
  publicar_portal: false,
  resumo_publico: '',
  descricao_publica: '',
  atividades: '',
  requisitos: '',
  beneficios: '',
  horario_trabalho: '',
  salario_faixa: '',
  observacoes_publicas: '',
}

const statusLabels: Record<VagaStatus, string> = {
  aberta: 'Aberta',
  em_selecao: 'Em seleção',
  suspensa: 'Suspensa',
  preenchida: 'Fechada',
}

const statusCadastroOptions: VagaStatus[] = [
  'aberta',
  'suspensa',
  'preenchida',
]

const triagemFiltroLabels: Record<TriagemFiltro, string> = {
  todos: 'Todos',
  novos: 'Novos',
  em_analise: 'Em análise',
  banco_talentos: 'Banco de talentos',
  reprovados: 'Recusados',
}

const etapaLabels: Record<string, string> = {
  recebido: 'Recebido',
  em_analise: 'Em análise',
  entrevista_rh: 'Entrevista RH',
  entrevista_gestor: 'Entrevista com gestor',
  teste_pratico: 'Teste prático',
  exame_admissional: 'Exame admissional',
  documentacao: 'Documentação',
  contratado: 'Contratado',
}

const candidaturaStatusLabels: Record<string, string> = {
  ativo: 'Ativo',
  reprovado: 'Reprovado',
  desistente: 'Desistente',
  suspenso: 'Suspenso',
  banco_talentos: 'Banco de talentos',
  contratado: 'Contratado',
}

const prioridadeLabels: Record<VagaPrioridade, string> = {
  normal: 'Normal',
  alta: 'Alta',
  urgente: 'Urgente',
}

const contratoLabels: Record<VagaContrato, string> = {
  clt: 'CLT',
  pj: 'PJ',
  temporario: 'Temporário',
  estagio: 'Estágio',
  aprendiz: 'Aprendiz',
  terceiro: 'Terceiro',
}

const modalidadeLabels: Record<VagaModalidade, string> = {
  presencial: 'Presencial',
  hibrido: 'Híbrido',
  remoto: 'Remoto',
}


function formatDate(value: string | null) {
  if (!value) return '—'

  return new Intl.DateTimeFormat('pt-BR').format(
    new Date(`${value}T00:00:00`),
  )
}


function nomeEmpresa(empresa: Empresa | null | undefined) {
  return (
    empresa?.nome_fantasia?.trim() ||
    empresa?.razao_social?.trim() ||
    'Empresa não encontrada'
  )
}

function nomeFilial(filial: Filial | null | undefined) {
  if (!filial) return 'Filial não encontrada'

  const codigo = filial.codigo?.trim()
  const nome = filial.nome?.trim()

  if (codigo && nome) return `${codigo} — ${nome}`
  if (nome) return nome
  if (codigo) return codigo

  return 'Filial não encontrada'
}

function nullableText(value: string) {
  const normalized = value.trim()
  return normalized || null
}

function getPortalBaseUrl() {
  const configuredUrl = String(import.meta.env.VITE_APP_PUBLIC_URL ?? '')
    .trim()
    .replace(/\/$/, '')

  if (configuredUrl) return configuredUrl

  return window.location.origin.replace(/\/$/, '')
}

function getPortalVagaUrl(vagaId: string) {
  return `${getPortalBaseUrl()}/vagas/${vagaId}`
}

async function copyTextToClipboard(value: string) {
  try {
    if (navigator.clipboard?.writeText && window.isSecureContext) {
      await navigator.clipboard.writeText(value)
      return true
    }
  } catch {
    // Usa alternativa manual abaixo.
  }

  const textarea = document.createElement('textarea')
  textarea.value = value
  textarea.setAttribute('readonly', 'true')
  textarea.style.position = 'fixed'
  textarea.style.left = '-9999px'
  textarea.style.top = '0'
  document.body.appendChild(textarea)
  textarea.focus()
  textarea.select()

  try {
    const copied = document.execCommand('copy')
    document.body.removeChild(textarea)
    return copied
  } catch {
    document.body.removeChild(textarea)
    return false
  }
}

function beneficiosToText(beneficios: BeneficioConfig[]) {
  return beneficios
    .map((beneficio) => beneficio.nome.trim())
    .filter(Boolean)
    .join('\n')
}

function selectedBenefitNames(value: string) {
  return value
    .split('\n')
    .map((item) => item.trim())
    .filter(Boolean)
}


function labelFromMap(map: Record<string, string>, value: string) {
  return map[value] ?? value.replaceAll('_', ' ')
}

function getCandidatoInitials(nome: string) {
  const parts = nome
    .trim()
    .split(/\s+/)
    .filter(Boolean)

  if (parts.length === 0) return 'RH'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()

  return `${parts[0].charAt(0)}${parts[parts.length - 1].charAt(0)}`.toUpperCase()
}

function formatDateTime(value: string | null) {
  if (!value) return '—'

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) return '—'

  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date)
}

function getCurriculoUrl(candidato: Candidato | null) {
  if (!candidato) return ''

  return candidato.curriculo_drive_url || candidato.curriculo_path || ''
}

function getDriveFileIdFromUrl(value: string) {
  if (!value) return ''

  const filePathMatch = value.match(/\/file\/d\/([^/]+)/)
  if (filePathMatch?.[1]) return filePathMatch[1]

  try {
    const url = new URL(value)
    return url.searchParams.get('id') ?? ''
  } catch {
    return ''
  }
}

function getCurriculoPreviewUrl(candidato: Candidato | null) {
  if (!candidato) return ''

  const originalUrl = getCurriculoUrl(candidato)
  const fileId =
    candidato.curriculo_drive_file_id || getDriveFileIdFromUrl(originalUrl)

  if (fileId) {
    return `https://drive.google.com/file/d/${fileId}/preview`
  }

  if (originalUrl.includes('/view')) {
    return originalUrl.replace('/view', '/preview')
  }

  return originalUrl
}


function candidaturaEstaEmAnalise(candidatura: Candidatura) {
  return candidatura.status === 'ativo' && candidatura.etapa === 'em_analise'
}

function candidaturaEstaNoBancoTalentos(candidatura: Candidatura) {
  return candidatura.status === 'banco_talentos'
}

function candidaturaEstaRecusada(candidatura: Candidatura) {
  return candidatura.status === 'reprovado'
}

type VagasProps = {
  responsavelRhEmail?: string
  onOpenPipeline?: () => void
}

function Vagas({ responsavelRhEmail = '', onOpenPipeline }: VagasProps) {
  const [vagas, setVagas] = useState<Vaga[]>([])
  const [empresas, setEmpresas] = useState<Empresa[]>([])
  const [filiais, setFiliais] = useState<Filial[]>([])
  const [candidaturas, setCandidaturas] = useState<Candidatura[]>([])
  const [candidatos, setCandidatos] = useState<Candidato[]>([])
  const [beneficiosConfig, setBeneficiosConfig] = useState<BeneficioConfig[]>([])
  const [vagaDetalhesId, setVagaDetalhesId] = useState<string | null>(null)
  const [candidaturaSelecionadaId, setCandidaturaSelecionadaId] =
    useState<string | null>(null)
  const [filtroTriagem, setFiltroTriagem] =
    useState<TriagemFiltro>('todos')
  const [menuTriagemAbertoId, setMenuTriagemAbertoId] =
    useState<string | null>(null)
  const [salvandoTriagemId, setSalvandoTriagemId] =
    useState<string | null>(null)
  const [form, setForm] = useState<VagaForm>(initialForm)
  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [modalAberto, setModalAberto] = useState(false)
  const [carregando, setCarregando] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [excluindoId, setExcluindoId] = useState<string | null>(null)
  const [pesquisa, setPesquisa] = useState('')
  const [filtroStatus, setFiltroStatus] =
    useState<'todos' | VagaStatus>('todos')
  const [erro, setErro] = useState('')
  const [mensagem, setMensagem] = useState('')

  const carregarDados = useCallback(async () => {
    setCarregando(true)
    setErro('')

    const [
      empresasResult,
      filiaisResult,
      vagasResult,
      candidaturasResult,
      candidatosResult,
      beneficiosResult,
    ] = await Promise.all([
        supabase
          .from('empresas')
          .select('id, razao_social, nome_fantasia')
          .order('nome_fantasia'),
        supabase
          .from('filiais')
          .select('id, empresa_id, codigo, nome')
          .order('nome'),
        supabase
          .from('vagas')
          .select(
            'id, numero, empresa_id, filial_id, cargo, setor, tipo_contrato, modalidade, prioridade, status, data_limite, publicar_portal, resumo_publico, descricao_publica, atividades, requisitos, beneficios, horario_trabalho, salario_faixa, observacoes_publicas, created_at, drive_folder_id, drive_folder_url',
          )
          .order('created_at', { ascending: false }),
        supabase
          .from('candidaturas')
          .select('id, candidato_id, vaga_id, etapa, status, data_entrada, motivo_reprovacao, observacoes')
          .order('data_entrada', { ascending: false }),
        supabase
          .from('candidatos')
          .select('id, numero, nome_completo, email, whatsapp, origem, observacoes, curriculo_path, curriculo_drive_file_id, curriculo_drive_url, curriculo_drive_nome')
          .order('nome_completo'),
        supabase
          .from('beneficios_configuracao')
          .select('codigo, nome, descricao, active, padrao, ordem')
          .eq('active', true)
          .order('ordem')
          .order('nome'),
      ])

    if (
      empresasResult.error ||
      filiaisResult.error ||
      vagasResult.error ||
      candidaturasResult.error ||
      candidatosResult.error ||
      beneficiosResult.error
    ) {
      console.error(
        empresasResult.error ||
          filiaisResult.error ||
          vagasResult.error ||
          candidaturasResult.error ||
          candidatosResult.error ||
          beneficiosResult.error,
      )
      setErro('Não foi possível carregar os dados das vagas.')
      setCarregando(false)
      return
    }

    setEmpresas((empresasResult.data ?? []) as Empresa[])
    setFiliais((filiaisResult.data ?? []) as Filial[])
    setVagas((vagasResult.data ?? []) as Vaga[])
    setCandidaturas(
      (candidaturasResult.data ?? []) as Candidatura[],
    )
    setCandidatos((candidatosResult.data ?? []) as Candidato[])
    setBeneficiosConfig((beneficiosResult.data ?? []) as BeneficioConfig[])
    setCarregando(false)
  }, [])

  useEffect(() => {
    carregarDados()
  }, [carregarDados])


  useEffect(() => {
    if (!erro && !mensagem) {
      return
    }

    const timer = window.setTimeout(() => {
      setErro('')
      setMensagem('')
    }, 6000)

    return () => window.clearTimeout(timer)
  }, [erro, mensagem])

  const filiaisDisponiveis = useMemo(
    () =>
      filiais.filter(
        (filial) => filial.empresa_id === form.empresa_id,
      ),
    [filiais, form.empresa_id],
  )

  const beneficiosPadraoTexto = useMemo(
    () =>
      beneficiosToText(
        beneficiosConfig.filter((beneficio) => beneficio.padrao),
      ),
    [beneficiosConfig],
  )

  const beneficiosSelecionados = useMemo(
    () => selectedBenefitNames(form.beneficios),
    [form.beneficios],
  )

  const vagasFiltradas = useMemo(() => {
    const termo = pesquisa.trim().toLowerCase()

    return vagas.filter((vaga) => {
      const empresa = nomeEmpresa(
        empresas.find((item) => item.id === vaga.empresa_id),
      )
      const filial = nomeFilial(
        filiais.find((item) => item.id === vaga.filial_id),
      )

      const atendePesquisa =
        !termo ||
        vaga.cargo.toLowerCase().includes(termo) ||
        vaga.setor.toLowerCase().includes(termo) ||
        empresa.toLowerCase().includes(termo) ||
        filial.toLowerCase().includes(termo) ||
        String(vaga.numero).includes(termo)

      const atendeStatus =
        filtroStatus === 'todos' || vaga.status === filtroStatus

      return atendePesquisa && atendeStatus
    })
  }, [empresas, filiais, filtroStatus, pesquisa, vagas])

  const candidaturasPorVaga = useMemo(() => {
    const map = new Map<string, Candidatura[]>()

    for (const candidatura of candidaturas) {
      const current = map.get(candidatura.vaga_id) ?? []
      current.push(candidatura)
      map.set(candidatura.vaga_id, current)
    }

    return map
  }, [candidaturas])

  const contratadoPorVaga = useMemo(() => {
    const map = new Map<
      string,
      { candidatura: Candidatura; candidato: Candidato }
    >()

    for (const candidatura of candidaturas) {
      const contratado =
        candidatura.status === 'contratado' ||
        candidatura.etapa === 'contratado'

      if (!contratado || map.has(candidatura.vaga_id)) {
        continue
      }

      const candidato = candidatos.find(
        (item) => item.id === candidatura.candidato_id,
      )

      if (candidato) {
        map.set(candidatura.vaga_id, {
          candidatura,
          candidato,
        })
      }
    }

    return map
  }, [candidatos, candidaturas])

  const vagaDetalhes =
    vagas.find((vaga) => vaga.id === vagaDetalhesId) ?? null

  const candidaturasDaVaga = vagaDetalhes
    ? candidaturasPorVaga.get(vagaDetalhes.id) ?? []
    : []

  const candidatosPorId = useMemo(() => {
    return new Map(candidatos.map((candidato) => [candidato.id, candidato]))
  }, [candidatos])

  const candidatosDaVagaComDados = useMemo(() => {
    return candidaturasDaVaga
      .map((candidatura) => {
        const candidato = candidatosPorId.get(candidatura.candidato_id)

        if (!candidato) return null

        return { candidatura, candidato }
      })
      .filter(
        (item): item is { candidatura: Candidatura; candidato: Candidato } =>
          item !== null,
      )
  }, [candidaturasDaVaga, candidatosPorId])

  const candidatosDaVagaFiltrados = useMemo(() => {
    return candidatosDaVagaComDados.filter(({ candidatura }) => {
      if (filtroTriagem === 'todos') return true

      if (filtroTriagem === 'novos') {
        return candidatura.status === 'ativo' && candidatura.etapa === 'recebido'
      }

      if (filtroTriagem === 'em_analise') {
        return (
          candidatura.status === 'ativo' && candidatura.etapa === 'em_analise'
        )
      }

      if (filtroTriagem === 'banco_talentos') {
        return candidatura.status === 'banco_talentos'
      }

      if (filtroTriagem === 'reprovados') {
        return candidatura.status === 'reprovado'
      }

      return true
    })
  }, [candidatosDaVagaComDados, filtroTriagem])

  const triagemResumo = useMemo(() => {
    return candidatosDaVagaComDados.reduce(
      (acc, { candidatura }) => {
        acc.todos += 1

        if (candidatura.status === 'ativo' && candidatura.etapa === 'recebido') {
          acc.novos += 1
        }

        if (
          candidatura.status === 'ativo' &&
          candidatura.etapa === 'em_analise'
        ) {
          acc.em_analise += 1
        }

        if (candidatura.status === 'banco_talentos') {
          acc.banco_talentos += 1
        }

        if (candidatura.status === 'reprovado') {
          acc.reprovados += 1
        }

        return acc
      },
      {
        todos: 0,
        novos: 0,
        em_analise: 0,
        banco_talentos: 0,
        reprovados: 0,
      } as Record<TriagemFiltro, number>,
    )
  }, [candidatosDaVagaComDados])

  const candidatoTriagemSelecionado = useMemo(() => {
    return (
      candidatosDaVagaComDados.find(
        ({ candidatura }) => candidatura.id === candidaturaSelecionadaId,
      ) ??
      candidatosDaVagaFiltrados[0] ??
      candidatosDaVagaComDados[0] ??
      null
    )
  }, [
    candidaturaSelecionadaId,
    candidatosDaVagaComDados,
    candidatosDaVagaFiltrados,
  ])

  const curriculoSelecionadoUrl = getCurriculoUrl(
    candidatoTriagemSelecionado?.candidato ?? null,
  )
  const curriculoPreviewUrl = getCurriculoPreviewUrl(
    candidatoTriagemSelecionado?.candidato ?? null,
  )

  function abrirTriagem(vagaId: string) {
    setVagaDetalhesId(vagaId)
    setCandidaturaSelecionadaId(null)
    setFiltroTriagem('todos')
    setMenuTriagemAbertoId(null)
  }

  function fecharTriagem() {
    setVagaDetalhesId(null)
    setCandidaturaSelecionadaId(null)
    setFiltroTriagem('todos')
    setMenuTriagemAbertoId(null)
  }

  function abrirNovaVaga() {
    setForm({
      ...initialForm,
      beneficios: beneficiosPadraoTexto,
    })
    setEditandoId(null)
    setErro('')
    setMensagem('')
    setModalAberto(true)
  }

  function abrirEdicao(vaga: Vaga) {
    setForm({
      empresa_id: vaga.empresa_id,
      filial_id: vaga.filial_id,
      cargo: vaga.cargo,
      setor: vaga.setor,
      tipo_contrato: vaga.tipo_contrato,
      modalidade: vaga.modalidade,
      prioridade: vaga.prioridade,
      status: vaga.status,
      data_limite: vaga.data_limite ?? '',
      publicar_portal: vaga.publicar_portal ?? false,
      resumo_publico: vaga.resumo_publico ?? '',
      descricao_publica: vaga.descricao_publica ?? '',
      atividades: vaga.atividades ?? '',
      requisitos: vaga.requisitos ?? '',
      beneficios: vaga.beneficios ?? '',
      horario_trabalho: vaga.horario_trabalho ?? '',
      salario_faixa: vaga.salario_faixa ?? '',
      observacoes_publicas: vaga.observacoes_publicas ?? '',
    })
    setEditandoId(vaga.id)
    setErro('')
    setMensagem('')
    setModalAberto(true)
  }

  function fecharModal() {
    if (salvando) return

    setModalAberto(false)
    setEditandoId(null)
    setForm(initialForm)
    setErro('')
  }

  async function salvarVaga(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setErro('')
    setMensagem('')

    if (!form.empresa_id) {
      setErro('Selecione a empresa.')
      return
    }

    if (!form.filial_id) {
      setErro('Selecione a filial.')
      return
    }

    if (!form.cargo.trim() || !form.setor.trim()) {
      setErro('Informe o cargo e o setor.')
      return
    }


    setSalvando(true)

    const payload = {
      empresa_id: form.empresa_id,
      filial_id: form.filial_id,
      cargo: form.cargo.trim(),
      setor: form.setor.trim(),
      tipo_contrato: form.tipo_contrato,
      modalidade: form.modalidade,
      prioridade: form.prioridade,
      status: form.status,
      data_limite: form.data_limite || null,
      publicar_portal: form.publicar_portal,
      resumo_publico: nullableText(form.resumo_publico),
      descricao_publica: nullableText(form.descricao_publica),
      atividades: nullableText(form.atividades),
      requisitos: nullableText(form.requisitos),
      beneficios: nullableText(form.beneficios),
      horario_trabalho: nullableText(form.horario_trabalho),
      salario_faixa: nullableText(form.salario_faixa),
      observacoes_publicas: nullableText(form.observacoes_publicas),
    }

    const result = editandoId
      ? await supabase
          .from('vagas')
          .update(payload)
          .eq('id', editandoId)
          .select()
          .single()
      : await supabase
          .from('vagas')
          .insert({
            ...payload,
            quantidade: 1,
            motivo: 'outro',
            justificativa: 'Cadastro simplificado pelo RH',
          })
          .select()
          .single()

    setSalvando(false)

    if (result.error) {
      console.error('Erro ao salvar vaga:', result.error.message)
      setErro(
        editandoId
          ? 'Não foi possível atualizar a vaga.'
          : 'Não foi possível criar a vaga.',
      )
      return
    }

    let avisoDrive = ''

    if (!editandoId) {
      const vagaCriada = result.data as Vaga

      try {
        await criarPastaVagaDrive(vagaCriada.id)
        avisoDrive = ' Pasta do Google Drive criada.'
      } catch (driveError) {
        console.error(
          'Erro ao criar pasta da vaga no Google Drive:',
          driveError,
        )
        avisoDrive =
          ' A vaga foi salva, mas a pasta do Google Drive não foi criada.'
      }
    }

    setModalAberto(false)
    setEditandoId(null)
    setForm(initialForm)
    setMensagem(
      editandoId
        ? 'Vaga atualizada com sucesso.'
        : `Vaga criada com sucesso.${avisoDrive}`, 
    )

    await carregarDados()
  }

  async function copiarLinkDaVaga(vaga: Vaga) {
    setErro('')
    setMensagem('')

    if (!vaga.publicar_portal || vaga.status !== 'aberta') {
      setErro(
        'Para copiar o link público, deixe a vaga com Status Aberta e Publicar no portal = Sim.',
      )
      return
    }

    const link = getPortalVagaUrl(vaga.id)
    const copied = await copyTextToClipboard(link)

    if (copied) {
      setMensagem(
        `Link da vaga VAG-${String(vaga.numero).padStart(6, '0')} copiado com sucesso.`,
      )
      return
    }

    window.prompt('Copie o link da vaga:', link)
    setMensagem('Link da vaga gerado. Copie pela janela exibida.')
  }

  function toggleBeneficio(nome: string) {
    setForm((atual) => {
      const atuais = selectedBenefitNames(atual.beneficios)
      const existe = atuais.includes(nome)
      const proximos = existe
        ? atuais.filter((item) => item !== nome)
        : [...atuais, nome]

      return {
        ...atual,
        beneficios: proximos.join('\n'),
      }
    })
  }

  function abrirPipelineDaTriagem() {
    setMenuTriagemAbertoId(null)

    if (onOpenPipeline) {
      onOpenPipeline()
      return
    }

    window.location.assign('/sistema/pipeline')
  }

  async function atualizarTriagemCurriculo(
    candidatura: Candidatura,
    acao: 'em_analise' | 'banco_talentos' | 'reprovar',
  ) {
    setErro('')
    setMensagem('')
    setMenuTriagemAbertoId(null)

    const payload: Partial<Candidatura> = {}
    let mensagemSucesso = ''
    let destinoDrive: 'reprovados' | 'banco_talentos' | null = null

    if (acao === 'em_analise') {
      payload.etapa = 'em_analise'
      payload.status = 'ativo'
      payload.motivo_reprovacao = null
      mensagemSucesso = 'Candidato movido para Em análise.'
    }

    if (acao === 'banco_talentos') {
      const confirmou = window.confirm(
        'Mover este candidato para Banco de Talentos?',
      )

      if (!confirmou) return

      payload.status = 'banco_talentos'
      payload.motivo_reprovacao = null
      destinoDrive = 'banco_talentos'
      mensagemSucesso = 'Candidato movido para Banco de Talentos.'
    }

    if (acao === 'reprovar') {
      const motivo = window.prompt(
        'Informe o motivo da recusa. Essa informação fica interna para o RH:',
      )

      if (motivo === null) return

      const motivoNormalizado = motivo.trim()

      if (!motivoNormalizado) {
        setErro('Informe o motivo da recusa para continuar.')
        return
      }

      payload.status = 'reprovado'
      payload.motivo_reprovacao = motivoNormalizado
      destinoDrive = 'reprovados'
      mensagemSucesso = 'Candidato recusado com sucesso.'
    }

    setSalvandoTriagemId(candidatura.id)

    const { data, error } = await supabase
      .from('candidaturas')
      .update(payload)
      .eq('id', candidatura.id)
      .select(
        'id, candidato_id, vaga_id, etapa, status, data_entrada, motivo_reprovacao, observacoes',
      )
      .single()

    if (error) {
      console.error('Erro ao atualizar triagem:', error.message)
      setSalvandoTriagemId(null)
      setErro('Não foi possível atualizar a situação do candidato.')
      return
    }

    let avisoDrive = ''

    if (destinoDrive) {
      try {
        await moverCurriculoDrive({
          candidaturaId: candidatura.id,
          destino: destinoDrive,
        })
        avisoDrive = ' Currículo movido no Google Drive.'
      } catch (driveError) {
        console.error('Erro ao mover currículo no Google Drive:', driveError)
        avisoDrive =
          ' A situação foi atualizada, mas o currículo não foi movido no Google Drive.'
      }
    }

    setCandidaturas((atuais) =>
      atuais.map((item) =>
        item.id === candidatura.id ? (data as Candidatura) : item,
      ),
    )
    setCandidaturaSelecionadaId(candidatura.id)
    setSalvandoTriagemId(null)
    setMensagem(`${mensagemSucesso}${avisoDrive}`)
  }

  async function excluirVaga(vaga: Vaga) {
    setErro('')
    setMensagem('')

    const totalCandidaturas =
      candidaturasPorVaga.get(vaga.id)?.length ?? 0

    if (totalCandidaturas > 0) {
      setErro(
        'Esta vaga possui candidatos vinculados e não pode ser excluída. Altere o status para “Suspensa” ou “Fechada”.',
      )
      return
    }

    const confirmou = window.confirm(
      `Excluir a vaga VAG-${String(vaga.numero).padStart(6, '0')} — ${vaga.cargo}?`,
    )

    if (!confirmou) return

    setExcluindoId(vaga.id)

    const { error } = await supabase
      .from('vagas')
      .delete()
      .eq('id', vaga.id)

    setExcluindoId(null)

    if (error) {
      console.error('Erro ao excluir vaga:', error.message)
      setErro('Não foi possível excluir a vaga.')
      return
    }

    setVagas((atuais) =>
      atuais.filter((item) => item.id !== vaga.id),
    )
    setMensagem('Vaga excluída com sucesso.')
  }

  if (carregando) {
    return (
      <section className="vacancies-panel vacancies-loading">
        <div className="vacancies-loading-icon">VG</div>
        <p>Carregando vagas...</p>
      </section>
    )
  }

  return (
    <>
      <section className="vacancies-panel">
        <header className="vacancies-header">
          <div>
            <span className="vacancies-eyebrow">Recrutamento</span>
            <h2>Gestão de vagas</h2>
            <p>
              Cadastre, edite, acompanhe e encerre solicitações de
              contratação.
            </p>
          </div>

          <div className="vacancies-header-actions">
            <button
              className="vacancies-secondary-button"
              type="button"
              onClick={carregarDados}
            >
              Atualizar
            </button>

            <button
              className="vacancies-primary-button"
              type="button"
              onClick={abrirNovaVaga}
            >
              + Nova vaga
            </button>
          </div>
        </header>

        <div className="vacancies-toolbar">
          <div className="vacancies-search">
            <label htmlFor="pesquisa-vaga">Pesquisar</label>
            <input
              id="pesquisa-vaga"
              type="search"
              placeholder="Código, cargo, setor ou unidade..."
              value={pesquisa}
              onChange={(event) => setPesquisa(event.target.value)}
            />
          </div>

          <div className="vacancies-filter">
            <label htmlFor="filtro-status-vaga">Status</label>
            <select
              id="filtro-status-vaga"
              value={filtroStatus}
              onChange={(event) =>
                setFiltroStatus(
                  event.target.value as 'todos' | VagaStatus,
                )
              }
            >
              <option value="todos">Todos</option>
              {Object.entries(statusLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          <div className="vacancies-summary">
            <span>Total</span>
            <strong>{vagas.length}</strong>
          </div>
        </div>


        <div className="vacancies-table-wrapper">
          <table className="vacancies-table">
            <thead>
              <tr>
                <th>Código</th>
                <th>Cargo</th>
                <th>Empresa / filial</th>
                <th>Contrato</th>
                <th>Candidatos</th>
                <th>Drive</th>
                <th>Contratado</th>
                <th>Status</th>
                <th>Portal</th>
                <th>Prioridade</th>
                <th>Prazo</th>
                <th aria-label="Ações" />
              </tr>
            </thead>

            <tbody>
              {vagasFiltradas.map((vaga) => {
                const empresa = empresas.find(
                  (item) => item.id === vaga.empresa_id,
                )
                const filial = filiais.find(
                  (item) => item.id === vaga.filial_id,
                )
                const contratado = contratadoPorVaga.get(vaga.id)

                return (
                  <tr key={vaga.id}>
                    <td>
                      <strong className="vacancy-code">
                        VAG-{String(vaga.numero).padStart(6, '0')}
                      </strong>
                    </td>
                    <td>
                      <div className="vacancy-main-cell">
                        <strong>{vaga.cargo}</strong>
                        <span>{vaga.setor}</span>
                      </div>
                    </td>
                    <td>
                      <div className="vacancy-main-cell">
                        <strong>
                          {nomeEmpresa(empresa)}
                        </strong>
                        <span>
                          {nomeFilial(filial)}
                        </span>
                      </div>
                    </td>
                    <td>
                      <div className="vacancy-main-cell">
                        <strong>{contratoLabels[vaga.tipo_contrato]}</strong>
                        <span>{modalidadeLabels[vaga.modalidade]}</span>
                      </div>
                    </td>
                    <td>
                      <button
                        className="vacancy-candidate-count"
                        type="button"
                        onClick={() => abrirTriagem(vaga.id)}
                      >
                        {candidaturasPorVaga.get(vaga.id)?.length ?? 0}
                      </button>
                    </td>
                    <td>
                      {vaga.drive_folder_url ? (
                        <a
                          className="vacancy-drive-link"
                          href={vaga.drive_folder_url}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Abrir pasta
                        </a>
                      ) : (
                        <span className="vacancy-no-hire">—</span>
                      )}
                    </td>
                    <td>
                      {contratado ? (
                        <button
                          className="vacancy-hired-candidate"
                          type="button"
                          onClick={() => abrirTriagem(vaga.id)}
                          title={contratado.candidato.nome_completo}
                        >
                          <span>
                            {contratado.candidato.nome_completo
                              .charAt(0)
                              .toUpperCase()}
                          </span>
                          <strong>
                            {contratado.candidato.nome_completo}
                          </strong>
                        </button>
                      ) : (
                        <span className="vacancy-no-hire">—</span>
                      )}
                    </td>
                    <td>
                      <span
                        className={`vacancy-status status-${vaga.status}`}
                      >
                        {statusLabels[vaga.status]}
                      </span>
                    </td>
                    <td>
                      <span
                        className={`vacancy-portal-status ${vaga.publicar_portal ? 'published' : 'private'}`}
                        title={
                          vaga.publicar_portal && vaga.status === 'aberta'
                            ? 'Aparece no portal público de vagas'
                            : 'Não aparece no portal público de vagas'
                        }
                      >
                        {vaga.publicar_portal ? 'Publicado' : 'Interno'}
                      </span>
                    </td>
                    <td>
                      <span
                        className={`vacancy-priority priority-${vaga.prioridade}`}
                      >
                        {prioridadeLabels[vaga.prioridade]}
                      </span>
                    </td>
                    <td>{formatDate(vaga.data_limite)}</td>
                    <td>
                      <div className="vacancy-actions">
                        <button
                          type="button"
                          onClick={() => abrirTriagem(vaga.id)}
                        >
                          Ver candidatos
                        </button>

                        <button
                          type="button"
                          onClick={() => copiarLinkDaVaga(vaga)}
                          title="Copiar link público da vaga"
                        >
                          Copiar link
                        </button>

                        <button
                          type="button"
                          onClick={() => abrirEdicao(vaga)}
                        >
                          Editar
                        </button>
                        <button
                          className="danger"
                          type="button"
                          onClick={() => excluirVaga(vaga)}
                          disabled={
                            excluindoId === vaga.id ||
                            (candidaturasPorVaga.get(vaga.id)
                              ?.length ?? 0) > 0
                          }
                          title={
                            (candidaturasPorVaga.get(vaga.id)
                              ?.length ?? 0) > 0
                              ? 'A vaga possui candidatos vinculados'
                              : 'Excluir vaga'
                          }
                        >
                          {excluindoId === vaga.id
                            ? 'Excluindo...'
                            : 'Excluir'}
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}

              {vagasFiltradas.length === 0 && (
                <tr>
                  <td colSpan={12}>
                    <div className="vacancies-empty">
                      <div>VG</div>
                      <strong>Nenhuma vaga encontrada</strong>
                      <p>Cadastre uma vaga ou altere os filtros.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {(erro || mensagem) && (
        <aside
          className={`vacancies-toast ${erro ? 'error' : 'success'}`}
          role={erro ? 'alert' : 'status'}
        >
          <div>
            <strong>{erro ? 'Atenção' : 'Tudo certo'}</strong>
            <span>{erro || mensagem}</span>
          </div>

          <button
            type="button"
            onClick={() => {
              setErro('')
              setMensagem('')
            }}
            aria-label="Fechar aviso"
          >
            ×
          </button>
        </aside>
      )}

      {vagaDetalhes && (
        <div
          className="vacancies-modal-overlay"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              fecharTriagem()
            }
          }}
        >
          <section
            className="vacancies-modal vacancy-candidates-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="titulo-candidatos-vaga"
          >
            <header className="vacancies-modal-header">
              <div>
                <span className="vacancies-eyebrow">
                  VAG-{String(vagaDetalhes.numero).padStart(6, '0')}
                </span>
                <h2 id="titulo-candidatos-vaga">
                  Candidatos — {vagaDetalhes.cargo}
                </h2>
                <p className="vacancy-candidates-subtitle">
                  {vagaDetalhes.setor} · {candidaturasDaVaga.length}{' '}
                  candidato(s) vinculado(s)
                </p>

                {contratadoPorVaga.get(vagaDetalhes.id) && (
                  <div className="vacancy-filled-summary">
                    <span>Vaga fechada com</span>
                    <strong>
                      {
                        contratadoPorVaga.get(vagaDetalhes.id)
                          ?.candidato.nome_completo
                      }
                    </strong>
                  </div>
                )}
              </div>

              <button
                className="vacancies-close-button"
                type="button"
                onClick={() => fecharTriagem()}
                aria-label="Fechar"
              >
                ×
              </button>
            </header>

            <div className="vacancy-triage-filters" role="tablist" aria-label="Filtros de candidatos">
              {(Object.keys(triagemFiltroLabels) as TriagemFiltro[]).map((filtro) => (
                <button
                  className={filtroTriagem === filtro ? 'active' : ''}
                  key={filtro}
                  type="button"
                  onClick={() => {
                    setFiltroTriagem(filtro)
                    setCandidaturaSelecionadaId(null)
                    setMenuTriagemAbertoId(null)
                  }}
                >
                  {triagemFiltroLabels[filtro]}
                  <span>{triagemResumo[filtro]}</span>
                </button>
              ))}
            </div>

            <div className="vacancy-triage-layout">
              <aside className="vacancy-triage-sidebar" aria-label="Candidatos da vaga">
                {candidatosDaVagaFiltrados.map(({ candidatura, candidato }) => {
                  const selecionado =
                    candidatoTriagemSelecionado?.candidatura.id === candidatura.id
                  const temCurriculo = Boolean(getCurriculoUrl(candidato))
                  const salvandoEste = salvandoTriagemId === candidatura.id

                  return (
                    <button
                      className={
                        selecionado
                          ? 'vacancy-triage-candidate selected'
                          : 'vacancy-triage-candidate'
                      }
                      key={candidatura.id}
                      type="button"
                      onClick={() => {
                        setCandidaturaSelecionadaId(candidatura.id)
                        setMenuTriagemAbertoId(null)
                      }}
                    >
                      <span className="vacancy-candidate-avatar">
                        {getCandidatoInitials(candidato.nome_completo)}
                      </span>

                      <span className="vacancy-triage-candidate-text">
                        <strong>{candidato.nome_completo}</strong>
                        <small>
                          CAN-{String(candidato.numero).padStart(6, '0')}
                          {candidato.email ? ` · ${candidato.email}` : ''}
                        </small>
                        <span className="vacancy-triage-badges">
                          <span className={`vacancy-stage stage-${candidatura.etapa}`}>
                            {labelFromMap(etapaLabels, candidatura.etapa)}
                          </span>
                          <span className={`vacancy-application-status application-${candidatura.status}`}>
                            {labelFromMap(
                              candidaturaStatusLabels,
                              candidatura.status,
                            )}
                          </span>
                          {!temCurriculo && (
                            <span className="vacancy-resume-missing-badge">
                              Sem currículo
                            </span>
                          )}
                        </span>
                      </span>

                      {salvandoEste && (
                        <span className="vacancy-triage-saving">Salvando...</span>
                      )}
                    </button>
                  )
                })}

                {candidatosDaVagaFiltrados.length === 0 && (
                  <div className="vacancy-candidates-empty compact">
                    <div>VG</div>
                    <strong>Nenhum candidato neste filtro</strong>
                    <p>Altere o filtro acima para visualizar outros candidatos.</p>
                  </div>
                )}
              </aside>

              <section className="vacancy-resume-panel">
                {candidatoTriagemSelecionado ? (
                  <>
                    <header className="vacancy-resume-header">
                      <div>
                        <span className="vacancies-eyebrow">Currículo</span>
                        <h3>{candidatoTriagemSelecionado.candidato.nome_completo}</h3>
                        <p>
                          {candidatoTriagemSelecionado.candidato.email || 'Sem e-mail'}
                          {candidatoTriagemSelecionado.candidato.whatsapp
                            ? ` · ${candidatoTriagemSelecionado.candidato.whatsapp}`
                            : ''}
                        </p>
                      </div>

                      <div className="vacancy-resume-actions">
                        {curriculoSelecionadoUrl && (
                          <a
                            href={curriculoSelecionadoUrl}
                            target="_blank"
                            rel="noreferrer"
                          >
                            Abrir no Drive
                          </a>
                        )}

                        <div className="vacancy-triage-menu">
                          <button
                            type="button"
                            aria-label="Ações do candidato"
                            onClick={() =>
                              setMenuTriagemAbertoId((atual) =>
                                atual === candidatoTriagemSelecionado.candidatura.id
                                  ? null
                                  : candidatoTriagemSelecionado.candidatura.id,
                              )
                            }
                          >
                            ⋮
                          </button>

                          {menuTriagemAbertoId ===
                            candidatoTriagemSelecionado.candidatura.id && (
                            <div className="vacancy-triage-menu-list" role="menu">
                              {candidaturaEstaEmAnalise(
                                candidatoTriagemSelecionado.candidatura,
                              ) ? (
                                <button
                                  type="button"
                                  onClick={abrirPipelineDaTriagem}
                                >
                                  Abrir no Pipeline
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() =>
                                    atualizarTriagemCurriculo(
                                      candidatoTriagemSelecionado.candidatura,
                                      'em_analise',
                                    )
                                  }
                                  disabled={
                                    salvandoTriagemId ===
                                    candidatoTriagemSelecionado.candidatura.id
                                  }
                                >
                                  Mandar para Em análise
                                </button>
                              )}

                              {!candidaturaEstaNoBancoTalentos(
                                candidatoTriagemSelecionado.candidatura,
                              ) && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    atualizarTriagemCurriculo(
                                      candidatoTriagemSelecionado.candidatura,
                                      'banco_talentos',
                                    )
                                  }
                                  disabled={
                                    salvandoTriagemId ===
                                    candidatoTriagemSelecionado.candidatura.id
                                  }
                                >
                                  Mandar para Banco de Talentos
                                </button>
                              )}

                              {!candidaturaEstaRecusada(
                                candidatoTriagemSelecionado.candidatura,
                              ) && (
                                <button
                                  className="danger"
                                  type="button"
                                  onClick={() =>
                                    atualizarTriagemCurriculo(
                                      candidatoTriagemSelecionado.candidatura,
                                      'reprovar',
                                    )
                                  }
                                  disabled={
                                    salvandoTriagemId ===
                                    candidatoTriagemSelecionado.candidatura.id
                                  }
                                >
                                  Recusar candidato
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </header>

                    <div className="vacancy-resume-meta-grid">
                      <div>
                        <small>Entrada</small>
                        <strong>
                          {formatDateTime(
                            candidatoTriagemSelecionado.candidatura.data_entrada,
                          )}
                        </strong>
                      </div>
                      <div>
                        <small>Origem</small>
                        <strong>
                          {candidatoTriagemSelecionado.candidato.origem || '—'}
                        </strong>
                      </div>
                      <div>
                        <small>Arquivo</small>
                        <strong>
                          {candidatoTriagemSelecionado.candidato.curriculo_drive_nome ||
                            'Currículo'}
                        </strong>
                      </div>
                    </div>

                    {(candidatoTriagemSelecionado.candidato.observacoes ||
                      candidatoTriagemSelecionado.candidatura.observacoes ||
                      candidatoTriagemSelecionado.candidatura.motivo_reprovacao) && (
                      <div className="vacancy-resume-notes">
                        {candidatoTriagemSelecionado.candidato.observacoes && (
                          <p>
                            <strong>Observação do candidato:</strong>{' '}
                            {candidatoTriagemSelecionado.candidato.observacoes}
                          </p>
                        )}

                        {candidatoTriagemSelecionado.candidatura.observacoes && (
                          <p>
                            <strong>Observação da candidatura:</strong>{' '}
                            {candidatoTriagemSelecionado.candidatura.observacoes}
                          </p>
                        )}

                        {candidatoTriagemSelecionado.candidatura.motivo_reprovacao && (
                          <p>
                            <strong>Motivo da recusa:</strong>{' '}
                            {candidatoTriagemSelecionado.candidatura.motivo_reprovacao}
                          </p>
                        )}
                      </div>
                    )}

                    {curriculoPreviewUrl ? (
                      <div className="vacancy-resume-frame-wrap">
                        <iframe
                          title={`Currículo de ${candidatoTriagemSelecionado.candidato.nome_completo}`}
                          src={curriculoPreviewUrl}
                          allow="fullscreen"
                        />
                      </div>
                    ) : (
                      <div className="vacancy-resume-empty">
                        <strong>Currículo não localizado</strong>
                        <p>
                          Este candidato ainda não possui link de currículo salvo no
                          Google Drive.
                        </p>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="vacancy-resume-empty">
                    <strong>Selecione um candidato</strong>
                    <p>
                      A lista lateral mostra os candidatos vinculados a esta vaga.
                    </p>
                  </div>
                )}
              </section>
            </div>
          </section>
        </div>
      )}

      {modalAberto && (
        <div
          className="vacancies-modal-overlay"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) fecharModal()
          }}
        >
          <section
            className="vacancies-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="titulo-formulario-vaga"
          >
            <header className="vacancies-modal-header">
              <div>
                <span className="vacancies-eyebrow">
                  {editandoId ? 'Edição' : 'Cadastro'}
                </span>
                <h2 id="titulo-formulario-vaga">
                  {editandoId ? 'Editar vaga' : 'Nova vaga'}
                </h2>
              </div>

              <button
                className="vacancies-close-button"
                type="button"
                onClick={fecharModal}
                disabled={salvando}
                aria-label="Fechar"
              >
                ×
              </button>
            </header>

            <form onSubmit={salvarVaga}>
              <div className="vacancies-form-grid">
                <div className="vacancies-form-group">
                  <label htmlFor="vaga-empresa">Empresa *</label>
                  <select
                    id="vaga-empresa"
                    value={form.empresa_id}
                    onChange={(event) =>
                      setForm((atual) => ({
                        ...atual,
                        empresa_id: event.target.value,
                        filial_id: '',
                      }))
                    }
                    disabled={salvando}
                  >
                    <option value="">Selecione</option>
                    {empresas.map((empresa) => (
                      <option key={empresa.id} value={empresa.id}>
                        {nomeEmpresa(empresa)}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="vacancies-form-group">
                  <label htmlFor="vaga-filial">Filial *</label>
                  <select
                    id="vaga-filial"
                    value={form.filial_id}
                    onChange={(event) =>
                      setForm((atual) => ({
                        ...atual,
                        filial_id: event.target.value,
                      }))
                    }
                    disabled={salvando || !form.empresa_id}
                  >
                    <option value="">Selecione</option>
                    {filiaisDisponiveis.map((filial) => (
                      <option key={filial.id} value={filial.id}>
                        {nomeFilial(filial)}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="vacancies-form-group">
                  <label htmlFor="vaga-cargo">Cargo *</label>
                  <input
                    id="vaga-cargo"
                    type="text"
                    value={form.cargo}
                    onChange={(event) =>
                      setForm((atual) => ({
                        ...atual,
                        cargo: event.target.value,
                      }))
                    }
                    disabled={salvando}
                  />
                </div>

                <div className="vacancies-form-group">
                  <label htmlFor="vaga-setor">Setor *</label>
                  <input
                    id="vaga-setor"
                    type="text"
                    value={form.setor}
                    onChange={(event) =>
                      setForm((atual) => ({
                        ...atual,
                        setor: event.target.value,
                      }))
                    }
                    disabled={salvando}
                  />
                </div>



                <div className="vacancies-form-group">
                  <label htmlFor="vaga-contrato">Contrato *</label>
                  <select
                    id="vaga-contrato"
                    value={form.tipo_contrato}
                    onChange={(event) =>
                      setForm((atual) => ({
                        ...atual,
                        tipo_contrato: event.target.value as VagaContrato,
                      }))
                    }
                    disabled={salvando}
                  >
                    {Object.entries(contratoLabels).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="vacancies-form-group">
                  <label htmlFor="vaga-modalidade">Modalidade *</label>
                  <select
                    id="vaga-modalidade"
                    value={form.modalidade}
                    onChange={(event) =>
                      setForm((atual) => ({
                        ...atual,
                        modalidade: event.target.value as VagaModalidade,
                      }))
                    }
                    disabled={salvando}
                  >
                    {Object.entries(modalidadeLabels).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="vacancies-form-group">
                  <label htmlFor="vaga-prioridade">Prioridade</label>
                  <select
                    id="vaga-prioridade"
                    value={form.prioridade}
                    onChange={(event) =>
                      setForm((atual) => ({
                        ...atual,
                        prioridade: event.target.value as VagaPrioridade,
                      }))
                    }
                    disabled={salvando}
                  >
                    {Object.entries(prioridadeLabels).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="vacancies-form-group">
                  <label htmlFor="vaga-status">Status</label>
                  <select
                    id="vaga-status"
                    value={form.status}
                    onChange={(event) =>
                      setForm((atual) => ({
                        ...atual,
                        status: event.target.value as VagaStatus,
                      }))
                    }
                    disabled={salvando}
                  >
                    {statusCadastroOptions.map((value) => (
                      <option key={value} value={value}>
                        {statusLabels[value]}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="vacancies-form-group">
                  <label htmlFor="vaga-prazo">Prazo da vaga</label>
                  <input
                    id="vaga-prazo"
                    type="date"
                    value={form.data_limite}
                    onChange={(event) =>
                      setForm((atual) => ({
                        ...atual,
                        data_limite: event.target.value,
                      }))
                    }
                    disabled={salvando}
                  />
                </div>

                <div className="vacancies-form-group full">
                  <label className="vacancies-toggle-card" htmlFor="vaga-publicar-portal">
                    <input
                      id="vaga-publicar-portal"
                      type="checkbox"
                      checked={form.publicar_portal}
                      onChange={(event) =>
                        setForm((atual) => ({
                          ...atual,
                          publicar_portal: event.target.checked,
                        }))
                      }
                      disabled={salvando}
                    />
                    <span>
                      <strong>Publicar no portal?</strong>
                      <small>
                        Quando marcado, a vaga aparece na página pública se o status estiver Aberta.
                      </small>
                    </span>
                  </label>
                </div>

                <div className="vacancies-form-section-title">
                  <strong>Informações públicas da vaga</strong>
                  <span>Esses textos aparecem para o candidato na página de detalhes da vaga.</span>
                </div>

                <div className="vacancies-form-group full">
                  <label htmlFor="vaga-resumo-publico">Resumo para o card da vaga</label>
                  <textarea
                    id="vaga-resumo-publico"
                    value={form.resumo_publico}
                    onChange={(event) =>
                      setForm((atual) => ({
                        ...atual,
                        resumo_publico: event.target.value,
                      }))
                    }
                    disabled={salvando}
                    rows={2}
                    maxLength={260}
                    placeholder="Ex.: Atuação no apoio às rotinas de RH, atendimento interno e organização de documentos."
                  />
                  <small>Texto curto. Ele aparece nos cards e no início da página de detalhes.</small>
                </div>

                <div className="vacancies-form-group full">
                  <label htmlFor="vaga-descricao-publica">Descrição da vaga</label>
                  <textarea
                    id="vaga-descricao-publica"
                    value={form.descricao_publica}
                    onChange={(event) =>
                      setForm((atual) => ({
                        ...atual,
                        descricao_publica: event.target.value,
                      }))
                    }
                    disabled={salvando}
                    rows={4}
                    placeholder="Descreva o objetivo da vaga e o contexto da área."
                  />
                </div>

                <div className="vacancies-form-group full">
                  <label htmlFor="vaga-atividades">Atividades principais</label>
                  <textarea
                    id="vaga-atividades"
                    value={form.atividades}
                    onChange={(event) =>
                      setForm((atual) => ({
                        ...atual,
                        atividades: event.target.value,
                      }))
                    }
                    disabled={salvando}
                    rows={4}
                    placeholder="Liste as principais atividades da função."
                  />
                </div>

                <div className="vacancies-form-group full">
                  <label htmlFor="vaga-requisitos">Requisitos</label>
                  <textarea
                    id="vaga-requisitos"
                    value={form.requisitos}
                    onChange={(event) =>
                      setForm((atual) => ({
                        ...atual,
                        requisitos: event.target.value,
                      }))
                    }
                    disabled={salvando}
                    rows={4}
                    placeholder="Ex.: Ensino médio completo, experiência na área, conhecimento em pacote Office."
                  />
                </div>

                <div className="vacancies-form-group full">
                  <label>Benefícios</label>
                  <div className="vacancies-benefits-picker">
                    {beneficiosConfig.map((beneficio) => (
                      <label
                        className={
                          beneficiosSelecionados.includes(beneficio.nome)
                            ? 'vacancies-benefit-option selected'
                            : 'vacancies-benefit-option'
                        }
                        key={beneficio.codigo}
                      >
                        <input
                          type="checkbox"
                          checked={beneficiosSelecionados.includes(beneficio.nome)}
                          onChange={() => toggleBeneficio(beneficio.nome)}
                          disabled={salvando}
                        />
                        <span>
                          <strong>{beneficio.nome}</strong>
                          {beneficio.descricao && (
                            <small>{beneficio.descricao}</small>
                          )}
                        </span>
                      </label>
                    ))}

                    {beneficiosConfig.length === 0 && (
                      <div className="vacancies-benefits-empty">
                        Nenhum benefício ativo cadastrado. Cadastre em Configurações &gt; Benefícios.
                      </div>
                    )}
                  </div>
                  <small>
                    Cadastre e ative os benefícios em Configurações &gt; Benefícios.
                    O candidato verá apenas os itens selecionados aqui.
                  </small>
                </div>

                <div className="vacancies-form-group">
                  <label htmlFor="vaga-horario">Horário de trabalho</label>
                  <input
                    id="vaga-horario"
                    type="text"
                    value={form.horario_trabalho}
                    onChange={(event) =>
                      setForm((atual) => ({
                        ...atual,
                        horario_trabalho: event.target.value,
                      }))
                    }
                    disabled={salvando}
                    placeholder="Ex.: Segunda a sexta, 07h30 às 17h18"
                  />
                </div>

                <div className="vacancies-form-group">
                  <label htmlFor="vaga-salario">Faixa salarial</label>
                  <input
                    id="vaga-salario"
                    type="text"
                    value={form.salario_faixa}
                    onChange={(event) =>
                      setForm((atual) => ({
                        ...atual,
                        salario_faixa: event.target.value,
                      }))
                    }
                    disabled={salvando}
                    placeholder="Ex.: A combinar"
                  />
                </div>

                <div className="vacancies-form-group full">
                  <label htmlFor="vaga-observacoes-publicas">Observações públicas</label>
                  <textarea
                    id="vaga-observacoes-publicas"
                    value={form.observacoes_publicas}
                    onChange={(event) =>
                      setForm((atual) => ({
                        ...atual,
                        observacoes_publicas: event.target.value,
                      }))
                    }
                    disabled={salvando}
                    rows={3}
                    placeholder="Informações extras que podem aparecer para o candidato."
                  />
                </div>

                {!editandoId && (
                  <div className="vacancies-form-group full">
                    <label>E-mail de notificação do RH</label>
                    <div className="vacancies-email-preview">
                      <strong>{responsavelRhEmail || 'E-mail não localizado'}</strong>
                      <span>
                        E-mail do usuário logado. A pasta da vaga será criada
                        automaticamente no Google Drive após salvar.
                      </span>
                    </div>
                  </div>
                )}

              </div>


              <footer className="vacancies-modal-actions">
                <button
                  className="vacancies-secondary-button"
                  type="button"
                  onClick={fecharModal}
                  disabled={salvando}
                >
                  Cancelar
                </button>

                <button
                  className="vacancies-primary-button"
                  type="submit"
                  disabled={salvando}
                >
                  {salvando
                    ? 'Salvando...'
                    : editandoId
                      ? 'Salvar alterações'
                      : 'Criar vaga'}
                </button>
              </footer>
            </form>
          </section>
        </div>
      )}
    </>
  )
}

export default Vagas
