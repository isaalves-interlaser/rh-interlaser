import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from 'react'
import { supabase } from '../lib/supabase'
import './DocumentosConfiguracao.css'

type BeneficioConfig = {
  codigo: string
  nome: string
  descricao: string | null
  active: boolean
  padrao: boolean
  ordem: number
  created_at: string
  updated_at: string
}

type BeneficioForm = {
  codigo: string
  nome: string
  descricao: string
  active: boolean
  padrao: boolean
  ordem: string
}

const emptyForm: BeneficioForm = {
  codigo: '',
  nome: '',
  descricao: '',
  active: true,
  padrao: true,
  ordem: '10',
}

function normalizeCode(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 50)
}

function BeneficiosConfiguracao() {
  const [beneficios, setBeneficios] = useState<BeneficioConfig[]>([])
  const [editing, setEditing] = useState<BeneficioConfig | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState<BeneficioForm>(emptyForm)
  const [carregando, setCarregando] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  const [mensagem, setMensagem] = useState('')

  const carregarBeneficios = useCallback(async () => {
    setCarregando(true)
    setErro('')

    const { data, error } = await supabase
      .from('beneficios_configuracao')
      .select('codigo, nome, descricao, active, padrao, ordem, created_at, updated_at')
      .order('ordem')
      .order('nome')

    if (error) {
      console.error('Erro ao carregar benefícios:', error.message)
      setErro('Não foi possível carregar a configuração dos benefícios.')
      setCarregando(false)
      return
    }

    setBeneficios((data ?? []) as BeneficioConfig[])
    setCarregando(false)
  }, [])

  useEffect(() => {
    carregarBeneficios()
  }, [carregarBeneficios])

  useEffect(() => {
    if (!erro && !mensagem) return

    const timer = window.setTimeout(() => {
      setErro('')
      setMensagem('')
    }, 6000)

    return () => window.clearTimeout(timer)
  }, [erro, mensagem])

  const totalAtivos = useMemo(
    () => beneficios.filter((beneficio) => beneficio.active).length,
    [beneficios],
  )

  const totalPadrao = useMemo(
    () =>
      beneficios.filter(
        (beneficio) => beneficio.active && beneficio.padrao,
      ).length,
    [beneficios],
  )

  function openNew() {
    const nextOrder =
      beneficios.length === 0
        ? 10
        : Math.max(...beneficios.map((item) => item.ordem)) + 10

    setEditing(null)
    setForm({
      ...emptyForm,
      ordem: String(nextOrder),
    })
    setErro('')
    setMensagem('')
    setModalOpen(true)
  }

  function openEdit(beneficio: BeneficioConfig) {
    setEditing(beneficio)
    setForm({
      codigo: beneficio.codigo,
      nome: beneficio.nome,
      descricao: beneficio.descricao ?? '',
      active: beneficio.active,
      padrao: beneficio.padrao,
      ordem: String(beneficio.ordem),
    })
    setErro('')
    setMensagem('')
    setModalOpen(true)
  }

  function closeModal() {
    if (salvando) return

    setModalOpen(false)
    setEditing(null)
    setForm(emptyForm)
  }

  async function saveBenefit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setErro('')
    setMensagem('')

    const codigo = normalizeCode(form.codigo || form.nome)
    const nome = form.nome.trim()
    const ordem = Number(form.ordem)

    if (codigo.length < 2) {
      setErro('Informe um código com pelo menos dois caracteres.')
      return
    }

    if (!/^[a-z0-9]+(?:_[a-z0-9]+)*$/.test(codigo)) {
      setErro('O código deve usar apenas letras minúsculas, números e sublinhado.')
      return
    }

    if (nome.length < 2) {
      setErro('Informe o nome do benefício.')
      return
    }

    if (!Number.isInteger(ordem) || ordem < 0) {
      setErro('A ordem deve ser um número inteiro positivo.')
      return
    }

    setSalvando(true)

    const payload = {
      codigo,
      nome,
      descricao: form.descricao.trim() || null,
      active: form.active,
      padrao: form.active ? form.padrao : false,
      ordem,
    }

    const result = editing
      ? await supabase
          .from('beneficios_configuracao')
          .update({
            nome: payload.nome,
            descricao: payload.descricao,
            active: payload.active,
            padrao: payload.padrao,
            ordem: payload.ordem,
          })
          .eq('codigo', editing.codigo)
          .select()
          .single()
      : await supabase
          .from('beneficios_configuracao')
          .insert(payload)
          .select()
          .single()

    setSalvando(false)

    if (result.error) {
      console.error('Erro ao salvar benefício:', result.error.message)
      setErro(
        result.error.code === '23505'
          ? 'Já existe um benefício com esse código.'
          : 'Não foi possível salvar o benefício.',
      )
      return
    }

    setModalOpen(false)
    setEditing(null)
    setForm(emptyForm)
    setMensagem(
      editing
        ? 'Benefício atualizado com sucesso.'
        : 'Benefício cadastrado com sucesso.',
    )
    await carregarBeneficios()
  }

  async function toggleActive(beneficio: BeneficioConfig) {
    setErro('')
    setMensagem('')

    const { data, error } = await supabase
      .from('beneficios_configuracao')
      .update({
        active: !beneficio.active,
        padrao: beneficio.active ? false : beneficio.padrao,
      })
      .eq('codigo', beneficio.codigo)
      .select()
      .single()

    if (error) {
      setErro('Não foi possível alterar a situação do benefício.')
      return
    }

    setBeneficios((current) =>
      current.map((item) =>
        item.codigo === beneficio.codigo
          ? (data as BeneficioConfig)
          : item,
      ),
    )

    setMensagem(beneficio.active ? 'Benefício desativado.' : 'Benefício ativado.')
  }

  if (carregando) {
    return (
      <section className="documents-settings-panel documents-settings-loading">
        <div>BEN</div>
        <p>Carregando benefícios...</p>
      </section>
    )
  }

  return (
    <>
      <section className="documents-settings-panel">
        <header className="documents-settings-header">
          <div>
            <span>Configurações</span>
            <h2>Benefícios das vagas</h2>
            <p>
              Cadastre os benefícios fixos que o RH poderá selecionar ao criar
              ou editar uma vaga.
            </p>
          </div>

          <div className="documents-settings-header-actions">
            <button type="button" onClick={carregarBeneficios}>
              Atualizar
            </button>

            <button className="primary" type="button" onClick={openNew}>
              + Novo benefício
            </button>
          </div>
        </header>

        <div className="documents-settings-summary">
          <div>
            <span>Total cadastrado</span>
            <strong>{beneficios.length}</strong>
          </div>

          <div>
            <span>Ativos</span>
            <strong>{totalAtivos}</strong>
          </div>

          <div>
            <span>Selecionados por padrão</span>
            <strong>{totalPadrao}</strong>
          </div>
        </div>

        <div className="documents-settings-note">
          <strong>Como esta configuração funciona</strong>
          <p>
            Benefícios ativos aparecem na criação/edição de vagas. Os marcados
            como padrão já iniciam selecionados, mas o RH poderá desmarcar.
          </p>
        </div>

        <div className="documents-settings-grid">
          {beneficios.map((beneficio) => (
            <article
              className={
                beneficio.active
                  ? 'document-setting-card'
                  : 'document-setting-card inactive'
              }
              key={beneficio.codigo}
            >
              <div className="document-setting-icon">BEN</div>

              <div className="document-setting-content">
                <div>
                  <strong>{beneficio.nome}</strong>
                  <span>{beneficio.codigo}</span>
                </div>

                <p>{beneficio.descricao || 'Sem descrição cadastrada.'}</p>

                <div className="document-setting-badges">
                  <span className={beneficio.active ? 'active' : 'inactive'}>
                    {beneficio.active ? 'Ativo' : 'Inativo'}
                  </span>

                  {beneficio.padrao && beneficio.active && (
                    <span className="default">Selecionado por padrão</span>
                  )}

                  <span className="order">Ordem {beneficio.ordem}</span>
                </div>
              </div>

              <div className="document-setting-actions">
                <button type="button" onClick={() => openEdit(beneficio)}>
                  Editar
                </button>

                <button
                  className={beneficio.active ? 'danger' : 'success'}
                  type="button"
                  onClick={() => toggleActive(beneficio)}
                >
                  {beneficio.active ? 'Desativar' : 'Ativar'}
                </button>
              </div>
            </article>
          ))}

          {beneficios.length === 0 && (
            <div className="documents-settings-empty">
              <strong>Nenhum benefício cadastrado</strong>
              <p>Clique em “Novo benefício” para criar o primeiro.</p>
            </div>
          )}
        </div>
      </section>

      {(erro || mensagem) && (
        <div
          className={
            erro
              ? 'documents-settings-toast error'
              : 'documents-settings-toast success'
          }
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

      {modalOpen && (
        <div
          className="documents-settings-modal-overlay"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeModal()
          }}
        >
          <section
            className="documents-settings-modal"
            role="dialog"
            aria-modal="true"
          >
            <header>
              <div>
                <span>Benefício</span>
                <h2>
                  {editing ? `Editar ${editing.nome}` : 'Novo benefício'}
                </h2>
              </div>

              <button type="button" onClick={closeModal}>
                ×
              </button>
            </header>

            <form onSubmit={saveBenefit}>
              <div className="documents-settings-form">
                <div className="documents-settings-field">
                  <label htmlFor="benefit-name">Nome exibido *</label>
                  <input
                    id="benefit-name"
                    value={form.nome}
                    onChange={(event) => {
                      const nome = event.target.value
                      setForm((current) => ({
                        ...current,
                        nome,
                        codigo: editing ? current.codigo : normalizeCode(nome),
                      }))
                    }}
                    disabled={salvando}
                    autoFocus
                  />
                </div>

                <div className="documents-settings-field">
                  <label htmlFor="benefit-code">Código interno *</label>
                  <input
                    id="benefit-code"
                    value={form.codigo}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        codigo: normalizeCode(event.target.value),
                      }))
                    }
                    placeholder="ex.: vale_transporte"
                    disabled={salvando || Boolean(editing)}
                  />
                  <small>O código não poderá ser alterado depois do cadastro.</small>
                </div>

                <div className="documents-settings-field">
                  <label htmlFor="benefit-description">Descrição</label>
                  <textarea
                    id="benefit-description"
                    rows={4}
                    value={form.descricao}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        descricao: event.target.value,
                      }))
                    }
                    disabled={salvando}
                  />
                </div>

                <div className="documents-settings-field">
                  <label htmlFor="benefit-order">Ordem</label>
                  <input
                    id="benefit-order"
                    type="number"
                    min={0}
                    step={1}
                    value={form.ordem}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        ordem: event.target.value,
                      }))
                    }
                    disabled={salvando}
                  />
                </div>

                <label className="documents-settings-check">
                  <input
                    type="checkbox"
                    checked={form.active}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        active: event.target.checked,
                        padrao: event.target.checked ? current.padrao : false,
                      }))
                    }
                  />
                  <span>
                    <strong>Benefício ativo</strong>
                    <small>Aparece na criação/edição das vagas.</small>
                  </span>
                </label>

                <label className="documents-settings-check">
                  <input
                    type="checkbox"
                    checked={form.padrao}
                    disabled={!form.active}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        padrao: event.target.checked,
                      }))
                    }
                  />
                  <span>
                    <strong>Selecionar por padrão</strong>
                    <small>O RH ainda poderá desmarcar na vaga.</small>
                  </span>
                </label>
              </div>

              <footer>
                <button type="button" onClick={closeModal}>
                  Cancelar
                </button>

                <button className="primary" type="submit" disabled={salvando}>
                  {salvando
                    ? 'Salvando...'
                    : editing
                      ? 'Salvar alterações'
                      : 'Cadastrar benefício'}
                </button>
              </footer>
            </form>
          </section>
        </div>
      )}
    </>
  )
}

export default BeneficiosConfiguracao
