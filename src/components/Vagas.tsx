import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from 'react'
import { supabase } from '../lib/supabase'
import { criarPastaVagaDrive } from '../lib/googleDriveRh'
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
  empresa_id: string
  filial_id: string
  cargo: string
  setor: string
  tipo_contrato: VagaContrato
  modalidade: VagaModalidade
  prioridade: VagaPrioridade
  status: VagaStatus
  data_limite: string | null
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


type VagasProps = {
  responsavelRhEmail?: string
}

function Vagas({ responsavelRhEmail = '' }: VagasProps) {
  const [vagas, setVagas] = useState<Vaga[]>([])
  const [empresas, setEmpresas] = useState<Empresa[]>([])
  const [filiais, setFiliais] = useState<Filial[]>([])
  const [candidaturas, setCandidaturas] = useState<Candidatura[]>([])
  const [candidatos, setCandidatos] = useState<Candidato[]>([])
  const [vagaDetalhesId, setVagaDetalhesId] = useState<string | null>(null)
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
            'id, numero, empresa_id, filial_id, cargo, setor, tipo_contrato, modalidade, prioridade, status, data_limite, resumo_publico, descricao_publica, atividades, requisitos, beneficios, horario_trabalho, salario_faixa, observacoes_publicas, created_at, drive_folder_id, drive_folder_url',
          )
          .order('created_at', { ascending: false }),
        supabase
          .from('candidaturas')
          .select('id, candidato_id, vaga_id, etapa, status, data_entrada')
          .order('data_entrada', { ascending: false }),
        supabase
          .from('candidatos')
          .select('id, numero, nome_completo, email, whatsapp')
          .order('nome_completo'),
      ])

    if (
      empresasResult.error ||
      filiaisResult.error ||
      vagasResult.error ||
      candidaturasResult.error ||
      candidatosResult.error
    ) {
      console.error(
        empresasResult.error ||
          filiaisResult.error ||
          vagasResult.error ||
          candidaturasResult.error ||
          candidatosResult.error,
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

  function abrirNovaVaga() {
    setForm(initialForm)
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
                        onClick={() => setVagaDetalhesId(vaga.id)}
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
                          onClick={() => setVagaDetalhesId(vaga.id)}
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
                          onClick={() => setVagaDetalhesId(vaga.id)}
                        >
                          Ver candidatos
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
                  <td colSpan={11}>
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
              setVagaDetalhesId(null)
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
                onClick={() => setVagaDetalhesId(null)}
                aria-label="Fechar"
              >
                ×
              </button>
            </header>

            <div className="vacancy-candidates-list">
              {candidaturasDaVaga.map((candidatura) => {
                const candidato = candidatos.find(
                  (item) => item.id === candidatura.candidato_id,
                )

                if (!candidato) {
                  return null
                }

                const contratado =
                  candidatura.status === 'contratado' ||
                  candidatura.etapa === 'contratado'

                return (
                  <article
                    className={
                      contratado
                        ? 'vacancy-candidate-card hired'
                        : 'vacancy-candidate-card'
                    }
                    key={candidatura.id}
                  >
                    <div className="vacancy-candidate-avatar">
                      {candidato.nome_completo.charAt(0).toUpperCase()}
                    </div>

                    <div className="vacancy-candidate-main">
                      <strong>{candidato.nome_completo}</strong>
                      <span>
                        CAN-{String(candidato.numero).padStart(6, '0')}
                        {candidato.email ? ` · ${candidato.email}` : ''}
                      </span>
                    </div>

                    <div className="vacancy-candidate-process">
                      {contratado && (
                        <span className="vacancy-hired-badge">
                          Candidato contratado
                        </span>
                      )}
                      <span className={`vacancy-stage stage-${candidatura.etapa}`}>
                        {candidatura.etapa.replaceAll('_', ' ')}
                      </span>
                      <span className={`vacancy-application-status application-${candidatura.status}`}>
                        {candidatura.status.replaceAll('_', ' ')}
                      </span>
                    </div>
                  </article>
                )
              })}

              {candidaturasDaVaga.length === 0 && (
                <div className="vacancy-candidates-empty">
                  <div>VG</div>
                  <strong>Nenhum candidato vinculado</strong>
                  <p>
                    Os candidatos aparecerão aqui quando forem cadastrados
                    nesta vaga.
                  </p>
                </div>
              )}
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
                    {Object.entries(statusLabels).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
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
                  <label htmlFor="vaga-beneficios">Benefícios</label>
                  <textarea
                    id="vaga-beneficios"
                    value={form.beneficios}
                    onChange={(event) =>
                      setForm((atual) => ({
                        ...atual,
                        beneficios: event.target.value,
                      }))
                    }
                    disabled={salvando}
                    rows={3}
                    placeholder="Ex.: Vale transporte, refeição, cesta básica, convênio médico."
                  />
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
