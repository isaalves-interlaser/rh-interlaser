import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import './DocumentacaoAdmissional.css'

type RequestStatus =
  | 'pendente'
  | 'em_envio'
  | 'concluida'
  | 'cancelada'
  | 'expirada'

type DocumentStatus = 'pendente' | 'recebido' | 'recusado'

type DocumentRequest = {
  id: string
  candidatura_id: string
  prazo_envio: string
  status: RequestStatus
  email_destino: string
  drive_folder_url: string | null
  email_enviado_em: string | null
  email_tentativas: number
  email_ultimo_erro: string | null
  ultimo_acesso_em: string | null
  created_at: string
}

type RequestedDocument = {
  id: string
  solicitacao_id: string
  tipo: string
  status: DocumentStatus
  drive_file_url: string | null
  nome_arquivo: string | null
  versao: number
  recebido_em: string | null
  recusado_em: string | null
  motivo_recusa: string | null
}

type DocumentacaoAdmissionalProps = {
  candidaturaId: string
}

const documentLabels: Record<string, string> = {
  rg: 'RG',
  cpf: 'CPF',
  carteira_trabalho: 'Carteira de Trabalho',
  certidao_nascimento: 'Certidão de Nascimento',
}

const requestStatusLabels: Record<RequestStatus, string> = {
  pendente: 'Aguardando envio',
  em_envio: 'Envio em andamento',
  concluida: 'Documentação recebida',
  cancelada: 'Cancelada',
  expirada: 'Prazo encerrado',
}

async function readFunctionError(error: unknown) {
  const candidate = error as {
    message?: string
    context?: Response
  }

  if (candidate.context) {
    try {
      const data = await candidate.context.clone().json()
      if (data?.error) return String(data.error)
    } catch {
      // Usa a mensagem padrão.
    }
  }

  return candidate.message ?? 'Não foi possível concluir a ação.'
}

function formatDate(value: string | null, withTime = false) {
  if (!value) return '—'

  const date = value.includes('T')
    ? new Date(value)
    : new Date(`${value}T12:00:00`)

  if (Number.isNaN(date.getTime())) return '—'

  return new Intl.DateTimeFormat('pt-BR',
    withTime
      ? { dateStyle: 'short', timeStyle: 'short' }
      : { dateStyle: 'short' },
  ).format(date)
}

function DocumentacaoAdmissional({
  candidaturaId,
}: DocumentacaoAdmissionalProps) {
  const [request, setRequest] = useState<DocumentRequest | null>(null)
  const [documents, setDocuments] = useState<RequestedDocument[]>([])
  const [selectedDocument, setSelectedDocument] =
    useState<RequestedDocument | null>(null)
  const [refusalReason, setRefusalReason] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const loadDocuments = useCallback(async () => {
    setLoading(true)
    setError('')

    const { data: requestData, error: requestError } = await supabase
      .from('solicitacoes_documentos')
      .select(
        'id, candidatura_id, prazo_envio, status, email_destino, drive_folder_url, email_enviado_em, email_tentativas, email_ultimo_erro, ultimo_acesso_em, created_at',
      )
      .eq('candidatura_id', candidaturaId)
      .maybeSingle()

    if (requestError) {
      console.error('Erro ao carregar solicitação:', requestError.message)
      setError('Não foi possível carregar a documentação.')
      setLoading(false)
      return
    }

    if (!requestData) {
      setRequest(null)
      setDocuments([])
      setLoading(false)
      return
    }

    const { data: documentData, error: documentError } = await supabase
      .from('documentos_solicitados')
      .select(
        'id, solicitacao_id, tipo, status, drive_file_url, nome_arquivo, versao, recebido_em, recusado_em, motivo_recusa',
      )
      .eq('solicitacao_id', requestData.id)
      .order('created_at')

    if (documentError) {
      console.error('Erro ao carregar documentos:', documentError.message)
      setError('Não foi possível carregar os documentos solicitados.')
      setLoading(false)
      return
    }

    setRequest(requestData as DocumentRequest)
    setDocuments((documentData ?? []) as RequestedDocument[])
    setLoading(false)
  }, [candidaturaId])

  useEffect(() => {
    loadDocuments()
  }, [loadDocuments])

  const receivedCount = useMemo(
    () => documents.filter((item) => item.status === 'recebido').length,
    [documents],
  )

  const refusedCount = useMemo(
    () => documents.filter((item) => item.status === 'recusado').length,
    [documents],
  )

  function openRefusal(document: RequestedDocument) {
    setSelectedDocument(document)
    setRefusalReason(document.motivo_recusa ?? '')
    setError('')
    setMessage('')
  }

  function closeRefusal() {
    if (saving) return
    setSelectedDocument(null)
    setRefusalReason('')
  }

  async function refuseDocument() {
    if (!selectedDocument) return

    if (refusalReason.trim().length < 3) {
      setError('Informe o motivo da recusa.')
      return
    }

    setSaving(true)
    setError('')
    setMessage('')

    const { data, error: functionError } = await supabase.functions.invoke(
      'recusar-documento',
      {
        body: {
          documentoId: selectedDocument.id,
          motivo: refusalReason.trim(),
        },
      },
    )

    setSaving(false)

    if (functionError || !data?.ok) {
      setError(
        functionError
          ? await readFunctionError(functionError)
          : data?.error ?? 'Não foi possível recusar o documento.',
      )
      return
    }

    setSelectedDocument(null)
    setRefusalReason('')
    setMessage(data.message)
    await loadDocuments()
  }

  if (loading) {
    return (
      <section className="admission-documents loading">
        <span>Carregando documentação...</span>
      </section>
    )
  }

  if (!request) {
    return (
      <section className="admission-documents empty">
        <div className="admission-documents-empty-icon">DOC</div>
        <div>
          <span className="admission-documents-eyebrow">
            Documentação admissional
          </span>
          <h4>Nenhuma solicitação criada</h4>
          <p>
            A solicitação será criada quando o RH confirmar a
            contratação pela Pipeline.
          </p>
        </div>
      </section>
    )
  }

  const progress = documents.length
    ? Math.round((receivedCount / documents.length) * 100)
    : 0

  return (
    <>
      <section className="admission-documents">
        <header className="admission-documents-header">
          <div>
            <span className="admission-documents-eyebrow">
              Documentação admissional
            </span>
            <h4>Documentos do candidato</h4>
            <p>
              Acompanhe o envio, abra os arquivos no Drive e recuse
              documentos que precisem ser substituídos.
            </p>
          </div>

          <div className="admission-documents-actions">
            <span
              className={`admission-request-status status-${request.status}`}
            >
              {requestStatusLabels[request.status]}
            </span>

            {request.drive_folder_url && (
              <a
                href={request.drive_folder_url}
                target="_blank"
                rel="noreferrer"
              >
                Abrir pasta no Drive
              </a>
            )}
          </div>
        </header>

        <div className="admission-documents-overview">
          <article>
            <span>Progresso</span>
            <strong>{progress}%</strong>
            <div>
              <i style={{ width: `${progress}%` }} />
            </div>
          </article>

          <article>
            <span>Recebidos</span>
            <strong>
              {receivedCount}/{documents.length}
            </strong>
            <small>documentos</small>
          </article>

          <article className={refusedCount ? 'attention' : ''}>
            <span>Recusados</span>
            <strong>{refusedCount}</strong>
            <small>aguardando reenvio</small>
          </article>

          <article>
            <span>Prazo</span>
            <strong>{formatDate(request.prazo_envio)}</strong>
            <small>{request.email_destino}</small>
          </article>
        </div>

        {request.email_ultimo_erro && (
          <div className="admission-documents-message error">
            O último e-mail não foi enviado: {request.email_ultimo_erro}
          </div>
        )}

        {message && (
          <div className="admission-documents-message success">
            {message}
          </div>
        )}

        {error && !selectedDocument && (
          <div className="admission-documents-message error">
            {error}
          </div>
        )}

        <div className="admission-documents-list">
          {documents.map((document) => {
            const label = documentLabels[document.tipo] ?? document.tipo

            return (
              <article
                className={`admission-document-row status-${document.status}`}
                key={document.id}
              >
                <div className="admission-document-state">
                  {document.status === 'recebido'
                    ? '✓'
                    : document.status === 'recusado'
                      ? '!'
                      : ''}
                </div>

                <div className="admission-document-main">
                  <div>
                    <strong>{label}</strong>
                    <span>
                      {document.status === 'recebido'
                        ? `Recebido em ${formatDate(document.recebido_em, true)}`
                        : document.status === 'recusado'
                          ? 'Recusado — aguardando novo envio'
                          : 'Aguardando envio do candidato'}
                    </span>
                  </div>

                  {document.motivo_recusa && (
                    <p>
                      <strong>Motivo:</strong> {document.motivo_recusa}
                    </p>
                  )}
                </div>

                <span
                  className={`admission-document-badge ${document.status}`}
                >
                  {document.status === 'recebido'
                    ? 'Recebido'
                    : document.status === 'recusado'
                      ? 'Recusado'
                      : 'Pendente'}
                </span>

                <div className="admission-document-actions">
                  {document.drive_file_url && (
                    <a
                      href={document.drive_file_url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Visualizar
                    </a>
                  )}

                  {document.status === 'recebido' && (
                    <button
                      className="danger"
                      type="button"
                      onClick={() => openRefusal(document)}
                    >
                      Recusar
                    </button>
                  )}

                  {document.status === 'recusado' && (
                    <button
                      type="button"
                      onClick={() => openRefusal(document)}
                    >
                      Reenviar aviso
                    </button>
                  )}
                </div>
              </article>
            )
          })}
        </div>

        <footer className="admission-documents-footer">
          <span>
            E-mail enviado:{' '}
            <strong>{formatDate(request.email_enviado_em, true)}</strong>
          </span>
          <span>
            Último acesso do candidato:{' '}
            <strong>{formatDate(request.ultimo_acesso_em, true)}</strong>
          </span>
          <button type="button" onClick={loadDocuments}>
            Atualizar
          </button>
        </footer>
      </section>

      {selectedDocument && (
        <div
          className="document-refusal-overlay"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeRefusal()
          }}
        >
          <section
            className="document-refusal-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="document-refusal-title"
          >
            <header>
              <div>
                <span>Conferência de documento</span>
                <h3 id="document-refusal-title">
                  Recusar {documentLabels[selectedDocument.tipo]}
                </h3>
              </div>
              <button
                type="button"
                onClick={closeRefusal}
                disabled={saving}
              >
                ×
              </button>
            </header>

            <div className="document-refusal-body">
              <p>
                O candidato receberá um e-mail com um novo link para
                substituir este arquivo.
              </p>

              <label htmlFor="document-refusal-reason">
                Motivo da recusa *
              </label>
              <textarea
                id="document-refusal-reason"
                rows={4}
                value={refusalReason}
                onChange={(event) => {
                  setRefusalReason(event.target.value)
                  setError('')
                }}
                placeholder="Ex.: arquivo ilegível, documento incompleto..."
                disabled={saving}
              />

              {error && (
                <div className="admission-documents-message error">
                  {error}
                </div>
              )}
            </div>

            <footer>
              <button
                className="secondary"
                type="button"
                onClick={closeRefusal}
                disabled={saving}
              >
                Cancelar
              </button>
              <button
                className="danger"
                type="button"
                onClick={refuseDocument}
                disabled={saving}
              >
                {saving ? 'Enviando aviso...' : 'Recusar e avisar candidato'}
              </button>
            </footer>
          </section>
        </div>
      )}
    </>
  )
}

export default DocumentacaoAdmissional
