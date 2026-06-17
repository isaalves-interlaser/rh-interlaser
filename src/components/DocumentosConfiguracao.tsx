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
  codigo:
    | 'rg'
    | 'cpf'
    | 'carteira_trabalho'
    | 'certidao_nascimento'
  nome: string
  descricao: string | null
  active: boolean
  padrao: boolean
  ordem: number
  created_at: string
  updated_at: string
}

type DocumentoForm = {
  nome: string
  descricao: string
  active: boolean
  padrao: boolean
  ordem: string
}

const emptyForm: DocumentoForm = {
  nome: '',
  descricao: '',
  active: true,
  padrao: true,
  ordem: '0',
}

function DocumentosConfiguracao() {
  const [documentos, setDocumentos] =
    useState<DocumentoConfig[]>([])
  const [editing, setEditing] =
    useState<DocumentoConfig | null>(null)
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

  function openEdit(documento: DocumentoConfig) {
    setEditing(documento)
    setForm({
      nome: documento.nome,
      descricao: documento.descricao ?? '',
      active: documento.active,
      padrao: documento.padrao,
      ordem: String(documento.ordem),
    })
    setErro('')
    setMensagem('')
  }

  function closeModal() {
    if (salvando) {
      return
    }

    setEditing(null)
    setForm(emptyForm)
  }

  async function saveDocument(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault()

    if (!editing) {
      return
    }

    setErro('')
    setMensagem('')

    const nome = form.nome.trim()
    const ordem = Number(form.ordem)

    if (nome.length < 2) {
      setErro('Informe o nome do documento.')
      return
    }

    if (!Number.isInteger(ordem) || ordem < 0) {
      setErro('A ordem deve ser um número inteiro positivo.')
      return
    }

    setSalvando(true)

    const { data, error } = await supabase
      .from('documentos_configuracao')
      .update({
        nome,
        descricao: form.descricao.trim() || null,
        active: form.active,
        padrao: form.active ? form.padrao : false,
        ordem,
      })
      .eq('codigo', editing.codigo)
      .select()
      .single()

    setSalvando(false)

    if (error) {
      console.error(
        'Erro ao atualizar documento:',
        error.message,
      )
      setErro('Não foi possível atualizar o documento.')
      return
    }

    setDocumentos((current) =>
      current
        .map((documento) =>
          documento.codigo === editing.codigo
            ? (data as DocumentoConfig)
            : documento,
        )
        .sort((a, b) => a.ordem - b.ordem),
    )

    setEditing(null)
    setForm(emptyForm)
    setMensagem('Documento atualizado com sucesso.')
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
              Defina quais documentos aparecem na contratação
              e quais ficam selecionados por padrão.
            </p>
          </div>

          <button
            type="button"
            onClick={carregarDocumentos}
          >
            Atualizar
          </button>
        </header>

        <div className="documents-settings-summary">
          <div>
            <span>Total integrado</span>
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
            Os documentos ativos aparecem na tela de solicitação.
            Os marcados como padrão já iniciam selecionados para o
            RH.
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

      {editing && (
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
                <h2>Editar {editing.nome}</h2>
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
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        nome: event.target.value,
                      }))
                    }
                    disabled={salvando}
                    autoFocus
                  />
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
                    : 'Salvar alterações'}
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
