import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from 'react'
import { supabase } from '../lib/supabase'
import './EmpresasFiliais.css'

type Empresa = {
  id: string
  razao_social: string
  nome_fantasia: string
  cnpj: string | null
  active: boolean
  created_at: string
  updated_at: string
}

type Filial = {
  id: string
  empresa_id: string
  codigo: string
  nome: string
  cnpj: string | null
  cidade: string | null
  uf: string | null
  active: boolean
  created_at: string
  updated_at: string
}

type EmpresaForm = {
  razao_social: string
  nome_fantasia: string
  cnpj: string
  active: boolean
}

type FilialForm = {
  empresa_id: string
  codigo: string
  nome: string
  cnpj: string
  cidade: string
  uf: string
  active: boolean
}

const initialEmpresaForm: EmpresaForm = {
  razao_social: '',
  nome_fantasia: '',
  cnpj: '',
  active: true,
}

const initialFilialForm: FilialForm = {
  empresa_id: '',
  codigo: '',
  nome: '',
  cnpj: '',
  cidade: '',
  uf: '',
  active: true,
}

function onlyDigits(value: string) {
  return value.replace(/\D/g, '')
}

function formatCnpj(value: string | null) {
  const digits = onlyDigits(value ?? '').slice(0, 14)

  if (digits.length !== 14) {
    return value || 'Não informado'
  }

  return digits.replace(
    /^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/,
    '$1.$2.$3/$4-$5',
  )
}

function EmpresasFiliais() {
  const [empresas, setEmpresas] = useState<Empresa[]>([])
  const [filiais, setFiliais] = useState<Filial[]>([])
  const [selectedEmpresaId, setSelectedEmpresaId] =
    useState<string | null>(null)
  const [pesquisa, setPesquisa] = useState('')
  const [carregando, setCarregando] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  const [mensagem, setMensagem] = useState('')

  const [empresaModalOpen, setEmpresaModalOpen] =
    useState(false)
  const [empresaEditandoId, setEmpresaEditandoId] =
    useState<string | null>(null)
  const [empresaForm, setEmpresaForm] =
    useState<EmpresaForm>(initialEmpresaForm)

  const [filialModalOpen, setFilialModalOpen] =
    useState(false)
  const [filialEditandoId, setFilialEditandoId] =
    useState<string | null>(null)
  const [filialForm, setFilialForm] =
    useState<FilialForm>(initialFilialForm)

  const carregarDados = useCallback(async () => {
    setCarregando(true)
    setErro('')

    const [empresasResult, filiaisResult] =
      await Promise.all([
        supabase
          .from('empresas')
          .select(
            'id, razao_social, nome_fantasia, cnpj, active, created_at, updated_at',
          )
          .order('nome_fantasia'),
        supabase
          .from('filiais')
          .select(
            'id, empresa_id, codigo, nome, cnpj, cidade, uf, active, created_at, updated_at',
          )
          .order('nome'),
      ])

    const firstError =
      empresasResult.error ?? filiaisResult.error

    if (firstError) {
      console.error(
        'Erro ao carregar empresas e filiais:',
        firstError.message,
      )
      setErro(
        'Não foi possível carregar as empresas e filiais.',
      )
      setCarregando(false)
      return
    }

    const loadedEmpresas =
      (empresasResult.data ?? []) as Empresa[]

    setEmpresas(loadedEmpresas)
    setFiliais((filiaisResult.data ?? []) as Filial[])

    setSelectedEmpresaId((current) => {
      if (
        current &&
        loadedEmpresas.some(
          (empresa) => empresa.id === current,
        )
      ) {
        return current
      }

      return loadedEmpresas[0]?.id ?? null
    })

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

  const empresasFiltradas = useMemo(() => {
    const term = pesquisa.trim().toLowerCase()

    if (!term) {
      return empresas
    }

    return empresas.filter((empresa) => {
      return (
        empresa.nome_fantasia
          .toLowerCase()
          .includes(term) ||
        empresa.razao_social
          .toLowerCase()
          .includes(term) ||
        onlyDigits(empresa.cnpj ?? '').includes(
          onlyDigits(term),
        )
      )
    })
  }, [empresas, pesquisa])

  const selectedEmpresa =
    empresas.find(
      (empresa) => empresa.id === selectedEmpresaId,
    ) ?? null

  const filiaisDaEmpresa = useMemo(
    () =>
      filiais.filter(
        (filial) =>
          filial.empresa_id === selectedEmpresaId,
      ),
    [filiais, selectedEmpresaId],
  )

  function openNewEmpresa() {
    setEmpresaEditandoId(null)
    setEmpresaForm(initialEmpresaForm)
    setErro('')
    setMensagem('')
    setEmpresaModalOpen(true)
  }

  function openEditEmpresa(empresa: Empresa) {
    setEmpresaEditandoId(empresa.id)
    setEmpresaForm({
      razao_social: empresa.razao_social,
      nome_fantasia: empresa.nome_fantasia,
      cnpj: empresa.cnpj ?? '',
      active: empresa.active,
    })
    setErro('')
    setMensagem('')
    setEmpresaModalOpen(true)
  }

  function closeEmpresaModal() {
    if (salvando) {
      return
    }

    setEmpresaModalOpen(false)
    setEmpresaEditandoId(null)
    setEmpresaForm(initialEmpresaForm)
  }

  function openNewFilial() {
    if (!selectedEmpresa) {
      setErro(
        'Cadastre ou selecione uma empresa antes de criar a filial.',
      )
      return
    }

    setFilialEditandoId(null)
    setFilialForm({
      ...initialFilialForm,
      empresa_id: selectedEmpresa.id,
    })
    setErro('')
    setMensagem('')
    setFilialModalOpen(true)
  }

  function openEditFilial(filial: Filial) {
    setFilialEditandoId(filial.id)
    setFilialForm({
      empresa_id: filial.empresa_id,
      codigo: filial.codigo,
      nome: filial.nome,
      cnpj: filial.cnpj ?? '',
      cidade: filial.cidade ?? '',
      uf: filial.uf ?? '',
      active: filial.active,
    })
    setErro('')
    setMensagem('')
    setFilialModalOpen(true)
  }

  function closeFilialModal() {
    if (salvando) {
      return
    }

    setFilialModalOpen(false)
    setFilialEditandoId(null)
    setFilialForm(initialFilialForm)
  }

  async function saveEmpresa(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault()
    setErro('')
    setMensagem('')

    const razao = empresaForm.razao_social.trim()
    const fantasia = empresaForm.nome_fantasia.trim()
    const cnpj = onlyDigits(empresaForm.cnpj)

    if (razao.length < 2 || fantasia.length < 2) {
      setErro(
        'Informe a razão social e o nome fantasia.',
      )
      return
    }

    if (cnpj && cnpj.length !== 14) {
      setErro('O CNPJ deve possuir 14 números.')
      return
    }

    setSalvando(true)

    const payload = {
      razao_social: razao,
      nome_fantasia: fantasia,
      cnpj: cnpj || null,
      active: empresaForm.active,
    }

    const result = empresaEditandoId
      ? await supabase
          .from('empresas')
          .update(payload)
          .eq('id', empresaEditandoId)
          .select()
          .single()
      : await supabase
          .from('empresas')
          .insert(payload)
          .select()
          .single()

    setSalvando(false)

    if (result.error) {
      console.error(
        'Erro ao salvar empresa:',
        result.error.message,
      )

      setErro(
        result.error.code === '23505'
          ? 'Já existe uma empresa com esse CNPJ.'
          : 'Não foi possível salvar a empresa.',
      )
      return
    }

    const saved = result.data as Empresa

    setSelectedEmpresaId(saved.id)
    setEmpresaModalOpen(false)
    setEmpresaEditandoId(null)
    setMensagem(
      empresaEditandoId
        ? 'Empresa atualizada com sucesso.'
        : 'Empresa cadastrada com sucesso.',
    )
    await carregarDados()
  }

  async function saveFilial(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault()
    setErro('')
    setMensagem('')

    const codigo = filialForm.codigo.trim().toUpperCase()
    const nome = filialForm.nome.trim()
    const cnpj = onlyDigits(filialForm.cnpj)
    const uf = filialForm.uf.trim().toUpperCase()

    if (!filialForm.empresa_id || !codigo || nome.length < 2) {
      setErro(
        'Informe a empresa, o código e o nome da filial.',
      )
      return
    }

    if (cnpj && cnpj.length !== 14) {
      setErro('O CNPJ deve possuir 14 números.')
      return
    }

    if (uf && uf.length !== 2) {
      setErro('A UF deve possuir duas letras.')
      return
    }

    setSalvando(true)

    const payload = {
      empresa_id: filialForm.empresa_id,
      codigo,
      nome,
      cnpj: cnpj || null,
      cidade: filialForm.cidade.trim() || null,
      uf: uf || null,
      active: filialForm.active,
    }

    const result = filialEditandoId
      ? await supabase
          .from('filiais')
          .update(payload)
          .eq('id', filialEditandoId)
          .select()
          .single()
      : await supabase
          .from('filiais')
          .insert(payload)
          .select()
          .single()

    setSalvando(false)

    if (result.error) {
      console.error(
        'Erro ao salvar filial:',
        result.error.message,
      )

      setErro(
        result.error.code === '23505'
          ? 'Já existe uma filial com esse código ou CNPJ.'
          : 'Não foi possível salvar a filial.',
      )
      return
    }

    setFilialModalOpen(false)
    setFilialEditandoId(null)
    setMensagem(
      filialEditandoId
        ? 'Filial atualizada com sucesso.'
        : 'Filial cadastrada com sucesso.',
    )
    await carregarDados()
  }

  if (carregando) {
    return (
      <section className="organization-panel organization-loading">
        <div>EF</div>
        <p>Carregando empresas e filiais...</p>
      </section>
    )
  }

  return (
    <>
      <section className="organization-panel">
        <header className="organization-header">
          <div>
            <span>Configurações</span>
            <h2>Empresas e filiais</h2>
            <p>
              Cadastre as empresas do grupo e suas unidades.
            </p>
          </div>

          <div className="organization-header-actions">
            <button
              type="button"
              onClick={carregarDados}
            >
              Atualizar
            </button>

            <button
              className="primary"
              type="button"
              onClick={openNewEmpresa}
            >
              + Nova empresa
            </button>
          </div>
        </header>

        <div className="organization-toolbar">
          <div>
            <label htmlFor="organization-search">
              Pesquisar empresa
            </label>
            <input
              id="organization-search"
              type="search"
              value={pesquisa}
              onChange={(event) =>
                setPesquisa(event.target.value)
              }
              placeholder="Nome, razão social ou CNPJ..."
            />
          </div>

          <div className="organization-summary">
            <span>Empresas</span>
            <strong>{empresas.length}</strong>
          </div>

          <div className="organization-summary">
            <span>Filiais</span>
            <strong>{filiais.length}</strong>
          </div>
        </div>

        <div className="organization-layout">
          <aside className="organization-companies">
            {empresasFiltradas.map((empresa) => {
              const totalFiliais = filiais.filter(
                (filial) =>
                  filial.empresa_id === empresa.id,
              ).length

              return (
                <button
                  className={
                    selectedEmpresaId === empresa.id
                      ? 'organization-company-card active'
                      : 'organization-company-card'
                  }
                  type="button"
                  key={empresa.id}
                  onClick={() =>
                    setSelectedEmpresaId(empresa.id)
                  }
                >
                  <div className="organization-company-avatar">
                    {empresa.nome_fantasia
                      .charAt(0)
                      .toUpperCase()}
                  </div>

                  <div>
                    <strong>{empresa.nome_fantasia}</strong>
                    <span>{empresa.razao_social}</span>
                    <small>
                      {totalFiliais} filial(is) ·{' '}
                      {empresa.active ? 'Ativa' : 'Inativa'}
                    </small>
                  </div>
                </button>
              )
            })}

            {empresasFiltradas.length === 0 && (
              <div className="organization-empty">
                <strong>Nenhuma empresa encontrada</strong>
                <p>Cadastre a primeira empresa do grupo.</p>
              </div>
            )}
          </aside>

          <main className="organization-details">
            {selectedEmpresa ? (
              <>
                <header className="organization-company-header">
                  <div>
                    <span>Empresa selecionada</span>
                    <h3>
                      {selectedEmpresa.nome_fantasia}
                    </h3>
                    <p>
                      {selectedEmpresa.razao_social} ·{' '}
                      {formatCnpj(selectedEmpresa.cnpj)}
                    </p>
                  </div>

                  <div>
                    <button
                      type="button"
                      onClick={() =>
                        openEditEmpresa(selectedEmpresa)
                      }
                    >
                      Editar empresa
                    </button>

                    <button
                      className="primary"
                      type="button"
                      onClick={openNewFilial}
                    >
                      + Nova filial
                    </button>
                  </div>
                </header>

                <div className="organization-branch-list">
                  {filiaisDaEmpresa.map((filial) => (
                    <article
                      className="organization-branch-card"
                      key={filial.id}
                    >
                      <div className="organization-branch-code">
                        {filial.codigo}
                      </div>

                      <div>
                        <strong>{filial.nome}</strong>
                        <span>
                          {filial.cidade || 'Cidade não informada'}
                          {filial.uf ? ` / ${filial.uf}` : ''}
                        </span>
                        <small>
                          {formatCnpj(filial.cnpj)} ·{' '}
                          {filial.active ? 'Ativa' : 'Inativa'}
                        </small>
                      </div>

                      <button
                        type="button"
                        onClick={() =>
                          openEditFilial(filial)
                        }
                      >
                        Editar
                      </button>
                    </article>
                  ))}

                  {filiaisDaEmpresa.length === 0 && (
                    <div className="organization-empty large">
                      <strong>Nenhuma filial cadastrada</strong>
                      <p>
                        Cadastre as unidades vinculadas a esta
                        empresa.
                      </p>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="organization-empty large">
                <strong>Selecione uma empresa</strong>
                <p>
                  As filiais e os dados da empresa aparecerão
                  aqui.
                </p>
              </div>
            )}
          </main>
        </div>
      </section>

      {(erro || mensagem) && (
        <div
          className={
            erro
              ? 'organization-toast error'
              : 'organization-toast success'
          }
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
          >
            ×
          </button>
        </div>
      )}

      {empresaModalOpen && (
        <div
          className="organization-modal-overlay"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeEmpresaModal()
            }
          }}
        >
          <section
            className="organization-modal"
            role="dialog"
            aria-modal="true"
          >
            <header>
              <div>
                <span>Empresa</span>
                <h2>
                  {empresaEditandoId
                    ? 'Editar empresa'
                    : 'Nova empresa'}
                </h2>
              </div>
              <button
                type="button"
                onClick={closeEmpresaModal}
              >
                ×
              </button>
            </header>

            <form onSubmit={saveEmpresa}>
              <div className="organization-form">
                <div className="organization-field full">
                  <label htmlFor="company-name">
                    Nome fantasia *
                  </label>
                  <input
                    id="company-name"
                    value={empresaForm.nome_fantasia}
                    onChange={(event) =>
                      setEmpresaForm((current) => ({
                        ...current,
                        nome_fantasia: event.target.value,
                      }))
                    }
                    disabled={salvando}
                    autoFocus
                  />
                </div>

                <div className="organization-field full">
                  <label htmlFor="company-legal-name">
                    Razão social *
                  </label>
                  <input
                    id="company-legal-name"
                    value={empresaForm.razao_social}
                    onChange={(event) =>
                      setEmpresaForm((current) => ({
                        ...current,
                        razao_social: event.target.value,
                      }))
                    }
                    disabled={salvando}
                  />
                </div>

                <div className="organization-field full">
                  <label htmlFor="company-cnpj">CNPJ</label>
                  <input
                    id="company-cnpj"
                    value={empresaForm.cnpj}
                    onChange={(event) =>
                      setEmpresaForm((current) => ({
                        ...current,
                        cnpj: event.target.value,
                      }))
                    }
                    placeholder="00.000.000/0000-00"
                    disabled={salvando}
                  />
                </div>

                <label className="organization-check">
                  <input
                    type="checkbox"
                    checked={empresaForm.active}
                    onChange={(event) =>
                      setEmpresaForm((current) => ({
                        ...current,
                        active: event.target.checked,
                      }))
                    }
                  />
                  <span>
                    <strong>Empresa ativa</strong>
                    <small>
                      Empresas inativas não aparecem em novos
                      cadastros.
                    </small>
                  </span>
                </label>
              </div>

              <footer>
                <button
                  type="button"
                  onClick={closeEmpresaModal}
                >
                  Cancelar
                </button>
                <button
                  className="primary"
                  type="submit"
                  disabled={salvando}
                >
                  {salvando
                    ? 'Salvando...'
                    : 'Salvar empresa'}
                </button>
              </footer>
            </form>
          </section>
        </div>
      )}

      {filialModalOpen && (
        <div
          className="organization-modal-overlay"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeFilialModal()
            }
          }}
        >
          <section
            className="organization-modal"
            role="dialog"
            aria-modal="true"
          >
            <header>
              <div>
                <span>Filial</span>
                <h2>
                  {filialEditandoId
                    ? 'Editar filial'
                    : 'Nova filial'}
                </h2>
              </div>
              <button
                type="button"
                onClick={closeFilialModal}
              >
                ×
              </button>
            </header>

            <form onSubmit={saveFilial}>
              <div className="organization-form two-columns">
                <div className="organization-field">
                  <label htmlFor="branch-code">Código *</label>
                  <input
                    id="branch-code"
                    value={filialForm.codigo}
                    onChange={(event) =>
                      setFilialForm((current) => ({
                        ...current,
                        codigo: event.target.value,
                      }))
                    }
                    placeholder="MATRIZ"
                    disabled={salvando}
                    autoFocus
                  />
                </div>

                <div className="organization-field">
                  <label htmlFor="branch-name">Nome *</label>
                  <input
                    id="branch-name"
                    value={filialForm.nome}
                    onChange={(event) =>
                      setFilialForm((current) => ({
                        ...current,
                        nome: event.target.value,
                      }))
                    }
                    disabled={salvando}
                  />
                </div>

                <div className="organization-field full">
                  <label htmlFor="branch-cnpj">CNPJ</label>
                  <input
                    id="branch-cnpj"
                    value={filialForm.cnpj}
                    onChange={(event) =>
                      setFilialForm((current) => ({
                        ...current,
                        cnpj: event.target.value,
                      }))
                    }
                    placeholder="00.000.000/0000-00"
                    disabled={salvando}
                  />
                </div>

                <div className="organization-field">
                  <label htmlFor="branch-city">Cidade</label>
                  <input
                    id="branch-city"
                    value={filialForm.cidade}
                    onChange={(event) =>
                      setFilialForm((current) => ({
                        ...current,
                        cidade: event.target.value,
                      }))
                    }
                    disabled={salvando}
                  />
                </div>

                <div className="organization-field">
                  <label htmlFor="branch-state">UF</label>
                  <input
                    id="branch-state"
                    value={filialForm.uf}
                    maxLength={2}
                    onChange={(event) =>
                      setFilialForm((current) => ({
                        ...current,
                        uf: event.target.value,
                      }))
                    }
                    disabled={salvando}
                  />
                </div>

                <label className="organization-check full">
                  <input
                    type="checkbox"
                    checked={filialForm.active}
                    onChange={(event) =>
                      setFilialForm((current) => ({
                        ...current,
                        active: event.target.checked,
                      }))
                    }
                  />
                  <span>
                    <strong>Filial ativa</strong>
                    <small>
                      Filiais inativas não aparecem em novas
                      vagas.
                    </small>
                  </span>
                </label>
              </div>

              <footer>
                <button
                  type="button"
                  onClick={closeFilialModal}
                >
                  Cancelar
                </button>
                <button
                  className="primary"
                  type="submit"
                  disabled={salvando}
                >
                  {salvando
                    ? 'Salvando...'
                    : 'Salvar filial'}
                </button>
              </footer>
            </form>
          </section>
        </div>
      )}
    </>
  )
}

export default EmpresasFiliais
