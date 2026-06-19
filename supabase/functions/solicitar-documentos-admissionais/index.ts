import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

type RequestBody = {
  candidaturaId?: string
  responsavelId?: string
  dataPrevistaInicio?: string
  prazoEnvio?: string
  documentos?: string[]
}

type DriveFile = {
  id?: string
  name?: string
  webViewLink?: string
  driveId?: string
  appProperties?: Record<string, string>
  error?: { message?: string }
}

type GmailResult = {
  id?: string
  threadId?: string
  error?: { message?: string }
}

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json; charset=utf-8',
    },
  })
}

function secret(name: string) {
  const value = Deno.env.get(name)?.trim()
  if (!value) throw new Error(`Secret ausente: ${name}`)
  return value
}

function normalizeDate(value: string | undefined, field: string) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(`Informe ${field}.`)
  }

  const date = new Date(`${value}T12:00:00-03:00`)
  if (Number.isNaN(date.getTime())) {
    throw new Error(`A data de ${field} é inválida.`)
  }

  return value
}

function randomToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

async function sha256(value: string) {
  const hash = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(value),
  )

  return Array.from(new Uint8Array(hash))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

function base64Url(value: string) {
  const bytes = new TextEncoder().encode(value)
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)

  return btoa(binary)
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replaceAll('=', '')
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

function mimeHeader(value: string) {
  const bytes = new TextEncoder().encode(value)
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return `=?UTF-8?B?${btoa(binary)}?=`
}

async function googleAccessToken() {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: secret('GOOGLE_CLIENT_ID'),
      client_secret: secret('GOOGLE_CLIENT_SECRET'),
      refresh_token: secret('GOOGLE_REFRESH_TOKEN'),
      grant_type: 'refresh_token',
    }),
  })

  const data = await response.json()

  if (!response.ok || !data.access_token) {
    throw new Error(
      `Não foi possível autenticar no Google: ${
        data.error_description ?? data.error ?? response.status
      }`,
    )
  }

  return data.access_token as string
}

async function createCandidateFolder(
  accessToken: string,
  candidaturaId: string,
  candidateNumber: number,
  candidateName: string,
) {
  const parentId = secret('GOOGLE_DRIVE_PARENT_FOLDER_ID')

  /*
   * Não fazemos files.get() na pasta pai.
   *
   * O token atual usa o escopo drive.file. Esse escopo pode permitir a
   * criação dentro da pasta compartilhada, mas negar a leitura direta dos
   * metadados de uma pasta preexistente, retornando "File not found".
   *
   * A própria tabela solicitacoes_documentos já impede uma segunda
   * solicitação para a mesma candidatura antes de chegarmos até aqui.
   */
  const folderName = `CAN-${String(candidateNumber).padStart(6, '0')} - ${candidateName
    .trim()
    .toUpperCase()}`

  const response = await fetch(
    'https://www.googleapis.com/drive/v3/files?supportsAllDrives=true&fields=id,name,webViewLink,driveId',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json; charset=utf-8',
      },
      body: JSON.stringify({
        name: folderName,
        mimeType: 'application/vnd.google-apps.folder',
        parents: [parentId],
        appProperties: {
          candidatura_id: candidaturaId,
          origem: 'rh_interlaser',
        },
      }),
    },
  )

  const data = (await response.json()) as DriveFile

  if (!response.ok || !data.id) {
    throw new Error(
      `Não foi possível criar a pasta no Drive: ${
        data.error?.message ?? response.status
      }`,
    )
  }

  return data
}

async function sendHiringEmail(args: {
  accessToken: string
  recipient: string
  candidateName: string
  vacancyName: string
  dueDate: string
  documents: Array<{ codigo: string; nome: string }>
  uploadUrl: string
}) {
  const sender = secret('GOOGLE_SENDER_EMAIL')
  const formattedDueDate = new Intl.DateTimeFormat('pt-BR').format(
    new Date(`${args.dueDate}T12:00:00-03:00`),
  )

  const documentItems = args.documents
    .map((document) => `<li>${escapeHtml(document.nome)}</li>`)
    .join('')

  const html = `
    <div style="font-family:Arial,sans-serif;color:#172033;line-height:1.6;max-width:620px;margin:auto">
      <h2 style="color:#185fa5">Documentação para admissão</h2>
      <p>Olá, <strong>${escapeHtml(args.candidateName)}</strong>.</p>
      <p>Parabéns pela aprovação no processo seletivo para a vaga de <strong>${escapeHtml(args.vacancyName)}</strong>.</p>
      <p>Para dar continuidade à sua admissão, envie os documentos abaixo até <strong>${formattedDueDate}</strong>:</p>
      <ul>${documentItems}</ul>
      <p style="margin:28px 0">
        <a href="${args.uploadUrl}" style="background:#185fa5;color:#fff;padding:13px 20px;border-radius:8px;text-decoration:none;font-weight:bold">Enviar documentos</a>
      </p>
      <p>O link é exclusivo para esta solicitação. Não encaminhe para outras pessoas.</p>
      <p>Atenciosamente,<br><strong>Recursos Humanos — Interlaser Máquinas</strong></p>
    </div>
  `.trim()

  const raw = [
    `From: RH Interlaser <${sender}>`,
    `To: ${args.recipient}`,
    `Subject: ${mimeHeader('Envio de documentos admissionais — Interlaser')}`,
    'MIME-Version: 1.0',
    'Content-Type: text/html; charset="UTF-8"',
    'Content-Transfer-Encoding: 8bit',
    '',
    html,
  ].join('\r\n')

  const response = await fetch(
    'https://gmail.googleapis.com/gmail/v1/users/me/messages/send',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${args.accessToken}`,
        'Content-Type': 'application/json; charset=utf-8',
      },
      body: JSON.stringify({ raw: base64Url(raw) }),
    },
  )

  const data = (await response.json()) as GmailResult

  if (!response.ok || !data.id) {
    throw new Error(
      data.error?.message ?? `Gmail retornou HTTP ${response.status}`,
    )
  }

  return data
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (request.method !== 'POST') {
    return json({ ok: false, error: 'Use o método POST.' }, 405)
  }

  try {
    const authorization = request.headers.get('Authorization') ?? ''
    const token = authorization.replace(/^Bearer\s+/i, '').trim()

    if (!token) {
      return json({ ok: false, error: 'Usuário não autenticado.' }, 401)
    }

    const supabaseUrl = secret('SUPABASE_URL')
    const anonKey = secret('SUPABASE_ANON_KEY')
    const serviceRoleKey = secret('SUPABASE_SERVICE_ROLE_KEY')

    const userClient = createClient(supabaseUrl, anonKey)
    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    const { data: userData, error: userError } =
      await userClient.auth.getUser(token)

    if (userError || !userData.user) {
      return json({ ok: false, error: 'Sessão inválida.' }, 401)
    }

    const userId = userData.user.id

    const { data: actor, error: actorError } = await admin
      .from('profiles')
      .select('id, role, active')
      .eq('id', userId)
      .single()

    if (
      actorError ||
      !actor?.active ||
      !['admin', 'rh'].includes(actor.role)
    ) {
      return json(
        { ok: false, error: 'Somente o RH pode solicitar documentos admissionais.' },
        403,
      )
    }

    const body = (await request.json()) as RequestBody
    const candidaturaId = body.candidaturaId?.trim()
    const responsavelId = body.responsavelId?.trim()
    const dataPrevistaInicio = normalizeDate(
      body.dataPrevistaInicio,
      'a data prevista de início',
    )
    const prazoEnvio = normalizeDate(
      body.prazoEnvio,
      'o prazo de envio',
    )

    if (!candidaturaId || !responsavelId) {
      throw new Error('Informe a candidatura e o responsável do RH.')
    }

    const requestedDocumentCodes = Array.from(
      new Set(
        (body.documentos ?? [])
          .map((item) => String(item).trim().toLowerCase())
          .filter((item) =>
            /^[a-z0-9]+(?:_[a-z0-9]+)*$/.test(item),
          ),
      ),
    )

    if (requestedDocumentCodes.length === 0) {
      throw new Error('Selecione pelo menos um documento.')
    }

    const {
      data: configuredDocuments,
      error: configuredDocumentsError,
    } = await admin
      .from('documentos_configuracao')
      .select('codigo, nome')
      .eq('active', true)
      .in('codigo', requestedDocumentCodes)

    if (configuredDocumentsError) {
      throw new Error(
        `Não foi possível validar os documentos: ${configuredDocumentsError.message}`,
      )
    }

    if (
      !configuredDocuments ||
      configuredDocuments.length !== requestedDocumentCodes.length
    ) {
      throw new Error(
        'Um ou mais documentos selecionados estão inativos ou não existem.',
      )
    }

    const configuredDocumentMap = new Map(
      configuredDocuments.map((item) => [item.codigo, item.nome]),
    )

    const documents = requestedDocumentCodes.map((codigo) => ({
      codigo,
      nome: configuredDocumentMap.get(codigo) ?? codigo,
    }))

    if (
      new Date(`${prazoEnvio}T12:00:00-03:00`) >
      new Date(`${dataPrevistaInicio}T23:59:59-03:00`)
    ) {
      throw new Error(
        'O prazo dos documentos não pode ser posterior à data prevista de início.',
      )
    }

    const { data: responsible, error: responsibleError } = await admin
      .from('profiles')
      .select('id, role, active, full_name')
      .eq('id', responsavelId)
      .single()

    if (
      responsibleError ||
      !responsible?.active ||
      responsible.role !== 'rh'
    ) {
      throw new Error(
        'O responsável deve ser um usuário ativo do Recursos Humanos.',
      )
    }

    const { data: application, error: applicationError } = await admin
      .from('candidaturas')
      .select('id, candidato_id, vaga_id, etapa, status')
      .eq('id', candidaturaId)
      .single()

    if (applicationError || !application) {
      throw new Error('Candidatura não encontrada.')
    }

    const [{ data: candidate }, { data: vacancy }] = await Promise.all([
      admin
        .from('candidatos')
        .select('id, numero, nome_completo, email')
        .eq('id', application.candidato_id)
        .single(),
      admin
        .from('vagas')
        .select('id, numero, cargo, setor')
        .eq('id', application.vaga_id)
        .single(),
    ])

    if (!candidate || !vacancy) {
      throw new Error('Não foi possível carregar candidato e vaga.')
    }

    if (!candidate.email?.trim()) {
      throw new Error(
        'O candidato precisa ter um e-mail cadastrado para receber a solicitação.',
      )
    }

    const { data: existingRequest } = await admin
      .from('solicitacoes_documentos')
      .select('id')
      .eq('candidatura_id', candidaturaId)
      .maybeSingle()

    if (existingRequest) {
      return json(
        {
          ok: false,
          error:
            'Esta candidatura já possui uma solicitação de documentos.',
        },
        409,
      )
    }

    const googleToken = await googleAccessToken()
    const folder = await createCandidateFolder(
      googleToken,
      candidaturaId,
      candidate.numero,
      candidate.nome_completo,
    )

    let onboarding: { id: string } | null = null

    const { data: existingOnboarding } = await admin
      .from('onboardings')
      .select('id')
      .eq('candidatura_id', candidaturaId)
      .maybeSingle()

    if (existingOnboarding) {
      const { data, error } = await admin
        .from('onboardings')
        .update({
          responsavel_id: responsavelId,
          data_prevista_inicio: dataPrevistaInicio,
          status: 'em_andamento',
        })
        .eq('id', existingOnboarding.id)
        .select('id')
        .single()

      if (error) throw new Error(`Erro no onboarding: ${error.message}`)
      onboarding = data
    } else {
      const { data, error } = await admin
        .from('onboardings')
        .insert({
          candidatura_id: candidaturaId,
          responsavel_id: responsavelId,
          data_prevista_inicio: dataPrevistaInicio,
          status: 'em_andamento',
          observacoes:
            'Pré-onboarding criado automaticamente na etapa de documentação.',
          created_by: userId,
        })
        .select('id')
        .single()

      if (error) throw new Error(`Erro ao criar onboarding: ${error.message}`)
      onboarding = data
    }

    if (!onboarding) {
      throw new Error('Não foi possível preparar o onboarding.')
    }

    const publicToken = randomToken()
    const tokenHash = await sha256(publicToken)

    const { data: solicitation, error: solicitationError } = await admin
      .from('solicitacoes_documentos')
      .insert({
        candidatura_id: candidaturaId,
        onboarding_id: onboarding.id,
        token_hash: tokenHash,
        token_final: publicToken.slice(-6),
        prazo_envio: prazoEnvio,
        status: 'pendente',
        email_destino: candidate.email.trim().toLowerCase(),
        drive_folder_id: folder.id,
        drive_folder_url:
          folder.webViewLink ??
          `https://drive.google.com/drive/folders/${folder.id}`,
        created_by: userId,
      })
      .select('id')
      .single()

    if (solicitationError || !solicitation) {
      throw new Error(
        `Erro ao registrar solicitação: ${solicitationError?.message ?? 'sem retorno'}`,
      )
    }

    const { error: documentError } = await admin
      .from('documentos_solicitados')
      .insert(
        documents.map((document) => ({
          solicitacao_id: solicitation.id,
          tipo: document.codigo,
          obrigatorio: true,
          status: 'pendente',
        })),
      )

    if (documentError) {
      await admin
        .from('solicitacoes_documentos')
        .delete()
        .eq('id', solicitation.id)
      throw new Error(`Erro ao registrar documentos: ${documentError.message}`)
    }

    const { data: updatedApplication, error: updateApplicationError } =
      await admin
        .from('candidaturas')
        .update({
          etapa: 'documentacao',
          status: 'ativo',
          responsavel_id: responsavelId,
          proxima_acao: 'Enviar documentos admissionais',
          proxima_acao_em: `${prazoEnvio}T12:00:00-03:00`,
          observacoes:
            'Documentação admissional solicitada ao candidato.',
        })
        .eq('id', candidaturaId)
        .select(
          'id, candidato_id, vaga_id, etapa, status, responsavel_id, data_entrada, proxima_acao, proxima_acao_em, motivo_reprovacao, parecer_final, observacoes, teste_inicio, teste_local, exame_inicio, exame_local, exame_status, created_at, updated_at',
        )
        .single()

    if (updateApplicationError) {
      throw new Error(
        `Erro ao atualizar a etapa de documentação: ${updateApplicationError.message}`,
      )
    }

    const appUrl = (
      Deno.env.get('APP_PUBLIC_URL') ?? request.headers.get('Origin') ?? ''
    ).replace(/\/$/, '')

    if (!appUrl) {
      throw new Error('Cadastre o Secret APP_PUBLIC_URL no Supabase.')
    }

    const uploadUrl = `${appUrl}/?documentos=${encodeURIComponent(publicToken)}`

    let emailSent = false
    let emailError: string | null = null

    try {
      await sendHiringEmail({
        accessToken: googleToken,
        recipient: candidate.email.trim().toLowerCase(),
        candidateName: candidate.nome_completo,
        vacancyName: vacancy.cargo,
        dueDate: prazoEnvio,
        documents,
        uploadUrl,
      })
      emailSent = true

      await admin
        .from('solicitacoes_documentos')
        .update({
          email_enviado_em: new Date().toISOString(),
          email_tentativas: 1,
          email_ultimo_erro: null,
        })
        .eq('id', solicitation.id)
    } catch (error) {
      emailError = error instanceof Error ? error.message : 'Erro desconhecido'

      await admin
        .from('solicitacoes_documentos')
        .update({
          email_tentativas: 1,
          email_ultimo_erro: emailError,
        })
        .eq('id', solicitation.id)
    }

    return json({
      ok: true,
      partialSuccess: !emailSent,
      message: emailSent
        ? 'Documentação solicitada, pasta criada e e-mail enviado.'
        : 'Documentação solicitada, mas o e-mail não foi enviado.',
      emailSent,
      emailError,
      candidature: updatedApplication,
      onboardingId: onboarding.id,
      solicitationId: solicitation.id,
      driveFolderUrl:
        folder.webViewLink ??
        `https://drive.google.com/drive/folders/${folder.id}`,
    })
  } catch (error) {
    console.error('Erro em solicitar-documentos-admissionais:', error)

    return json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : 'Não foi possível solicitar os documentos.',
      },
      400,
    )
  }
})
