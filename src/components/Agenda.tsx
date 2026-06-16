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
  status: string
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

const initialForm: EntrevistaForm = {
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

const tipoLabels: Record<EntrevistaTipo, string> = {
  rh: 'Entrevista RH',
  gestor: 'Entrevista com gestor',
  tecnica: 'Entrevista técnica',
  pratica: 'Teste prático',
  admissional: 'Admissional',
  outro: 'Outro',
}

const modalidadeLabels: Record<EntrevistaModalidade, string> = {
  presencial: 'Presencial',
  google_meet: 'Google Meet',
  teams: 'Microsoft Teams',
  zoom: 'Zoom',
  telefone: 'Telefone',
  outro: 'Outro',
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
  const [pesquisa, setPesquisa] = useState('')
  const [filtroStatus, setFiltroStatus] = useState<
    'todos' | EntrevistaStatus
  >('todos')
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
        .select('id, candidato_id, vaga_id, status'),

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

  const cards = useMemo(() => {
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

    return entrevistas
      .map((entrevista) => {
        const candidatura = candidatureMap.get(
          entrevista.candidatura_id,
        )

        if (!candidatura) {
          return null
        }

        const candidato = candidateMap.get(
          candidatura.candidato_id,
        )
        const vaga = vacancyMap.get(candidatura.vaga_id)

        if (!candidato || !vaga) {
          return null
        }

        return {
          entrevista,
          candidato,
          vaga,
          entrevistador: entrevista.entrevistador_id
            ? profileMap.get(entrevista.entrevistador_id) ?? null
            : null,
        } satisfies AgendaCard
      })
      .filter((item): item is AgendaCard => item !== null)
  }, [
    candidatos,
    candidaturas,
    entrevistas,
    perfis,
    vagas,
  ])

  const cardsFiltrados = useMemo(() => {
    const termo = pesquisa.trim().toLowerCase()

    return cards.filter((card) => {
      const atendeStatus =
        filtroStatus === 'todos' ||
        card.entrevista.status === filtroStatus

      const atendePesquisa =
        !termo ||
        card.candidato.nome_completo
          .toLowerCase()
          .includes(termo) ||
        card.vaga.cargo.toLowerCase().includes(termo) ||
        card.vaga.setor.toLowerCase().includes(termo) ||
        card.entrevistador?.full_name
          .toLowerCase()
          .includes(termo)

      return atendeStatus && atendePesquisa
    })
  }, [cards, filtroStatus, pesquisa])

  const grupos = useMemo(() => {
    const map = new Map<string, AgendaCard[]>()

    for (const card of cardsFiltrados) {
      const key = new Date(card.entrevista.inicio)
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

  function abrirNovaEntrevista() {
    const now = new Date()
    now.setMinutes(Math.ceil(now.getMinutes() / 30) * 30)
    const end = new Date(now.getTime() + 60 * 60 * 1000)

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
      modalidade: entrevista.modalidade,
      status: entrevista.status,
      resultado: entrevista.resultado,
      inicio: toLocalInput(entrevista.inicio),
      fim: toLocalInput(entrevista.fim),
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
    setForm(initialForm)
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

    const modalidadeOnline = [
      'google_meet',
      'teams',
      'zoom',
      'outro',
    ].includes(form.modalidade)

    if (modalidadeOnline && !form.link_reuniao.trim()) {
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
      local: nullableText(form.local),
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

    if (result.error) {
      console.error(
        'Erro ao salvar entrevista:',
        result.error.message,
      )
      setErro('Não foi possível salvar a entrevista.')
      return
    }

    setModalAberto(false)
    setEntrevistaEditandoId(null)
    setForm(initialForm)
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
            <h2>Agenda de entrevistas</h2>
            <p>
              Agende entrevistas, registre confirmações e salve os
              resultados.
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

          <div className="agenda-summary">
            <span>Total</span>
            <strong>{cards.length}</strong>
          </div>

          <div className="agenda-summary">
            <span>Confirmadas</span>
            <strong>
              {
                cards.filter(
                  (card) =>
                    card.entrevista.status === 'confirmada',
                ).length
              }
            </strong>
          </div>
        </div>

        {erro && (
          <div className="agenda-message error" role="alert">
            {erro}
          </div>
        )}

        {mensagem && (
          <div className="agenda-message success" role="status">
            {mensagem}
          </div>
        )}

        <div className="agenda-content">
          {grupos.map(([date, group]) => (
            <section className="agenda-day" key={date}>
              <header className="agenda-day-header">
                <h3>{formatDate(group[0].entrevista.inicio)}</h3>
                <span>{group.length} entrevista(s)</span>
              </header>

              <div className="agenda-list">
                {group.map((card) => (
                  <article
                    className="agenda-card"
                    key={card.entrevista.id}
                  >
                    <div className="agenda-time">
                      <strong>
                        {formatTime(card.entrevista.inicio)}
                      </strong>
                      <span>
                        até {formatTime(card.entrevista.fim)}
                      </span>
                    </div>

                    <div className="agenda-card-main">
                      <div className="agenda-card-title">
                        <div>
                          <h4>{card.candidato.nome_completo}</h4>
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
                          className={`agenda-status status-${card.entrevista.status}`}
                        >
                          {
                            statusLabels[
                              card.entrevista.status
                            ]
                          }
                        </span>
                      </div>

                      <div className="agenda-card-info">
                        <span>
                          {tipoLabels[card.entrevista.tipo]}
                        </span>
                        <span>
                          {
                            modalidadeLabels[
                              card.entrevista.modalidade
                            ]
                          }
                        </span>
                        <span>
                          Entrevistador:{' '}
                          {card.entrevistador?.full_name ??
                            'Não definido'}
                        </span>
                      </div>

                      {(card.entrevista.local ||
                        card.entrevista.link_reuniao) && (
                        <div className="agenda-location">
                          {card.entrevista.local && (
                            <span>
                              Local: {card.entrevista.local}
                            </span>
                          )}

                          {card.entrevista.link_reuniao && (
                            <a
                              href={
                                card.entrevista.link_reuniao
                              }
                              target="_blank"
                              rel="noreferrer"
                            >
                              Abrir reunião
                            </a>
                          )}
                        </div>
                      )}

                      {card.entrevista.status === 'realizada' && (
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
                      <button
                        type="button"
                        onClick={() =>
                          abrirEdicao(card.entrevista)
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
                              card.entrevista,
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
                              card.entrevista,
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
                          excluirEntrevista(card.entrevista)
                        }
                        disabled={
                          excluindoId === card.entrevista.id
                        }
                      >
                        {excluindoId === card.entrevista.id
                          ? 'Excluindo...'
                          : 'Excluir'}
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ))}

          {grupos.length === 0 && (
            <div className="agenda-empty">
              <div>AG</div>
              <strong>Nenhuma entrevista encontrada</strong>
              <p>
                Agende uma entrevista ou altere os filtros.
              </p>
            </div>
          )}
        </div>
      </section>

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
                      {Object.entries(tipoLabels).map(
                        ([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ),
                      )}
                    </select>
                  </div>

                  <div className="agenda-field">
                    <label htmlFor="agenda-modalidade">
                      Modalidade *
                    </label>
                    <select
                      id="agenda-modalidade"
                      value={form.modalidade}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          modalidade:
                            event.target
                              .value as EntrevistaModalidade,
                        }))
                      }
                      disabled={salvando}
                    >
                      {Object.entries(modalidadeLabels).map(
                        ([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ),
                      )}
                    </select>
                  </div>

                  <div className="agenda-field">
                    <label htmlFor="agenda-inicio">
                      Início *
                    </label>
                    <input
                      id="agenda-inicio"
                      type="datetime-local"
                      value={form.inicio}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          inicio: event.target.value,
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

                  <div className="agenda-field">
                    <label htmlFor="agenda-local">Local</label>
                    <input
                      id="agenda-local"
                      type="text"
                      value={form.local}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          local: event.target.value,
                        }))
                      }
                      disabled={salvando}
                    />
                  </div>

                  <div className="agenda-field">
                    <label htmlFor="agenda-link">
                      Link da reunião
                    </label>
                    <input
                      id="agenda-link"
                      type="url"
                      placeholder="https://..."
                      value={form.link_reuniao}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          link_reuniao: event.target.value,
                        }))
                      }
                      disabled={salvando}
                    />
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
