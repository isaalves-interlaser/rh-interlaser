import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from 'react'
import { supabase } from '../lib/supabase'
import './Candidatos.css'

type CandidatoOrigem =
  | 'indicacao'
  | 'linkedin'
  | 'indeed'
  | 'site'
  | 'email'
  | 'presencial'
  | 'agencia'
  | 'banco_talentos'
  | 'outro'

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
  cidade: string | null
  uf: string | null
  pretensao_salarial: number | null
  origem: CandidatoOrigem
  observacoes: string | null
  curriculo_path: string | null
  drive_folder_url: string | null
  active: boolean
  created_at: string
  updated_at: string
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
  created_at: string
  updated_at: string
}

type Vaga = {
  id: string
  numero: number
  cargo: string
  setor: string
  status: string
}

type CandidatoForm = {
  nome_completo: string
  email: string
  whatsapp: string
  cidade: string
  uf: string
  pretensao_salarial: string
  origem: CandidatoOrigem
  observacoes: string
  vaga_id: string
}

type NovaCandidaturaForm = {
  candidato_id: string
  vaga_id: string
  etapa: CandidaturaEtapa
  observacoes: string
}

const initialCandidateForm: CandidatoForm = {
  nome_completo: '',
  email: '',
  whatsapp: '',
  cidade: '',
  uf: '',
  pretensao_salarial: '',
  origem: 'outro',
  observacoes: '',
  vaga_id: '',
}

const initialApplicationForm: NovaCandidaturaForm = {
  candidato_id: '',
  vaga_id: '',
  etapa: 'recebido',
  observacoes: '',
}

const origemLabels: Record<CandidatoOrigem, string> = {
  indicacao: 'Indicação',
  linkedin: 'LinkedIn',
  indeed: 'Indeed',
  site: 'Site',
  email: 'E-mail',
  presencial: 'Presencial',
  agencia: 'Agência',
  banco_talentos: 'Banco de talentos',
  outro: 'Outro',
}

const etapaLabels: Record<CandidaturaEtapa, string> = {
  recebido: 'Recebido',
  em_analise: 'Em análise',
  entrevista_rh: 'Entrevista RH',
  entrevista_gestor: 'Entrevista com gestor',
  teste_pratico: 'Teste prático',
  documentacao: 'Documentação',
  exame_admissional: 'Exame admissional',
  contratado: 'Contratado',
}

const applicationStageOptions: CandidaturaEtapa[] = [
  'recebido',
  'em_analise',
]

const statusLabels: Record<CandidaturaStatus, string> = {
  ativo: 'Ativo',
  reprovado: 'Reprovado',
  desistente: 'Desistente',
  suspenso: 'Suspenso',
  banco_talentos: 'Banco de talentos',
  contratado: 'Contratado',
}

function nullableText(value: string) {
  const normalized = value.trim()
  return normalized || null
}

function nullableNumber(value: string) {
  if (!value.trim()) {
    return null
  }

  const number = Number(value.replace(',', '.'))
  return Number.isFinite(number) ? number : null
}

function normalizePhone(value: string) {
  return value.replace(/\D/g, '')
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

function formatCurrency(value: number | null) {
  if (value === null) {
    return 'Não informada'
  }

  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value)
}

function Candidatos() {
  const [candidatos, setCandidatos] = useState<Candidato[]>([])
  const [candidaturas, setCandidaturas] = useState<Candidatura[]>([])
  const [vagas, setVagas] = useState<Vaga[]>([])
  const [pesquisa, setPesquisa] = useState('')
  const [filtroStatus, setFiltroStatus] = useState<
    'todos' | CandidaturaStatus
  >('todos')
  const [carregando, setCarregando] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  const [mensagem, setMensagem] = useState('')
  const [modalCandidatoAberto, setModalCandidatoAberto] =
    useState(false)
  const [modalCandidaturaAberto, setModalCandidaturaAberto] =
    useState(false)
  const [modalDetalhesAberto, setModalDetalhesAberto] =
    useState(false)
  const [candidatoSelecionadoId, setCandidatoSelecionadoId] =
    useState<string | null>(null)
  const [candidatoEditandoId, setCandidatoEditandoId] =
    useState<string | null>(null)
  const [form, setForm] =
    useState<CandidatoForm>(initialCandidateForm)
  const [applicationForm, setApplicationForm] =
    useState<NovaCandidaturaForm>(initialApplicationForm)

  const carregarDados = useCallback(async () => {
    setCarregando(true)
    setErro('')

    const [candidatosResult, candidaturasResult, vagasResult] =
      await Promise.all([
        supabase
          .from('candidatos')
          .select(
            `
              id,
              numero,
              nome_completo,
              email,
              whatsapp,
              cidade,
              uf,
              pretensao_salarial,
              origem,
              observacoes,
              curriculo_path,
              drive_folder_url,
              active,
              created_at,
              updated_at
            `,
          )
          .order('created_at', { ascending: false }),

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
              created_at,
              updated_at
            `,
          )
          .order('created_at', { ascending: false }),

        supabase
          .from('vagas')
          .select('id, numero, cargo, setor, status')
          .order('numero', { ascending: false }),
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

    if (candidaturasResult.error) {
      console.error(
        'Erro ao carregar candidaturas:',
        candidaturasResult.error.message,
      )
      setErro('Não foi possível carregar as candidaturas.')
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

    setCandidatos((candidatosResult.data ?? []) as Candidato[])
    setCandidaturas(
      (candidaturasResult.data ?? []) as Candidatura[],
    )
    setVagas((vagasResult.data ?? []) as Vaga[])
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

  const candidaturasPorCandidato = useMemo(() => {
    const map = new Map<string, Candidatura[]>()

    for (const candidatura of candidaturas) {
      const current = map.get(candidatura.candidato_id) ?? []
      current.push(candidatura)
      map.set(candidatura.candidato_id, current)
    }

    return map
  }, [candidaturas])

  const candidatosFiltrados = useMemo(() => {
    const termo = pesquisa.trim().toLowerCase()

    return candidatos.filter((candidato) => {
      const applications =
        candidaturasPorCandidato.get(candidato.id) ?? []

      const atendePesquisa =
        !termo ||
        candidato.nome_completo.toLowerCase().includes(termo) ||
        candidato.email?.toLowerCase().includes(termo) ||
        candidato.whatsapp?.includes(termo) ||
        String(candidato.numero).includes(termo)

      const atendeStatus =
        filtroStatus === 'todos' ||
        applications.some(
          (application) => application.status === filtroStatus,
        )

      return atendePesquisa && atendeStatus
    })
  }, [
    candidatos,
    candidaturasPorCandidato,
    filtroStatus,
    pesquisa,
  ])

  const candidatoSelecionado = useMemo(
    () =>
      candidatos.find(
        (candidato) => candidato.id === candidatoSelecionadoId,
      ) ?? null,
    [candidatoSelecionadoId, candidatos],
  )

  const candidaturasSelecionadas = useMemo(
    () =>
      candidatoSelecionado
        ? candidaturasPorCandidato.get(candidatoSelecionado.id) ?? []
        : [],
    [candidatoSelecionado, candidaturasPorCandidato],
  )

  function escolherCandidaturaPrincipal(
    applications: Candidatura[],
  ) {
    return (
      applications.find(
        (application) => application.status === 'ativo',
      ) ?? applications[0] ?? null
    )
  }

  function abrirNovoCandidato() {
    setForm(initialCandidateForm)
    setCandidatoEditandoId(null)
    setErro('')
    setMensagem('')
    setModalCandidatoAberto(true)
  }

  function abrirEdicao(candidato: Candidato) {
    setForm({
      nome_completo: candidato.nome_completo,
      email: candidato.email ?? '',
      whatsapp: candidato.whatsapp ?? '',
      cidade: candidato.cidade ?? '',
      uf: candidato.uf ?? '',
      pretensao_salarial:
        candidato.pretensao_salarial === null
          ? ''
          : String(candidato.pretensao_salarial),
      origem: candidato.origem,
      observacoes: candidato.observacoes ?? '',
      vaga_id: '',
        })
    setCandidatoEditandoId(candidato.id)
    setErro('')
    setMensagem('')
    setModalCandidatoAberto(true)
  }

  function fecharModalCandidato() {
    if (salvando) {
      return
    }

    setModalCandidatoAberto(false)
    setCandidatoEditandoId(null)
    setForm(initialCandidateForm)
    setErro('')
  }

  function abrirNovaCandidatura(candidato: Candidato) {
    setApplicationForm({
      ...initialApplicationForm,
      candidato_id: candidato.id,
    })
    setErro('')
    setMensagem('')
    setModalCandidaturaAberto(true)
  }

  function abrirDetalhes(candidato: Candidato) {
    setCandidatoSelecionadoId(candidato.id)
    setErro('')
    setMensagem('')
    setModalDetalhesAberto(true)
  }

  function fecharDetalhes() {
    setModalDetalhesAberto(false)
    setCandidatoSelecionadoId(null)
    setErro('')
  }

  function editarPelosDetalhes(candidato: Candidato) {
    setModalDetalhesAberto(false)
    abrirEdicao(candidato)
  }

  function novaCandidaturaPelosDetalhes(candidato: Candidato) {
    setModalDetalhesAberto(false)
    abrirNovaCandidatura(candidato)
  }

  function fecharModalCandidatura() {
    if (salvando) {
      return
    }

    setModalCandidaturaAberto(false)
    setApplicationForm(initialApplicationForm)
    setErro('')
  }

  async function salvarCandidato(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault()
    setErro('')
    setMensagem('')

    const nome = form.nome_completo.trim()
    const email = form.email.trim().toLowerCase()
    const whatsapp = normalizePhone(form.whatsapp)
    const uf = form.uf.trim().toUpperCase()
    const pretensao = nullableNumber(form.pretensao_salarial)

    if (nome.length < 3) {
      setErro('Informe o nome completo do candidato.')
      return
    }

    if (
      email &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    ) {
      setErro('Informe um e-mail válido.')
      return
    }

    if (
      whatsapp &&
      (whatsapp.length < 10 || whatsapp.length > 13)
    ) {
      setErro('Informe um WhatsApp válido com DDD.')
      return
    }

    if (uf && !/^[A-Z]{2}$/.test(uf)) {
      setErro('Informe a UF com duas letras, por exemplo SP.')
      return
    }

    const emailDuplicado =
      Boolean(email) &&
      candidatos.some(
        (candidato) =>
          candidato.id !== candidatoEditandoId &&
          candidato.email?.trim().toLowerCase() === email,
      )

    if (emailDuplicado) {
      setErro('Já existe um candidato cadastrado com esse e-mail.')
      return
    }

    const whatsappDuplicado =
      Boolean(whatsapp) &&
      candidatos.some(
        (candidato) =>
          candidato.id !== candidatoEditandoId &&
          normalizePhone(candidato.whatsapp ?? '') === whatsapp,
      )

    if (whatsappDuplicado) {
      setErro('Já existe um candidato cadastrado com esse WhatsApp.')
      return
    }

    if (!candidatoEditandoId && !form.vaga_id) {
      setErro('Selecione a vaga da candidatura inicial.')
      return
    }

    setSalvando(true)

    const payload = {
      nome_completo: nome,
      email: email || null,
      whatsapp: whatsapp || null,
      cidade: nullableText(form.cidade),
      uf: uf || null,
      pretensao_salarial: pretensao,
      origem: form.origem,
      observacoes: nullableText(form.observacoes),
    }

    if (candidatoEditandoId) {
      const { error } = await supabase
        .from('candidatos')
        .update(payload)
        .eq('id', candidatoEditandoId)

      setSalvando(false)

      if (error) {
        console.error(
          'Erro ao atualizar candidato:',
          error.message,
        )
        if (error.code === '23505') {
          const detail = `${error.message} ${error.details ?? ''}`.toLowerCase()

          setErro(
            detail.includes('whatsapp')
              ? 'Já existe um candidato cadastrado com esse WhatsApp.'
              : 'Já existe um candidato cadastrado com esse e-mail.',
          )
        } else {
          setErro('Não foi possível atualizar o candidato.')
        }
        return
      }

      setModalCandidatoAberto(false)
      setCandidatoEditandoId(null)
      setForm(initialCandidateForm)
      setMensagem('Candidato atualizado com sucesso.')
      await carregarDados()
      return
    }

    const { data: candidatoCriado, error: candidatoError } =
      await supabase
        .from('candidatos')
        .insert(payload)
        .select('id')
        .single()

    if (candidatoError || !candidatoCriado) {
      setSalvando(false)
      console.error(
        'Erro ao criar candidato:',
        candidatoError?.message,
      )

      if (candidatoError?.code === '23505') {
        const detail = `${candidatoError.message} ${
          candidatoError.details ?? ''
        }`.toLowerCase()

        setErro(
          detail.includes('whatsapp')
            ? 'Já existe um candidato cadastrado com esse WhatsApp.'
            : 'Já existe um candidato cadastrado com esse e-mail.',
        )
      } else {
        setErro('Não foi possível criar o candidato.')
      }

      return
    }

    const { error: applicationError } = await supabase
      .from('candidaturas')
      .insert({
        candidato_id: candidatoCriado.id,
        vaga_id: form.vaga_id,
        etapa: 'recebido',
        status: 'ativo',
      })

    setSalvando(false)

    if (applicationError) {
      console.error(
        'Erro ao criar candidatura:',
        applicationError.message,
      )
      setErro(
        'O candidato foi criado, mas não foi possível vinculá-lo à vaga. Use o botão “Nova candidatura” na listagem.',
      )
      await carregarDados()
      return
    }

    setModalCandidatoAberto(false)
    setForm(initialCandidateForm)
    setMensagem('Candidato e candidatura criados com sucesso.')
    await carregarDados()
  }

  async function criarCandidatura(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault()
    setErro('')
    setMensagem('')

    if (!applicationForm.vaga_id) {
      setErro('Selecione uma vaga.')
      return
    }

    const jaExiste = candidaturas.some(
      (item) =>
        item.candidato_id === applicationForm.candidato_id &&
        item.vaga_id === applicationForm.vaga_id,
    )

    if (jaExiste) {
      setErro('Este candidato já está vinculado a essa vaga.')
      return
    }

    setSalvando(true)

    const { error } = await supabase.from('candidaturas').insert({
      candidato_id: applicationForm.candidato_id,
      vaga_id: applicationForm.vaga_id,
      etapa: applicationForm.etapa,
      status: 'ativo',
      observacoes: nullableText(applicationForm.observacoes),
    })

    setSalvando(false)

    if (error) {
      console.error('Erro ao criar candidatura:', error.message)
      setErro('Não foi possível criar a candidatura.')
      return
    }

    setModalCandidaturaAberto(false)
    setApplicationForm(initialApplicationForm)
    setMensagem('Candidatura criada com sucesso.')
    await carregarDados()
  }

  if (carregando) {
    return (
      <section className="candidates-panel candidates-loading">
        <div className="candidates-loading-icon">CD</div>
        <p>Carregando candidatos...</p>
      </section>
    )
  }

  return (
    <>
      <section className="candidates-panel">
        <header className="candidates-header">
          <div>
            <span className="candidates-eyebrow">
              Recrutamento
            </span>
            <h2>Candidatos</h2>
            <p>
              Cadastre pessoas, vincule vagas e acompanhe os
              processos seletivos.
            </p>
          </div>

          <div className="candidates-header-actions">
            <button
              className="candidates-secondary-button"
              type="button"
              onClick={carregarDados}
            >
              Atualizar
            </button>

            <button
              className="candidates-primary-button"
              type="button"
              onClick={abrirNovoCandidato}
            >
              + Novo candidato
            </button>
          </div>
        </header>

        <div className="candidates-toolbar">
          <div className="candidates-search">
            <label htmlFor="pesquisa-candidato">
              Pesquisar
            </label>
            <input
              id="pesquisa-candidato"
              type="search"
              placeholder="Nome, e-mail, WhatsApp ou código..."
              value={pesquisa}
              onChange={(event) => setPesquisa(event.target.value)}
            />
          </div>

          <div className="candidates-filter">
            <label htmlFor="filtro-status-candidato">
              Situação
            </label>
            <select
              id="filtro-status-candidato"
              value={filtroStatus}
              onChange={(event) =>
                setFiltroStatus(
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

          <div className="candidates-summary">
            <span>Candidatos</span>
            <strong>{candidatos.length}</strong>
          </div>

          <div className="candidates-summary">
            <span>Candidaturas ativas</span>
            <strong>
              {
                candidaturas.filter(
                  (item) => item.status === 'ativo',
                ).length
              }
            </strong>
          </div>
        </div>


        <div className="candidates-list">
          {candidatosFiltrados.map((candidato) => {
            const applications =
              candidaturasPorCandidato.get(candidato.id) ?? []
            const candidaturaPrincipal =
              escolherCandidaturaPrincipal(applications)
            const vagaPrincipal = candidaturaPrincipal
              ? vagas.find(
                  (vaga) =>
                    vaga.id === candidaturaPrincipal.vaga_id,
                )
              : null

            return (
              <article
                className="candidate-card candidate-card-compact"
                key={candidato.id}
              >
                <div className="candidate-avatar">
                  {candidato.nome_completo
                    .charAt(0)
                    .toUpperCase()}
                </div>

                <div className="candidate-content">
                  <div className="candidate-title-row">
                    <div>
                      <span className="candidate-code">
                        CAN-
                        {String(candidato.numero).padStart(
                          6,
                          '0',
                        )}
                      </span>
                      <h3>{candidato.nome_completo}</h3>
                    </div>

                    <span
                      className={
                        candidato.active
                          ? 'candidate-active'
                          : 'candidate-inactive'
                      }
                    >
                      {candidato.active ? 'Ativo' : 'Inativo'}
                    </span>
                  </div>

                  {candidaturaPrincipal ? (
                    <div className="candidate-main-vacancy">
                      <div>
                        <span className="candidate-section-label">
                          Vaga atual
                        </span>
                        <strong>
                          {vagaPrincipal
                            ? `VAG-${String(
                                vagaPrincipal.numero,
                              ).padStart(6, '0')} — ${
                                vagaPrincipal.cargo
                              }`
                            : 'Vaga não encontrada'}
                        </strong>
                        <small>
                          {vagaPrincipal?.setor ??
                            'Setor não informado'}
                        </small>
                      </div>

                      <div className="candidate-badges">
                        <span
                          className={`candidate-stage stage-${candidaturaPrincipal.etapa}`}
                        >
                          {
                            etapaLabels[
                              candidaturaPrincipal.etapa
                            ]
                          }
                        </span>

                        <span
                          className={`candidate-status application-${candidaturaPrincipal.status}`}
                        >
                          {
                            statusLabels[
                              candidaturaPrincipal.status
                            ]
                          }
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="candidate-main-vacancy empty">
                      <div>
                        <span className="candidate-section-label">
                          Vaga atual
                        </span>
                        <strong>
                          Nenhuma candidatura vinculada
                        </strong>
                      </div>
                    </div>
                  )}

                  {applications.length > 1 && (
                    <span className="candidate-more-processes">
                      + {applications.length - 1} processo(s) em
                      detalhes
                    </span>
                  )}
                </div>

                <div className="candidate-actions">
                  <button
                    className="primary"
                    type="button"
                    onClick={() => abrirDetalhes(candidato)}
                  >
                    Ver detalhes
                  </button>
                </div>
              </article>
            )
          })}

          {candidatosFiltrados.length === 0 && (
            <div className="candidates-empty">
              <div>CD</div>
              <strong>Nenhum candidato encontrado</strong>
              <p>
                Cadastre um novo candidato ou altere os filtros.
              </p>
            </div>
          )}
        </div>
      </section>

      {(erro || mensagem) && (
        <aside
          className={`candidates-toast ${erro ? 'error' : 'success'}`}
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

      {modalDetalhesAberto && candidatoSelecionado && (
        <div
          className="candidates-modal-overlay"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              fecharDetalhes()
            }
          }}
        >
          <section
            className="candidates-modal candidate-details-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="titulo-detalhes-candidato"
          >
            <header className="candidates-modal-header">
              <div className="candidate-details-heading">
                <div className="candidate-avatar large">
                  {candidatoSelecionado.nome_completo
                    .charAt(0)
                    .toUpperCase()}
                </div>

                <div>
                  <span className="candidates-eyebrow">
                    CAN-
                    {String(
                      candidatoSelecionado.numero,
                    ).padStart(6, '0')}
                  </span>
                  <h2 id="titulo-detalhes-candidato">
                    {candidatoSelecionado.nome_completo}
                  </h2>
                  <span
                    className={
                      candidatoSelecionado.active
                        ? 'candidate-active'
                        : 'candidate-inactive'
                    }
                  >
                    {candidatoSelecionado.active
                      ? 'Ativo'
                      : 'Inativo'}
                  </span>
                </div>
              </div>

              <button
                className="candidates-close-button"
                type="button"
                onClick={fecharDetalhes}
                aria-label="Fechar"
              >
                ×
              </button>
            </header>

            <div className="candidate-details-body">
              <section className="candidate-details-section">
                <div className="candidate-details-section-header">
                  <div>
                    <h3>Dados do candidato</h3>
                    <p>
                      Informações pessoais e dados do processo
                      seletivo.
                    </p>
                  </div>

                  <button
                    className="candidate-details-edit-button"
                    type="button"
                    onClick={() =>
                      editarPelosDetalhes(candidatoSelecionado)
                    }
                  >
                    Editar dados
                  </button>
                </div>

                <div className="candidate-details-grid">
                  <div>
                    <span>E-mail</span>
                    <strong>
                      {candidatoSelecionado.email ??
                        'Não informado'}
                    </strong>
                  </div>


                  <div>
                    <span>WhatsApp</span>
                    <strong>
                      {formatPhone(
                        candidatoSelecionado.whatsapp,
                      )}
                    </strong>
                  </div>

                  <div>
                    <span>Cidade / UF</span>
                    <strong>
                      {[
                        candidatoSelecionado.cidade,
                        candidatoSelecionado.uf,
                      ]
                        .filter(Boolean)
                        .join(' / ') || 'Não informado'}
                    </strong>
                  </div>

                  <div>
                    <span>Origem</span>
                    <strong>
                      {
                        origemLabels[
                          candidatoSelecionado.origem
                        ]
                      }
                    </strong>
                  </div>


                  <div>
                    <span>Pretensão salarial</span>
                    <strong>
                      {formatCurrency(
                        candidatoSelecionado.pretensao_salarial,
                      )}
                    </strong>
                  </div>


                </div>

                {candidatoSelecionado.observacoes && (
                  <div className="candidate-details-notes">
                    <span>Observações</span>
                    <p>{candidatoSelecionado.observacoes}</p>
                  </div>
                )}
              </section>

              <section className="candidate-details-section">
                <div className="candidate-details-section-header">
                  <div>
                    <h3>Vagas e candidaturas</h3>
                    <p>
                      Histórico dos processos seletivos desse
                      candidato.
                    </p>
                  </div>

                  <button
                    className="candidate-details-new-application"
                    type="button"
                    onClick={() =>
                      novaCandidaturaPelosDetalhes(
                        candidatoSelecionado,
                      )
                    }
                  >
                    + Nova candidatura
                  </button>
                </div>

                {candidaturasSelecionadas.length > 0 ? (
                  <div className="candidate-details-application-list">
                    {candidaturasSelecionadas.map(
                      (application) => {
                        const vaga = vagas.find(
                          (item) =>
                            item.id === application.vaga_id,
                        )

                        return (
                          <article
                            className="candidate-details-application"
                            key={application.id}
                          >
                            <div>
                              <strong>
                                {vaga
                                  ? `VAG-${String(
                                      vaga.numero,
                                    ).padStart(6, '0')} — ${
                                      vaga.cargo
                                    }`
                                  : 'Vaga não encontrada'}
                              </strong>
                              <span>
                                {vaga?.setor ??
                                  'Setor não informado'}
                              </span>
                            </div>

                            <div className="candidate-badges">
                              <span
                                className={`candidate-stage stage-${application.etapa}`}
                              >
                                {etapaLabels[application.etapa]}
                              </span>

                              <span
                                className={`candidate-status application-${application.status}`}
                              >
                                {statusLabels[application.status]}
                              </span>
                            </div>
                          </article>
                        )
                      },
                    )}
                  </div>
                ) : (
                  <div className="candidate-details-no-application">
                    <strong>Nenhuma vaga vinculada</strong>
                    <p>
                      Crie uma candidatura para iniciar o
                      acompanhamento no Pipeline.
                    </p>
                  </div>
                )}
              </section>
            </div>
          </section>
        </div>
      )}

      {modalCandidatoAberto && (
        <div
          className="candidates-modal-overlay"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              fecharModalCandidato()
            }
          }}
        >
          <section
            className="candidates-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="titulo-formulario-candidato"
          >
            <header className="candidates-modal-header">
              <div>
                <span className="candidates-eyebrow">
                  {candidatoEditandoId ? 'Edição' : 'Cadastro'}
                </span>
                <h2 id="titulo-formulario-candidato">
                  {candidatoEditandoId
                    ? 'Editar candidato'
                    : 'Novo candidato'}
                </h2>
              </div>

              <button
                className="candidates-close-button"
                type="button"
                onClick={fecharModalCandidato}
                disabled={salvando}
                aria-label="Fechar"
              >
                ×
              </button>
            </header>

            <form onSubmit={salvarCandidato}>

              {!candidatoEditandoId && (
                <div className="candidates-form-section candidate-vacancy-first">
                  <h3>Vaga da candidatura</h3>
                  <p className="candidates-form-description">
                    Selecione a vaga em que o candidato está concorrendo.
                  </p>

                  <div className="candidates-form-group full">
                    <label htmlFor="candidato-vaga">Vaga *</label>
                    <select
                      id="candidato-vaga"
                      value={form.vaga_id}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          vaga_id: event.target.value,
                        }))
                      }
                      disabled={salvando}
                    >
                      <option value="">Selecione</option>
                      {vagas
                        .filter((vaga) =>
                          ['aberta', 'em_selecao'].includes(
                            vaga.status,
                          ),
                        )
                        .map((vaga) => (
                          <option key={vaga.id} value={vaga.id}>
                            VAG-
                            {String(vaga.numero).padStart(6, '0')}{' '}
                            — {vaga.cargo} · {vaga.setor}
                          </option>
                        ))}
                    </select>
                  </div>
                </div>
              )}

              <div className="candidates-form-section">
                <h3>Dados pessoais</h3>

                <div className="candidates-form-grid">
                  <div className="candidates-form-group full-column">
                    <label htmlFor="candidato-nome">
                      Nome completo *
                    </label>
                    <input
                      id="candidato-nome"
                      type="text"
                      value={form.nome_completo}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          nome_completo: event.target.value,
                        }))
                      }
                      disabled={salvando}
                      autoFocus
                    />
                  </div>

                  <div className="candidates-form-group">
                    <label htmlFor="candidato-email">
                      E-mail
                    </label>
                    <input
                      id="candidato-email"
                      type="email"
                      value={form.email}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          email: event.target.value,
                        }))
                      }
                      disabled={salvando}
                    />
                  </div>


                  <div className="candidates-form-group">
                    <label htmlFor="candidato-whatsapp">
                      WhatsApp
                    </label>
                    <input
                      id="candidato-whatsapp"
                      type="tel"
                      placeholder="DDD + número"
                      value={form.whatsapp}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          whatsapp: event.target.value,
                        }))
                      }
                      disabled={salvando}
                    />
                  </div>

                  <div className="candidates-form-group">
                    <label htmlFor="candidato-cidade">
                      Cidade
                    </label>
                    <input
                      id="candidato-cidade"
                      type="text"
                      value={form.cidade}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          cidade: event.target.value,
                        }))
                      }
                      disabled={salvando}
                    />
                  </div>

                  <div className="candidates-form-group">
                    <label htmlFor="candidato-uf">UF</label>
                    <input
                      id="candidato-uf"
                      type="text"
                      maxLength={2}
                      placeholder="SP"
                      value={form.uf}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          uf: event.target.value.toUpperCase(),
                        }))
                      }
                      disabled={salvando}
                    />
                  </div>

                  <div className="candidates-form-group">
                    <label htmlFor="candidato-pretensao">
                      Pretensão salarial
                    </label>
                    <input
                      id="candidato-pretensao"
                      type="number"
                      min="0"
                      step="0.01"
                      value={form.pretensao_salarial}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          pretensao_salarial:
                            event.target.value,
                        }))
                      }
                      disabled={salvando}
                    />
                  </div>


                  <div className="candidates-form-group">
                    <label htmlFor="candidato-origem">
                      Origem
                    </label>
                    <select
                      id="candidato-origem"
                      value={form.origem}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          origem:
                            event.target.value as CandidatoOrigem,
                        }))
                      }
                      disabled={salvando}
                    >
                      {Object.entries(origemLabels).map(
                        ([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ),
                      )}
                    </select>
                  </div>

                </div>

                <div className="candidates-form-group full">
                  <label htmlFor="candidato-observacoes">
                    Observações
                  </label>
                  <textarea
                    id="candidato-observacoes"
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



              <footer className="candidates-modal-actions">
                <button
                  className="candidates-secondary-button"
                  type="button"
                  onClick={fecharModalCandidato}
                  disabled={salvando}
                >
                  Cancelar
                </button>

                <button
                  className="candidates-primary-button"
                  type="submit"
                  disabled={salvando}
                >
                  {salvando
                    ? 'Salvando...'
                    : candidatoEditandoId
                      ? 'Salvar alterações'
                      : 'Criar candidato'}
                </button>
              </footer>
            </form>
          </section>
        </div>
      )}

      {modalCandidaturaAberto && (
        <div
          className="candidates-modal-overlay"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              fecharModalCandidatura()
            }
          }}
        >
          <section
            className="candidates-modal small"
            role="dialog"
            aria-modal="true"
            aria-labelledby="titulo-nova-candidatura"
          >
            <header className="candidates-modal-header">
              <div>
                <span className="candidates-eyebrow">
                  Processo seletivo
                </span>
                <h2 id="titulo-nova-candidatura">
                  Nova candidatura
                </h2>
              </div>

              <button
                className="candidates-close-button"
                type="button"
                onClick={fecharModalCandidatura}
                disabled={salvando}
                aria-label="Fechar"
              >
                ×
              </button>
            </header>

            <form onSubmit={criarCandidatura}>
              <div className="candidates-form-section">
                <div className="candidates-form-group full">
                  <label htmlFor="nova-candidatura-vaga">
                    Vaga *
                  </label>
                  <select
                    id="nova-candidatura-vaga"
                    value={applicationForm.vaga_id}
                    onChange={(event) =>
                      setApplicationForm((current) => ({
                        ...current,
                        vaga_id: event.target.value,
                      }))
                    }
                    disabled={salvando}
                  >
                    <option value="">Selecione</option>
                    {vagas.map((vaga) => (
                      <option key={vaga.id} value={vaga.id}>
                        VAG-
                        {String(vaga.numero).padStart(6, '0')}{' '}
                        — {vaga.cargo} ({vaga.status})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="candidates-form-group full">
                  <label htmlFor="nova-candidatura-etapa">
                    Etapa inicial
                  </label>
                  <select
                    id="nova-candidatura-etapa"
                    value={applicationForm.etapa}
                    onChange={(event) =>
                      setApplicationForm((current) => ({
                        ...current,
                        etapa:
                          event.target.value as CandidaturaEtapa,
                      }))
                    }
                    disabled={salvando}
                  >
                    {applicationStageOptions.map((value) => (
                      <option key={value} value={value}>
                        {etapaLabels[value]}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="candidates-form-group full">
                  <label htmlFor="nova-candidatura-observacao">
                    Observações
                  </label>
                  <textarea
                    id="nova-candidatura-observacao"
                    rows={3}
                    value={applicationForm.observacoes}
                    onChange={(event) =>
                      setApplicationForm((current) => ({
                        ...current,
                        observacoes: event.target.value,
                      }))
                    }
                    disabled={salvando}
                  />
                </div>
              </div>


              <footer className="candidates-modal-actions">
                <button
                  className="candidates-secondary-button"
                  type="button"
                  onClick={fecharModalCandidatura}
                  disabled={salvando}
                >
                  Cancelar
                </button>

                <button
                  className="candidates-primary-button"
                  type="submit"
                  disabled={salvando}
                >
                  {salvando
                    ? 'Criando...'
                    : 'Criar candidatura'}
                </button>
              </footer>
            </form>
          </section>
        </div>
      )}
    </>
  )
}

export default Candidatos
