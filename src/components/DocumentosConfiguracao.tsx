import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from 'react'
import { supabase } from '../lib/supabase'
import './DocumentosConfiguracao.css'

type DocumentoConfig = {
  codigo: string
  nome: string
  descricao: string | null
  active: boolean
  padrao: boolean
  ordem: number
  created_at: string
  updated_at: string
}

type DocumentoForm = {
  codigo: string
  nome: string
  descricao: string
  active: boolean
  padrao: boolean
  ordem: string
}

const emptyForm: DocumentoForm = {
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

function DocumentosConfiguracao() {
  const [documentos, setDocumentos] =
    useState<DocumentoConfig[]>([])
  const [editing, setEditing] =
    useState<DocumentoConfig | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] =
    useState<DocumentoForm>(emptyForm)
  const [carregando, setCarregando] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  const [mensagem, setMensagem] = useState('')

  const carregarDocumentos = useCallback(async () => {
    setCarregando(true)
    setErro('')

    const { data, error } = await supabase
      .from('documentos_configuracao')
      .select(
        'codigo, nome, descricao, active, padrao, ordem, created_at, updated_at',
      )
      .order('ordem')
      .order('nome')

    if (error) {
      console.error(
        'Erro ao carregar documentos:',
        error.message,
      )
      setErro(
        'Não foi possível carregar a configuração dos documentos.',
      )
      setCarregando(false)
      return
    }

    setDocumentos((data ?? []) as DocumentoConfig[])
    setCarregando(false)
  }, [])

  useEffect(() => {
    carregarDocumentos()
  }, [carregarDocumentos])

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

  const totalAtivos = useMemo(
    () =>
      documentos.filter((documento) => documento.active)
        .length,
    [documentos],
  )

  const totalPadrao = useMemo(
    () =>
      documentos.filter(
        (documento) =>
          documento.active && documento.padrao,
      ).length,
    [documentos],
  )

  function openNew() {
    const nextOrder =
      documentos.length === 0
        ? 10
        : Math.max(...documentos.map((item) => item.ordem)) + 10

    setEditing(null)
    setForm({
      ...emptyForm,
      ordem: String(nextOrder),
    })
    setErro('')
    setMensagem('')
    setModalOpen(true)
  }

  function openEdit(documento: DocumentoConfig) {
    setEditing(documento)
    setForm({
      codigo: documento.codigo,
      nome: documento.nome,
      descricao: documento.descricao ?? '',
      active: documento.active,
      padrao: documento.padrao,
      ordem: String(documento.ordem),
    })
    setErro('')
    setMensagem('')
    setModalOpen(true)
  }

  function closeModal() {
    if (salvando) {
      return
    }

    setModalOpen(false)
    setEditing(null)
    setForm(emptyForm)
  }

  async function saveDocument(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault()
    setErro('')
    setMensagem('')

    const codigo = normalizeCode(form.codigo || form.nome)
    const nome = form.nome.trim()
    const ordem = Number(form.ordem)

    if (codigo.length < 2) {
      setErro(
        'Informe um código com pelo menos dois caracteres.',
      )
      return
    }

    if (!/^[a-z0-9]+(?:_[a-z0-9]+)*$/.test(codigo)) {
      setErro(
        'O código deve usar apenas letras minúsculas, números e sublinhado.',
      )
      return
    }

    if (nome.length < 2) {
      setErro('Informe o nome do documento.')
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
          .from('documentos_configuracao')
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
          .from('documentos_configuracao')
          .insert(payload)
          .select()
          .single()

    setSalvando(false)

    if (result.error) {
      console.error(
        'Erro ao salvar documento:',
        result.error.message,
      )

      setErro(
        result.error.code === '23505'
          ? 'Já existe um documento com esse código.'
          : 'Não foi possível salvar o documento.',
      )
      return
    }

    setModalOpen(false)
    setEditing(null)
    setForm(emptyForm)
    setMensagem(
      editing
        ? 'Documento atualizado com sucesso.'
        : 'Documento cadastrado com sucesso.',
    )
    await carregarDocumentos()
  }

  async function toggleActive(documento: DocumentoConfig) {
    setErro('')
    setMensagem('')

    const { data, error } = await supabase
      .from('documentos_configuracao')
      .update({
        active: !documento.active,
        padrao: documento.active
          ? false
          : documento.padrao,
      })
      .eq('codigo', documento.codigo)
      .select()
      .single()

    if (error) {
      setErro(
        'Não foi possível alterar a situação do documento.',
      )
      return
    }

    setDocumentos((current) =>
      current.map((item) =>
        item.codigo === documento.codigo
          ? (data as DocumentoConfig)
          : item,
      ),
    )

    setMensagem(
      documento.active
        ? 'Documento desativado.'
        : 'Documento ativado.',
    )
  }

  if (carregando) {
    return (
      <section className="documents-settings-panel documents-settings-loading">
        <div>DOC</div>
        <p>Carregando configuração...</p>
      </section>
    )
  }

  return (
    <>
      <section className="documents-settings-panel">
        <header className="documents-settings-header">
          <div>
            <span>Configurações</span>
            <h2>Documentação admissional</h2>
            <p>
              Cadastre os documentos que o RH poderá solicitar
              ao candidato.
            </p>
          </div>

          <div className="documents-settings-header-actions">
            <button
              type="button"
              onClick={carregarDocumentos}
            >
              Atualizar
            </button>

            <button
              className="primary"
              type="button"
              onClick={openNew}
            >
              + Novo documento
            </button>
          </div>
        </header>

        <div className="documents-settings-summary">
          <div>
            <span>Total cadastrado</span>
            <strong>{documentos.length}</strong>
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
            Documentos ativos aparecem na solicitação. Os
            marcados como padrão já iniciam selecionados, mas o
            RH poderá desmarcá-los.
          </p>
        </div>

        <div className="documents-settings-grid">
          {documentos.map((documento) => (
            <article
              className={
                documento.active
                  ? 'document-setting-card'
                  : 'document-setting-card inactive'
              }
              key={documento.codigo}
            >
              <div className="document-setting-icon">
                DOC
              </div>

              <div className="document-setting-content">
                <div>
                  <strong>{documento.nome}</strong>
                  <span>{documento.codigo}</span>
                </div>

                <p>
                  {documento.descricao ||
                    'Sem descrição cadastrada.'}
                </p>

                <div className="document-setting-badges">
                  <span
                    className={
                      documento.active
                        ? 'active'
                        : 'inactive'
                    }
                  >
                    {documento.active ? 'Ativo' : 'Inativo'}
                  </span>

                  {documento.padrao && documento.active && (
                    <span className="default">
                      Selecionado por padrão
                    </span>
                  )}

                  <span className="order">
                    Ordem {documento.ordem}
                  </span>
                </div>
              </div>

              <div className="document-setting-actions">
                <button
                  type="button"
                  onClick={() => openEdit(documento)}
                >
                  Editar
                </button>

                <button
                  className={
                    documento.active ? 'danger' : 'success'
                  }
                  type="button"
                  onClick={() => toggleActive(documento)}
                >
                  {documento.active
                    ? 'Desativar'
                    : 'Ativar'}
                </button>
              </div>
            </article>
          ))}

          {documentos.length === 0 && (
            <div className="documents-settings-empty">
              <strong>Nenhum documento cadastrado</strong>
              <p>
                Clique em “Novo documento” para criar o primeiro.
              </p>
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
            if (event.target === event.currentTarget) {
              closeModal()
            }
          }}
        >
          <section
            className="documents-settings-modal"
            role="dialog"
            aria-modal="true"
          >
            <header>
              <div>
                <span>Documento</span>
                <h2>
                  {editing
                    ? `Editar ${editing.nome}`
                    : 'Novo documento'}
                </h2>
              </div>

              <button type="button" onClick={closeModal}>
                ×
              </button>
            </header>

            <form onSubmit={saveDocument}>
              <div className="documents-settings-form">
                <div className="documents-settings-field">
                  <label htmlFor="document-name">
                    Nome exibido *
                  </label>
                  <input
                    id="document-name"
                    value={form.nome}
                    onChange={(event) => {
                      const nome = event.target.value
                      setForm((current) => ({
                        ...current,
                        nome,
                        codigo: editing
                          ? current.codigo
                          : normalizeCode(nome),
                      }))
                    }}
                    disabled={salvando}
                    autoFocus
                  />
                </div>

                <div className="documents-settings-field">
                  <label htmlFor="document-code">
                    Código interno *
                  </label>
                  <input
                    id="document-code"
                    value={form.codigo}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        codigo: normalizeCode(
                          event.target.value,
                        ),
                      }))
                    }
                    placeholder="ex.: comprovante_endereco"
                    disabled={salvando || Boolean(editing)}
                  />
                  <small>
                    O código não poderá ser alterado depois do
                    cadastro.
                  </small>
                </div>

                <div className="documents-settings-field">
                  <label htmlFor="document-description">
                    Descrição
                  </label>
                  <textarea
                    id="document-description"
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
                  <label htmlFor="document-order">
                    Ordem
                  </label>
                  <input
                    id="document-order"
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
                        padrao: event.target.checked
                          ? current.padrao
                          : false,
                      }))
                    }
                  />
                  <span>
                    <strong>Documento ativo</strong>
                    <small>
                      Aparece na tela de solicitação.
                    </small>
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
                    <small>
                      O RH ainda poderá desmarcar durante o
                      processo.
                    </small>
                  </span>
                </label>
              </div>

              <footer>
                <button
                  type="button"
                  onClick={closeModal}
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
                    : editing
                      ? 'Salvar alterações'
                      : 'Cadastrar documento'}
                </button>
              </footer>
            </form>
          </section>
        </div>
      )}
    </>
  )
}

export default DocumentosConfiguracao
