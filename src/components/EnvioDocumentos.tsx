import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import './EnvioDocumentos.css'

type PublicDocument = {
  id: string
  tipo: string
  label: string
  obrigatorio: boolean
  status: 'pendente' | 'recebido' | 'recusado'
  nome_arquivo: string | null
  versao: number
  recebido_em: string | null
  recusado_em: string | null
  motivo_recusa: string | null
}

type PublicRequest = {
  request: {
    id: string
    status:
      | 'pendente'
      | 'em_envio'
      | 'concluida'
      | 'cancelada'
      | 'expirada'
    prazoEnvio: string
    expired: boolean
  }
  candidate: {
    name: string
    number: number
  }
  vacancy: {
    number: number
    name: string
    sector: string
  }
  documents: PublicDocument[]
}

type EnvioDocumentosProps = {
  token: string
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

  return candidate.message ?? 'Não foi possível acessar a solicitação.'
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('pt-BR').format(
    new Date(`${value}T12:00:00`),
  )
}

function EnvioDocumentos({ token }: EnvioDocumentosProps) {
  const [data, setData] = useState<PublicRequest | null>(null)
  const [files, setFiles] = useState<Record<string, File | null>>({})
  const [loading, setLoading] = useState(true)
  const [uploadingId, setUploadingId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const loadRequest = useCallback(async () => {
    setLoading(true)
    setError('')

    const { data: response, error: functionError } =
      await supabase.functions.invoke('documentos-candidato', {
        body: { action: 'consultar', token },
      })

    setLoading(false)

    if (functionError || !response?.ok) {
      setError(
        functionError
          ? await readFunctionError(functionError)
          : response?.error ?? 'Não foi possível abrir este link.',
      )
      return
    }

    setData(response as PublicRequest)
  }, [token])

  useEffect(() => {
    loadRequest()
  }, [loadRequest])

  const receivedCount = useMemo(
    () =>
      data?.documents.filter((item) => item.status === 'recebido')
        .length ?? 0,
    [data],
  )

  const complete = Boolean(
    data && receivedCount === data.documents.length,
  )

  async function uploadDocument(document: PublicDocument) {
    const file = files[document.id]

    if (!file) {
      setError(`Selecione o arquivo de ${document.label}.`)
      return
    }

    setUploadingId(document.id)
    setError('')
    setMessage('')

    const form = new FormData()
    form.append('token', token)
    form.append('documentoId', document.id)
    form.append('file', file)

    const { data: response, error: functionError } =
      await supabase.functions.invoke('documentos-candidato', {
        body: form,
      })

    setUploadingId(null)

    if (functionError || !response?.ok) {
      setError(
        functionError
          ? await readFunctionError(functionError)
          : response?.error ?? 'Não foi possível enviar o arquivo.',
      )
      return
    }

    setFiles((current) => ({ ...current, [document.id]: null }))
    setMessage(response.message ?? 'Documento enviado com sucesso.')
    await loadRequest()
  }

  if (loading) {
    return (
      <main className="documents-public-page">
        <section className="documents-public-card loading">
          <div className="documents-public-logo">RH</div>
          <strong>Carregando solicitação</strong>
          <p>Aguarde um instante...</p>
        </section>
      </main>
    )
  }

  if (!data) {
    return (
      <main className="documents-public-page">
        <section className="documents-public-card invalid">
          <div className="documents-public-logo">RH</div>
          <span>Interlaser Máquinas</span>
          <h1>Não foi possível abrir o link</h1>
          <p>{error || 'Solicitação não encontrada.'}</p>
          <small>
            Entre em contato com o Recursos Humanos para receber um
            novo link.
          </small>
        </section>
      </main>
    )
  }

  const inactive = ['cancelada', 'expirada'].includes(
    data.request.status,
  )

  return (
    <main className="documents-public-page">
      <section className="documents-public-card">
        <header className="documents-public-header">
          <div className="documents-public-brand">
            <div className="documents-public-logo">RH</div>
            <div>
              <strong>Interlaser Máquinas</strong>
              <span>Documentação admissional</span>
            </div>
          </div>

          <span
            className={`documents-request-status status-${data.request.status}`}
          >
            {complete
              ? 'Documentos enviados'
              : inactive
                ? data.request.status === 'expirada'
                  ? 'Prazo encerrado'
                  : 'Solicitação cancelada'
                : `${receivedCount}/${data.documents.length} recebidos`}
          </span>
        </header>

        <section className="documents-public-intro">
          <span>Envio de documentos</span>
          <h1>Olá, {data.candidate.name}</h1>
          <p>
            Envie os documentos solicitados para continuar sua
            admissão na vaga de <strong>{data.vacancy.name}</strong>.
          </p>

          <div className="documents-public-summary">
            <div>
              <span>Vaga</span>
              <strong>
                VAG-{String(data.vacancy.number).padStart(6, '0')} —{' '}
                {data.vacancy.name}
              </strong>
            </div>

            <div>
              <span>Prazo</span>
              <strong>{formatDate(data.request.prazoEnvio)}</strong>
            </div>

            <div>
              <span>Formatos permitidos</span>
              <strong>PDF, JPG ou PNG · até 6 MB</strong>
            </div>
          </div>
        </section>

        {message && (
          <div className="documents-public-message success" role="status">
            {message}
          </div>
        )}

        {error && (
          <div className="documents-public-message error" role="alert">
            {error}
          </div>
        )}

        {inactive ? (
          <section className="documents-public-finished warning">
            <strong>
              {data.request.status === 'expirada'
                ? 'O prazo deste link terminou.'
                : 'Esta solicitação foi cancelada.'}
            </strong>
            <p>Entre em contato com o RH para receber orientações.</p>
          </section>
        ) : complete ? (
          <section className="documents-public-finished">
            <div>✓</div>
            <strong>Todos os documentos foram enviados</strong>
            <p>
              O Recursos Humanos fará a conferência. Caso algum
              arquivo precise ser substituído, você receberá um novo
              e-mail.
            </p>
          </section>
        ) : (
          <section className="documents-public-list">
            {data.documents.map((document) => {
              const received = document.status === 'recebido'
              const refused = document.status === 'recusado'

              return (
                <article
                  className={`documents-public-item status-${document.status}`}
                  key={document.id}
                >
                  <div className="documents-public-item-status">
                    {received ? '✓' : refused ? '!' : ''}
                  </div>

                  <div className="documents-public-item-main">
                    <div className="documents-public-item-title">
                      <div>
                        <strong>{document.label}</strong>
                        <span>
                          {received
                            ? 'Arquivo recebido'
                            : refused
                              ? 'Precisa ser enviado novamente'
                              : 'Aguardando envio'}
                        </span>
                      </div>

                      <span className={`document-badge ${document.status}`}>
                        {received
                          ? 'Recebido'
                          : refused
                            ? 'Recusado'
                            : 'Pendente'}
                      </span>
                    </div>

                    {refused && document.motivo_recusa && (
                      <div className="documents-refusal-reason">
                        <strong>Motivo:</strong> {document.motivo_recusa}
                      </div>
                    )}

                    {!received && (
                      <div className="documents-upload-row">
                        <label>
                          <input
                            type="file"
                            accept="application/pdf,image/jpeg,image/png"
                            onChange={(event) => {
                              const selected =
                                event.target.files?.[0] ?? null
                              setFiles((current) => ({
                                ...current,
                                [document.id]: selected,
                              }))
                              setError('')
                            }}
                            disabled={uploadingId === document.id}
                          />
                          <span>
                            {files[document.id]?.name ??
                              'Selecionar arquivo'}
                          </span>
                        </label>

                        <button
                          type="button"
                          onClick={() => uploadDocument(document)}
                          disabled={
                            uploadingId === document.id ||
                            !files[document.id]
                          }
                        >
                          {uploadingId === document.id
                            ? 'Enviando...'
                            : refused
                              ? 'Reenviar'
                              : 'Enviar'}
                        </button>
                      </div>
                    )}
                  </div>
                </article>
              )
            })}
          </section>
        )}

        <footer className="documents-public-footer">
          <p>
            Os arquivos são enviados diretamente para a pasta privada
            do Recursos Humanos no Google Drive da empresa.
          </p>
          <small>
            Interlaser Máquinas © {new Date().getFullYear()}
          </small>
        </footer>
      </section>
    </main>
  )
}

export default EnvioDocumentos
