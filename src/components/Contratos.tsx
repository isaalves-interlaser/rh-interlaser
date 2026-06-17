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
          'id, candidatura_id, candidato_id, vaga_id, empresa_id, filial_id, status, numero_contrato, data_admissao, tipo_contrato, cargo, setor, salario, jornada, gestor_nome, gestor_email, observacoes, created_at, updated_at',
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
                  <td colSpan={7}>
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
                      setForm((current) =>
                        current
                          ? {
                              ...current,
                              data_admissao:
                                event.target.value,
                            }
                          : current,
                      )
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
