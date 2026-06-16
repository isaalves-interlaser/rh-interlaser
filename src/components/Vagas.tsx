import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from 'react'
import { supabase } from '../lib/supabase'
import './Vagas.css'

type VagaStatus =
  | 'rascunho'
  | 'aguardando_aprovacao'
  | 'aberta'
  | 'em_selecao'
  | 'suspensa'
  | 'preenchida'
  | 'cancelada'

type VagaPrioridade = 'normal' | 'alta' | 'urgente'
type VagaContrato =
  | 'clt'
  | 'pj'
  | 'temporario'
  | 'estagio'
  | 'aprendiz'
  | 'terceiro'
type VagaModalidade = 'presencial' | 'hibrido' | 'remoto'
type VagaMotivo =
  | 'substituicao'
  | 'aumento_quadro'
  | 'temporaria'
  | 'outro'

type Empresa = {
  id: string
  nome_fantasia: string
}

type Filial = {
  id: string
  empresa_id: string
  codigo: string
  nome: string
}

type Vaga = {
  id: string
  numero: number
  empresa_id: string
  filial_id: string
  cargo: string
  setor: string
  quantidade: number
  motivo: VagaMotivo
  justificativa: string
  tipo_contrato: VagaContrato
  modalidade: VagaModalidade
  prioridade: VagaPrioridade
  status: VagaStatus
  data_limite: string | null
  created_at: string
}

type VagaForm = {
  empresa_id: string
  filial_id: string
  cargo: string
  setor: string
  quantidade: string
  motivo: VagaMotivo
  justificativa: string
  tipo_contrato: VagaContrato
  modalidade: VagaModalidade
  prioridade: VagaPrioridade
  status: VagaStatus
  data_limite: string
}

const initialForm: VagaForm = {
  empresa_id: '',
  filial_id: '',
  cargo: '',
  setor: '',
  quantidade: '1',
  motivo: 'aumento_quadro',
  justificativa: '',
  tipo_contrato: 'clt',
  modalidade: 'presencial',
  prioridade: 'normal',
  status: 'rascunho',
  data_limite: '',
}

const statusLabels: Record<VagaStatus, string> = {
  rascunho: 'Rascunho',
  aguardando_aprovacao: 'Aguardando aprovação',
  aberta: 'Aberta',
  em_selecao: 'Em seleção',
  suspensa: 'Suspensa',
  preenchida: 'Preenchida',
  cancelada: 'Cancelada',
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

const motivoLabels: Record<VagaMotivo, string> = {
  substituicao: 'Substituição',
  aumento_quadro: 'Aumento de quadro',
  temporaria: 'Necessidade temporária',
  outro: 'Outro',
}

function formatDate(value: string | null) {
  if (!value) return '—'

  return new Intl.DateTimeFormat('pt-BR').format(
    new Date(`${value}T00:00:00`),
  )
}

function Vagas() {
  const [vagas, setVagas] = useState<Vaga[]>([])
  const [empresas, setEmpresas] = useState<Empresa[]>([])
  const [filiais, setFiliais] = useState<Filial[]>([])
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

    const [empresasResult, filiaisResult, vagasResult] =
      await Promise.all([
        supabase
          .from('empresas')
          .select('id, nome_fantasia')
          .eq('active', true)
          .order('nome_fantasia'),
        supabase
          .from('filiais')
          .select('id, empresa_id, codigo, nome')
          .eq('active', true)
          .order('nome'),
        supabase
          .from('vagas')
          .select(
            'id, numero, empresa_id, filial_id, cargo, setor, quantidade, motivo, justificativa, tipo_contrato, modalidade, prioridade, status, data_limite, created_at',
          )
          .order('created_at', { ascending: false }),
      ])

    if (
      empresasResult.error ||
      filiaisResult.error ||
      vagasResult.error
    ) {
      console.error(
        empresasResult.error || filiaisResult.error || vagasResult.error,
      )
      setErro('Não foi possível carregar os dados das vagas.')
      setCarregando(false)
      return
    }

    setEmpresas((empresasResult.data ?? []) as Empresa[])
    setFiliais((filiaisResult.data ?? []) as Filial[])
    setVagas((vagasResult.data ?? []) as Vaga[])
    setCarregando(false)
  }, [])

  useEffect(() => {
    carregarDados()
  }, [carregarDados])

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
      const empresa =
        empresas.find((item) => item.id === vaga.empresa_id)
          ?.nome_fantasia ?? ''
      const filial =
        filiais.find((item) => item.id === vaga.filial_id)?.nome ?? ''

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
      quantidade: String(vaga.quantidade),
      motivo: vaga.motivo,
      justificativa: vaga.justificativa,
      tipo_contrato: vaga.tipo_contrato,
      modalidade: vaga.modalidade,
      prioridade: vaga.prioridade,
      status: vaga.status,
      data_limite: vaga.data_limite ?? '',
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

    const quantidade = Number(form.quantidade)

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

    if (!Number.isInteger(quantidade) || quantidade < 1) {
      setErro('A quantidade deve ser maior que zero.')
      return
    }

    if (!form.justificativa.trim()) {
      setErro('Informe a justificativa da contratação.')
      return
    }

    setSalvando(true)

    const payload = {
      empresa_id: form.empresa_id,
      filial_id: form.filial_id,
      cargo: form.cargo.trim(),
      setor: form.setor.trim(),
      quantidade,
      motivo: form.motivo,
      justificativa: form.justificativa.trim(),
      tipo_contrato: form.tipo_contrato,
      modalidade: form.modalidade,
      prioridade: form.prioridade,
      status: form.status,
      data_limite: form.data_limite || null,
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
          .insert(payload)
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

    setModalAberto(false)
    setEditandoId(null)
    setForm(initialForm)
    setMensagem(
      editandoId
        ? 'Vaga atualizada com sucesso.'
        : 'Vaga criada com sucesso.',
    )

    await carregarDados()
  }

  async function excluirVaga(vaga: Vaga) {
    setErro('')
    setMensagem('')

    if (vaga.status !== 'rascunho') {
      setErro(
        'Somente vagas em rascunho podem ser excluídas. Altere as demais para Cancelada.',
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

        {erro && (
          <div className="vacancies-message error" role="alert">
            {erro}
          </div>
        )}

        {mensagem && (
          <div className="vacancies-message success" role="status">
            {mensagem}
          </div>
        )}

        <div className="vacancies-table-wrapper">
          <table className="vacancies-table">
            <thead>
              <tr>
                <th>Código</th>
                <th>Cargo</th>
                <th>Empresa / filial</th>
                <th>Contrato</th>
                <th>Qtd.</th>
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
                          {empresa?.nome_fantasia ?? 'Empresa não encontrada'}
                        </strong>
                        <span>
                          {filial
                            ? `${filial.codigo} — ${filial.nome}`
                            : 'Filial não encontrada'}
                        </span>
                      </div>
                    </td>
                    <td>
                      <div className="vacancy-main-cell">
                        <strong>{contratoLabels[vaga.tipo_contrato]}</strong>
                        <span>{modalidadeLabels[vaga.modalidade]}</span>
                      </div>
                    </td>
                    <td>{vaga.quantidade}</td>
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
                            vaga.status !== 'rascunho'
                          }
                          title={
                            vaga.status === 'rascunho'
                              ? 'Excluir vaga'
                              : 'Apenas rascunhos podem ser excluídos'
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
                  <td colSpan={9}>
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
                        {empresa.nome_fantasia}
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
                        {filial.codigo} — {filial.nome}
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
                  <label htmlFor="vaga-quantidade">Quantidade *</label>
                  <input
                    id="vaga-quantidade"
                    type="number"
                    min="1"
                    step="1"
                    value={form.quantidade}
                    onChange={(event) =>
                      setForm((atual) => ({
                        ...atual,
                        quantidade: event.target.value,
                      }))
                    }
                    disabled={salvando}
                  />
                </div>

                <div className="vacancies-form-group">
                  <label htmlFor="vaga-motivo">Motivo *</label>
                  <select
                    id="vaga-motivo"
                    value={form.motivo}
                    onChange={(event) =>
                      setForm((atual) => ({
                        ...atual,
                        motivo: event.target.value as VagaMotivo,
                      }))
                    }
                    disabled={salvando}
                  >
                    {Object.entries(motivoLabels).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
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

                <div className="vacancies-form-group full">
                  <label htmlFor="vaga-justificativa">
                    Justificativa *
                  </label>
                  <textarea
                    id="vaga-justificativa"
                    rows={4}
                    value={form.justificativa}
                    onChange={(event) =>
                      setForm((atual) => ({
                        ...atual,
                        justificativa: event.target.value,
                      }))
                    }
                    disabled={salvando}
                  />
                </div>
              </div>

              {erro && (
                <div className="vacancies-message error" role="alert">
                  {erro}
                </div>
              )}

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
