import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
  type KeyboardEvent,
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
  local: string | null
  link_reuniao: string | null
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
}

type AgendaItem = {
  entrevista: Entrevista
  candidato: Candidato
  vaga: Vaga
  entrevistador: Perfil | null
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
  local: string
  link_reuniao: string
  observacoes: string
  parecer: string
  nota: string
}

const FORM_INICIAL: EntrevistaForm = {
  candidatura_id: '',
  tipo: 'rh',
  modalidade: 'presencial',
  status: 'agendada',
  resultado: 'pendente',
  inicio: '',
  fim: '',
  entrevistador_id: '',
  local: '',
  link_reuniao: '',
  observacoes: '',
  parecer: '',
  nota: '',
}

const DIAS_SEMANA = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']

const TIPO_LABELS: Record<EntrevistaTipo, string> = {
  rh: 'Entrevista RH',
  gestor: 'Entrevista com gestor',
  tecnica: 'Entrevista técnica',
  pratica: 'Teste prático',
  admissional: 'Admissional',
  outro: 'Outro',
}

const MODALIDADE_LABELS: Record<EntrevistaModalidade, string> = {
  presencial: 'Presencial',
  google_meet: 'Google Meet',
  teams: 'Microsoft Teams',
  zoom: 'Zoom',
  telefone: 'Telefone',
  outro: 'Outro',
}

const STATUS_LABELS: Record<EntrevistaStatus, string> = {
  agendada: 'Agendada',
  confirmada: 'Confirmada',
  realizada: 'Realizada',
  cancelada: 'Cancelada',
  nao_compareceu: 'Não compareceu',
}

const RESULTADO_LABELS: Record<EntrevistaResultado, string> = {
  pendente: 'Pendente',
  aprovado: 'Aprovado',
  aprovado_ressalvas: 'Aprovado com ressalvas',
  reprovado: 'Reprovado',
}

function textoOuNull(valor: string) {
  const texto = valor.trim()
  return texto || null
}

function chaveData(data: Date) {
  const ano = data.getFullYear()
  const mes = String(data.getMonth() + 1).padStart(2, '0')
  const dia = String(data.getDate()).padStart(2, '0')
  return `${ano}-${mes}-${dia}`
}

function chaveDataIso(valor: string) {
  return chaveData(new Date(valor))
}

function mesmoDia(a: Date, b: Date) {
  return chaveData(a) === chaveData(b)
}

function paraInputLocal(valor: string) {
  const data = new Date(valor)

  if (Number.isNaN(data.getTime())) {
    return ''
  }

  const local = new Date(
    data.getTime() - data.getTimezoneOffset() * 60_000,
  )

  return local.toISOString().slice(0, 16)
}

function tituloMes(data: Date) {
  const texto = new Intl.DateTimeFormat('pt-BR', {
    month: 'long',
    year: 'numeric',
  }).format(data)

  return texto.charAt(0).toUpperCase() + texto.slice(1)
}

function tituloDia(data: Date) {
  const texto = new Intl.DateTimeFormat('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
  }).format(data)

  return texto.charAt(0).toUpperCase() + texto.slice(1)
}

function formatarHora(valor: string) {
  return new Intl.DateTimeFormat('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(valor))
}

function criarDiasDoCalendario(referencia: Date) {
  const primeiroDia = new Date(
    referencia.getFullYear(),
    referencia.getMonth(),
    1,
  )

  const diaSemanaComecandoSegunda =
    (primeiroDia.getDay() + 6) % 7

  const inicio = new Date(primeiroDia)
  inicio.setDate(primeiroDia.getDate() - diaSemanaComecandoSegunda)

  return Array.from({ length: 42 }, (_, indice) => {
    const data = new Date(inicio)
    data.setDate(inicio.getDate() + indice)
    return data
  })
}

function Agenda() {
  const hoje = useMemo(() => new Date(), [])

  const [entrevistas, setEntrevistas] = useState<Entrevista[]>([])
  const [candidaturas, setCandidaturas] = useState<Candidatura[]>([])
  const [candidatos, setCandidatos] = useState<Candidato[]>([])
  const [vagas, setVagas] = useState<Vaga[]>([])
  const [perfis, setPerfis] = useState<Perfil[]>([])

  const [mesExibido, setMesExibido] = useState(
    new Date(hoje.getFullYear(), hoje.getMonth(), 1),
  )
  const [diaSelecionado, setDiaSelecionado] = useState(hoje)
  const [pesquisa, setPesquisa] = useState('')
  const [filtroStatus, setFiltroStatus] = useState<
    'todos' | EntrevistaStatus
  >('todos')

  const [form, setForm] = useState<EntrevistaForm>(FORM_INICIAL)
  const [entrevistaEditandoId, setEntrevistaEditandoId] =
    useState<string | null>(null)
  const [modalAberto, setModalAberto] = useState(false)
  const [carregando, setCarregando] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [excluindoId, setExcluindoId] = useState<string | null>(null)
  const [erro, setErro] = useState('')
  const [mensagem, setMensagem] = useState('')

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
            local,
            link_reuniao,
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
        .select('id, candidato_id, vaga_id'),

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
        .select('id, full_name')
        .eq('active', true)
        .order('full_name'),
    ])

    const falha =
      entrevistasResult.error ??
      candidaturasResult.error ??
      candidatosResult.error ??
      vagasResult.error ??
      perfisResult.error

    if (falha) {
      console.error('Erro ao carregar agenda:', falha.message)
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

  const itens = useMemo(() => {
    const candidaturasMap = new Map(
      candidaturas.map((item) => [item.id, item]),
    )
    const candidatosMap = new Map(
      candidatos.map((item) => [item.id, item]),
    )
    const vagasMap = new Map(vagas.map((item) => [item.id, item]))
    const perfisMap = new Map(perfis.map((item) => [item.id, item]))

    return entrevistas
      .map((entrevista) => {
        const candidatura = candidaturasMap.get(
          entrevista.candidatura_id,
        )

        if (!candidatura) {
          return null
        }

        const candidato = candidatosMap.get(
          candidatura.candidato_id,
        )
        const vaga = vagasMap.get(candidatura.vaga_id)

        if (!candidato || !vaga) {
          return null
        }

        return {
          entrevista,
          candidato,
          vaga,
          entrevistador: entrevista.entrevistador_id
            ? perfisMap.get(entrevista.entrevistador_id) ?? null
            : null,
        } satisfies AgendaItem
      })
      .filter((item): item is AgendaItem => item !== null)
  }, [candidatos, candidaturas, entrevistas, perfis, vagas])

  const itensFiltrados = useMemo(() => {
    const termo = pesquisa.trim().toLowerCase()

    return itens.filter((item) => {
      const combinaStatus =
        filtroStatus === 'todos' ||
        item.entrevista.status === filtroStatus

      const combinaPesquisa =
        !termo ||
        item.candidato.nome_completo.toLowerCase().includes(termo) ||
        item.vaga.cargo.toLowerCase().includes(termo) ||
        item.vaga.setor.toLowerCase().includes(termo) ||
        item.entrevistador?.full_name.toLowerCase().includes(termo)

      return combinaStatus && combinaPesquisa
    })
  }, [filtroStatus, itens, pesquisa])

  const itensPorDia = useMemo(() => {
    const mapa = new Map<string, AgendaItem[]>()

    for (const item of itensFiltrados) {
      const chave = chaveDataIso(item.entrevista.inicio)
      const lista = mapa.get(chave) ?? []
      lista.push(item)
      lista.sort(
        (a, b) =>
          new Date(a.entrevista.inicio).getTime() -
          new Date(b.entrevista.inicio).getTime(),
      )
      mapa.set(chave, lista)
    }

    return mapa
  }, [itensFiltrados])

  const diasCalendario = useMemo(
    () => criarDiasDoCalendario(mesExibido),
    [mesExibido],
  )

  const itensDiaSelecionado =
    itensPorDia.get(chaveData(diaSelecionado)) ?? []

  function selecionarDia(data: Date) {
    setDiaSelecionado(data)

    if (
      data.getMonth() !== mesExibido.getMonth() ||
      data.getFullYear() !== mesExibido.getFullYear()
    ) {
      setMesExibido(
        new Date(data.getFullYear(), data.getMonth(), 1),
      )
    }
  }

  function navegarDiaComTeclado(
    event: KeyboardEvent<HTMLDivElement>,
    data: Date,
  ) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      selecionarDia(data)
    }
  }

  function voltarMes() {
    setMesExibido(
      (atual) =>
        new Date(atual.getFullYear(), atual.getMonth() - 1, 1),
    )
  }

  function avancarMes() {
    setMesExibido(
      (atual) =>
        new Date(atual.getFullYear(), atual.getMonth() + 1, 1),
    )
  }

  function irParaHoje() {
    const agora = new Date()
    setDiaSelecionado(agora)
    setMesExibido(
      new Date(agora.getFullYear(), agora.getMonth(), 1),
    )
  }

  function abrirNovaEntrevista(data = diaSelecionado) {
    const inicio = new Date(
      data.getFullYear(),
      data.getMonth(),
      data.getDate(),
      9,
      0,
      0,
      0,
    )
    const fim = new Date(inicio.getTime() + 60 * 60 * 1000)

    setForm({
      ...FORM_INICIAL,
      inicio: paraInputLocal(inicio.toISOString()),
      fim: paraInputLocal(fim.toISOString()),
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
      modalidade: entrevista.modalidade,
      status: entrevista.status,
      resultado: entrevista.resultado,
      inicio: paraInputLocal(entrevista.inicio),
      fim: paraInputLocal(entrevista.fim),
      entrevistador_id: entrevista.entrevistador_id ?? '',
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
    setForm(FORM_INICIAL)
    setErro('')
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

    const online = [
      'google_meet',
      'teams',
      'zoom',
      'outro',
    ].includes(form.modalidade)

    if (online && !form.link_reuniao.trim()) {
      setErro('Informe o link da reunião.')
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

    const payload = {
      candidatura_id: form.candidatura_id,
      tipo: form.tipo,
      modalidade: form.modalidade,
      status: form.status,
      resultado: form.resultado,
      inicio: inicio.toISOString(),
      fim: fim.toISOString(),
      entrevistador_id: form.entrevistador_id || null,
      local: textoOuNull(form.local),
      link_reuniao: textoOuNull(form.link_reuniao),
      observacoes: textoOuNull(form.observacoes),
      parecer: textoOuNull(form.parecer),
      nota,
    }

    const resultado = entrevistaEditandoId
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

    if (resultado.error) {
      console.error(
        'Erro ao salvar entrevista:',
        resultado.error.message,
      )
      setErro('Não foi possível salvar a entrevista.')
      return
    }

    const entrevistaSalva = resultado.data as Entrevista
    const dataSalva = new Date(entrevistaSalva.inicio)

    setDiaSelecionado(dataSalva)
    setMesExibido(
      new Date(dataSalva.getFullYear(), dataSalva.getMonth(), 1),
    )
    setModalAberto(false)
    setEntrevistaEditandoId(null)
    setForm(FORM_INICIAL)
    setMensagem(
      entrevistaEditandoId
        ? 'Entrevista atualizada com sucesso.'
        : 'Entrevista agendada com sucesso.',
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
      console.error('Erro ao atualizar entrevista:', error.message)
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
      console.error('Erro ao excluir entrevista:', error.message)
      setErro('Não foi possível excluir a entrevista.')
      return
    }

    setMensagem('Entrevista excluída com sucesso.')
    await carregarDados()
  }

  if (carregando) {
    return (
      <section className="calendar-shell calendar-loading">
        <div className="calendar-loading-icon">AG</div>
        <p>Carregando agenda...</p>
      </section>
    )
  }

  return (
    <>
      <section className="calendar-shell">
        <header className="calendar-page-header">
          <div>
            <span className="calendar-eyebrow">Recrutamento</span>
            <h2>Agenda de entrevistas</h2>
            <p>
              Visualize os compromissos por mês e acompanhe cada dia.
            </p>
          </div>

          <button
            className="calendar-primary-button"
            type="button"
            onClick={() => abrirNovaEntrevista()}
          >
            + Agendar entrevista
          </button>
        </header>

        <div className="calendar-toolbar">
          <div className="calendar-navigation">
            <button
              type="button"
              onClick={voltarMes}
              aria-label="Mês anterior"
            >
              ‹
            </button>

            <button
              className="today-button"
              type="button"
              onClick={irParaHoje}
            >
              Hoje
            </button>

            <button
              type="button"
              onClick={avancarMes}
              aria-label="Próximo mês"
            >
              ›
            </button>

            <h3>{tituloMes(mesExibido)}</h3>
          </div>

          <div className="calendar-filters">
            <input
              type="search"
              placeholder="Pesquisar candidato ou vaga..."
              value={pesquisa}
              onChange={(event) => setPesquisa(event.target.value)}
            />

            <select
              value={filtroStatus}
              onChange={(event) =>
                setFiltroStatus(
                  event.target.value as
                    | 'todos'
                    | EntrevistaStatus,
                )
              }
            >
              <option value="todos">Todas as situações</option>
              {Object.entries(STATUS_LABELS).map(
                ([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ),
              )}
            </select>

            <button
              className="calendar-refresh-button"
              type="button"
              onClick={carregarDados}
            >
              Atualizar
            </button>
          </div>
        </div>

        {erro && (
          <div className="calendar-message error" role="alert">
            {erro}
          </div>
        )}

        {mensagem && (
          <div className="calendar-message success" role="status">
            {mensagem}
          </div>
        )}

        <div className="calendar-main-layout">
          <div className="calendar-board">
            <div className="calendar-week-header">
              {DIAS_SEMANA.map((dia) => (
                <span key={dia}>{dia}</span>
              ))}
            </div>

            <div className="calendar-grid">
              {diasCalendario.map((data) => {
                const chave = chaveData(data)
                const compromissos = itensPorDia.get(chave) ?? []
                const pertenceAoMes =
                  data.getMonth() === mesExibido.getMonth()
                const eHoje = mesmoDia(data, hoje)
                const selecionado = mesmoDia(data, diaSelecionado)

                return (
                  <div
                    className={[
                      'calendar-day',
                      !pertenceAoMes ? 'outside-month' : '',
                      eHoje ? 'today' : '',
                      selecionado ? 'selected' : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    key={chave}
                    role="button"
                    tabIndex={0}
                    onClick={() => selecionarDia(data)}
                    onKeyDown={(event) =>
                      navegarDiaComTeclado(event, data)
                    }
                  >
                    <div className="calendar-day-number">
                      <span>{data.getDate()}</span>

                      {compromissos.length > 0 && (
                        <small>{compromissos.length}</small>
                      )}
                    </div>

                    <div className="calendar-day-events">
                      {compromissos.slice(0, 3).map((item) => (
                        <button
                          className={`calendar-event-chip event-${item.entrevista.status}`}
                          key={item.entrevista.id}
                          type="button"
                          title={`${formatarHora(
                            item.entrevista.inicio,
                          )} — ${item.candidato.nome_completo}`}
                          onClick={(event) => {
                            event.stopPropagation()
                            abrirEdicao(item.entrevista)
                          }}
                        >
                          <strong>
                            {formatarHora(item.entrevista.inicio)}
                          </strong>
                          <span>{item.candidato.nome_completo}</span>
                        </button>
                      ))}

                      {compromissos.length > 3 && (
                        <div className="calendar-more-events">
                          +{compromissos.length - 3} compromisso(s)
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          <aside className="calendar-day-panel">
            <header className="calendar-day-panel-header">
              <div>
                <span>Dia selecionado</span>
                <h3>{tituloDia(diaSelecionado)}</h3>
              </div>

              <button
                type="button"
                onClick={() => abrirNovaEntrevista(diaSelecionado)}
                aria-label="Adicionar compromisso neste dia"
              >
                +
              </button>
            </header>

            <div className="calendar-day-summary">
              <div>
                <span>Compromissos</span>
                <strong>{itensDiaSelecionado.length}</strong>
              </div>

              <div>
                <span>Confirmados</span>
                <strong>
                  {
                    itensDiaSelecionado.filter(
                      (item) =>
                        item.entrevista.status === 'confirmada',
                    ).length
                  }
                </strong>
              </div>
            </div>

            <div className="calendar-day-list">
              {itensDiaSelecionado.map((item) => (
                <article
                  className="calendar-appointment-card"
                  key={item.entrevista.id}
                >
                  <div className="calendar-appointment-time">
                    <strong>
                      {formatarHora(item.entrevista.inicio)}
                    </strong>
                    <span>{formatarHora(item.entrevista.fim)}</span>
                  </div>

                  <div className="calendar-appointment-content">
                    <div className="calendar-appointment-title">
                      <h4>{item.candidato.nome_completo}</h4>
                      <span
                        className={`calendar-status status-${item.entrevista.status}`}
                      >
                        {STATUS_LABELS[item.entrevista.status]}
                      </span>
                    </div>

                    <p>
                      VAG-{String(item.vaga.numero).padStart(6, '0')}{' '}
                      — {item.vaga.cargo}
                    </p>

                    <div className="calendar-appointment-meta">
                      <span>{TIPO_LABELS[item.entrevista.tipo]}</span>
                      <span>
                        {MODALIDADE_LABELS[item.entrevista.modalidade]}
                      </span>
                      <span>
                        {item.entrevistador?.full_name ??
                          'Sem entrevistador'}
                      </span>
                    </div>

                    {(item.entrevista.local ||
                      item.entrevista.link_reuniao) && (
                      <div className="calendar-appointment-location">
                        {item.entrevista.local && (
                          <span>{item.entrevista.local}</span>
                        )}

                        {item.entrevista.link_reuniao && (
                          <a
                            href={item.entrevista.link_reuniao}
                            target="_blank"
                            rel="noreferrer"
                          >
                            Abrir reunião
                          </a>
                        )}
                      </div>
                    )}

                    <div className="calendar-appointment-actions">
                      <button
                        type="button"
                        onClick={() => abrirEdicao(item.entrevista)}
                      >
                        Editar
                      </button>

                      {item.entrevista.status === 'agendada' && (
                        <button
                          className="primary"
                          type="button"
                          onClick={() =>
                            atualizarStatus(
                              item.entrevista,
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
                      ].includes(item.entrevista.status) && (
                        <button
                          type="button"
                          onClick={() =>
                            atualizarStatus(
                              item.entrevista,
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
                          excluirEntrevista(item.entrevista)
                        }
                        disabled={excluindoId === item.entrevista.id}
                      >
                        {excluindoId === item.entrevista.id
                          ? 'Excluindo...'
                          : 'Excluir'}
                      </button>
                    </div>
                  </div>
                </article>
              ))}

              {itensDiaSelecionado.length === 0 && (
                <div className="calendar-empty-day">
                  <div>AG</div>
                  <strong>Nenhum compromisso</strong>
                  <p>
                    Clique no botão “+” para agendar uma entrevista
                    neste dia.
                  </p>
                </div>
              )}
            </div>
          </aside>
        </div>
      </section>

      {modalAberto && (
        <div
          className="calendar-modal-overlay"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              fecharModal()
            }
          }}
        >
          <section
            className="calendar-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="calendar-modal-title"
          >
            <header className="calendar-modal-header">
              <div>
                <span className="calendar-eyebrow">
                  {entrevistaEditandoId ? 'Edição' : 'Agenda'}
                </span>
                <h2 id="calendar-modal-title">
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
              <div className="calendar-form-section">
                <div className="calendar-form-grid">
                  <div className="calendar-field full">
                    <label htmlFor="agenda-candidatura">
                      Candidato e vaga *
                    </label>
                    <select
                      id="agenda-candidatura"
                      value={form.candidatura_id}
                      onChange={(event) =>
                        setForm((atual) => ({
                          ...atual,
                          candidatura_id: event.target.value,
                        }))
                      }
                      disabled={salvando}
                    >
                      <option value="">Selecione</option>
                      {candidaturas.map((candidatura) => {
                        const candidato = candidatos.find(
                          (item) =>
                            item.id === candidatura.candidato_id,
                        )
                        const vaga = vagas.find(
                          (item) => item.id === candidatura.vaga_id,
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
                            {String(vaga.numero).padStart(6, '0')} —{' '}
                            {vaga.cargo}
                          </option>
                        )
                      })}
                    </select>
                  </div>

                  <div className="calendar-field">
                    <label htmlFor="agenda-tipo">Tipo *</label>
                    <select
                      id="agenda-tipo"
                      value={form.tipo}
                      onChange={(event) =>
                        setForm((atual) => ({
                          ...atual,
                          tipo: event.target.value as EntrevistaTipo,
                        }))
                      }
                      disabled={salvando}
                    >
                      {Object.entries(TIPO_LABELS).map(
                        ([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ),
                      )}
                    </select>
                  </div>

                  <div className="calendar-field">
                    <label htmlFor="agenda-modalidade">
                      Modalidade *
                    </label>
                    <select
                      id="agenda-modalidade"
                      value={form.modalidade}
                      onChange={(event) =>
                        setForm((atual) => ({
                          ...atual,
                          modalidade:
                            event.target.value as EntrevistaModalidade,
                        }))
                      }
                      disabled={salvando}
                    >
                      {Object.entries(MODALIDADE_LABELS).map(
                        ([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ),
                      )}
                    </select>
                  </div>

                  <div className="calendar-field">
                    <label htmlFor="agenda-inicio">Início *</label>
                    <input
                      id="agenda-inicio"
                      type="datetime-local"
                      value={form.inicio}
                      onChange={(event) =>
                        setForm((atual) => ({
                          ...atual,
                          inicio: event.target.value,
                        }))
                      }
                      disabled={salvando}
                    />
                  </div>

                  <div className="calendar-field">
                    <label htmlFor="agenda-fim">Término *</label>
                    <input
                      id="agenda-fim"
                      type="datetime-local"
                      value={form.fim}
                      onChange={(event) =>
                        setForm((atual) => ({
                          ...atual,
                          fim: event.target.value,
                        }))
                      }
                      disabled={salvando}
                    />
                  </div>

                  <div className="calendar-field">
                    <label htmlFor="agenda-entrevistador">
                      Entrevistador
                    </label>
                    <select
                      id="agenda-entrevistador"
                      value={form.entrevistador_id}
                      onChange={(event) =>
                        setForm((atual) => ({
                          ...atual,
                          entrevistador_id: event.target.value,
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

                  <div className="calendar-field">
                    <label htmlFor="agenda-status-form">
                      Situação
                    </label>
                    <select
                      id="agenda-status-form"
                      value={form.status}
                      onChange={(event) =>
                        setForm((atual) => ({
                          ...atual,
                          status:
                            event.target.value as EntrevistaStatus,
                        }))
                      }
                      disabled={salvando}
                    >
                      {Object.entries(STATUS_LABELS).map(
                        ([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ),
                      )}
                    </select>
                  </div>

                  <div className="calendar-field">
                    <label htmlFor="agenda-local">Local</label>
                    <input
                      id="agenda-local"
                      type="text"
                      value={form.local}
                      onChange={(event) =>
                        setForm((atual) => ({
                          ...atual,
                          local: event.target.value,
                        }))
                      }
                      disabled={salvando}
                    />
                  </div>

                  <div className="calendar-field">
                    <label htmlFor="agenda-link">
                      Link da reunião
                    </label>
                    <input
                      id="agenda-link"
                      type="url"
                      placeholder="https://..."
                      value={form.link_reuniao}
                      onChange={(event) =>
                        setForm((atual) => ({
                          ...atual,
                          link_reuniao: event.target.value,
                        }))
                      }
                      disabled={salvando}
                    />
                  </div>
                </div>

                <div className="calendar-field full space-top">
                  <label htmlFor="agenda-observacoes">
                    Observações
                  </label>
                  <textarea
                    id="agenda-observacoes"
                    rows={3}
                    value={form.observacoes}
                    onChange={(event) =>
                      setForm((atual) => ({
                        ...atual,
                        observacoes: event.target.value,
                      }))
                    }
                    disabled={salvando}
                  />
                </div>
              </div>

              <div className="calendar-form-section">
                <h3>Resultado da entrevista</h3>

                <div className="calendar-form-grid">
                  <div className="calendar-field">
                    <label htmlFor="agenda-resultado">
                      Resultado
                    </label>
                    <select
                      id="agenda-resultado"
                      value={form.resultado}
                      onChange={(event) =>
                        setForm((atual) => ({
                          ...atual,
                          resultado:
                            event.target.value as EntrevistaResultado,
                        }))
                      }
                      disabled={salvando}
                    >
                      {Object.entries(RESULTADO_LABELS).map(
                        ([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ),
                      )}
                    </select>
                  </div>

                  <div className="calendar-field">
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
                        setForm((atual) => ({
                          ...atual,
                          nota: event.target.value,
                        }))
                      }
                      disabled={salvando}
                    />
                  </div>
                </div>

                <div className="calendar-field full space-top">
                  <label htmlFor="agenda-parecer">Parecer</label>
                  <textarea
                    id="agenda-parecer"
                    rows={4}
                    value={form.parecer}
                    onChange={(event) =>
                      setForm((atual) => ({
                        ...atual,
                        parecer: event.target.value,
                      }))
                    }
                    disabled={salvando}
                  />
                </div>
              </div>

              {erro && (
                <div className="calendar-message error">{erro}</div>
              )}

              <footer className="calendar-modal-actions">
                <button
                  className="calendar-secondary-button"
                  type="button"
                  onClick={fecharModal}
                  disabled={salvando}
                >
                  Cancelar
                </button>

                <button
                  className="calendar-primary-button"
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
