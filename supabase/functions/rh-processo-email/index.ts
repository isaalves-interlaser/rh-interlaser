import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

type RequestBody = {
  candidaturaId?: string
  tipo?: 'teste' | 'exame'
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

  if (!value) {
    throw new Error(`Secret ausente: ${name}`)
  }

  return value
}

function escapeHtml(value: string | null | undefined) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

function base64Url(value: string) {
  const bytes = new TextEncoder().encode(value)
  let binary = ''

  for (const byte of bytes) {
    binary += String.fromCharCode(byte)
  }

  return btoa(binary)
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replaceAll('=', '')
}

function mimeHeader(value: string) {
  const bytes = new TextEncoder().encode(value)
  let binary = ''

  for (const byte of bytes) {
    binary += String.fromCharCode(byte)
  }

  return `=?UTF-8?B?${btoa(binary)}?=`
}

function formatDateTime(value: string) {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    throw new Error('Data e horário inválidos para envio do e-mail.')
  }

  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'full',
    timeStyle: 'short',
    timeZone: 'America/Sao_Paulo',
  }).format(date)
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

async function sendEmail(args: {
  accessToken: string
  to: string
  subject: string
  html: string
}) {
  const sender = secret('GOOGLE_SENDER_EMAIL')

  const raw = [
    `From: RH Interlaser <${sender}>`,
    `To: ${args.to}`,
    `Subject: ${mimeHeader(args.subject)}`,
    'MIME-Version: 1.0',
    'Content-Type: text/html; charset="UTF-8"',
    'Content-Transfer-Encoding: 8bit',
    '',
    args.html,
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

function buildHtml(args: {
  tipo: 'teste' | 'exame'
  candidatoNome: string
  vagaCargo: string
  vagaSetor: string
  inicio: string
  local: string
  observacoes: string | null
  exameStatus?: string | null
}) {
  const isTest = args.tipo === 'teste'
  const title = isTest
    ? 'Teste prático agendado'
    : 'Exame admissional agendado'
  const intro = isTest
    ? 'Seu teste prático foi agendado pela equipe de Recursos Humanos.'
    : 'Seu exame admissional foi agendado pela equipe de Recursos Humanos.'
  const localLabel = isTest ? 'Local do teste' : 'Clínica ou local do exame'
  const defaultGuidance = isTest
    ? 'Compareça com documento com foto e chegue com alguns minutos de antecedência.'
    : 'Compareça com documento com foto e siga as orientações da clínica informada.'

  const guidance = args.observacoes?.trim() || defaultGuidance

  return `
    <div style="font-family:Arial,sans-serif;color:#172033;line-height:1.6;max-width:640px;margin:auto;background:#ffffff">
      <div style="padding:22px 24px;border-radius:16px 16px 0 0;background:#f97316;color:#ffffff">
        <div style="font-size:12px;font-weight:bold;letter-spacing:.08em;text-transform:uppercase">Interlaser Máquinas</div>
        <h2 style="margin:8px 0 0;font-size:22px">${escapeHtml(title)}</h2>
      </div>

      <div style="padding:24px;border:1px solid #fed7aa;border-top:0;border-radius:0 0 16px 16px">
        <p>Olá, <strong>${escapeHtml(args.candidatoNome)}</strong>.</p>
        <p>${escapeHtml(intro)}</p>

        <div style="margin:20px 0;padding:16px;border-radius:12px;background:#fff7ed;border:1px solid #fed7aa">
          <p style="margin:0 0 10px"><strong>Vaga:</strong> ${escapeHtml(args.vagaCargo)}</p>
          <p style="margin:0 0 10px"><strong>Setor:</strong> ${escapeHtml(args.vagaSetor)}</p>
          <p style="margin:0 0 10px"><strong>Data e horário:</strong> ${escapeHtml(formatDateTime(args.inicio))}</p>
          <p style="margin:0"><strong>${escapeHtml(localLabel)}:</strong> ${escapeHtml(args.local)}</p>
        </div>

        <p><strong>Orientações:</strong></p>
        <p>${escapeHtml(guidance).replaceAll('\n', '<br>')}</p>

        <p style="margin-top:24px">Em caso de dúvidas, responda este e-mail ou entre em contato com o RH.</p>
        <p>Atenciosamente,<br><strong>Recursos Humanos — Interlaser Máquinas</strong></p>
      </div>
    </div>
  `.trim()
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

    const admin = createClient(
      secret('SUPABASE_URL'),
      secret('SUPABASE_SERVICE_ROLE_KEY'),
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      },
    )

    const { data: userData, error: userError } =
      await admin.auth.getUser(token)

    if (userError || !userData.user) {
      return json({ ok: false, error: 'Sessão inválida.' }, 401)
    }

    const { data: actor, error: actorError } = await admin
      .from('profiles')
      .select('id, role, active')
      .eq('id', userData.user.id)
      .single()

    if (
      actorError ||
      !actor?.active ||
      !['admin', 'rh', 'gestor'].includes(actor.role)
    ) {
      return json(
        {
          ok: false,
          error:
            'Você não possui permissão para enviar comunicação ao candidato.',
        },
        403,
      )
    }

    const body = (await request.json()) as RequestBody
    const candidaturaId = body.candidaturaId?.trim()
    const tipo = body.tipo

    if (!candidaturaId || !['teste', 'exame'].includes(String(tipo))) {
      return json(
        { ok: false, error: 'Informe a candidatura e o tipo de agendamento.' },
        400,
      )
    }

    const { data: application, error: applicationError } = await admin
      .from('candidaturas')
      .select(
        'id, candidato_id, vaga_id, teste_inicio, teste_local, exame_inicio, exame_local, exame_status, observacoes',
      )
      .eq('id', candidaturaId)
      .single()

    if (applicationError || !application) {
      return json({ ok: false, error: 'Candidatura não encontrada.' }, 404)
    }

    const [{ data: candidate }, { data: vacancy }] = await Promise.all([
      admin
        .from('candidatos')
        .select('id, nome_completo, email')
        .eq('id', application.candidato_id)
        .single(),
      admin
        .from('vagas')
        .select('id, cargo, setor')
        .eq('id', application.vaga_id)
        .single(),
    ])

    if (!candidate || !vacancy) {
      return json(
        { ok: false, error: 'Não foi possível carregar candidato e vaga.' },
        404,
      )
    }

    const recipient = String(candidate.email ?? '').trim().toLowerCase()

    if (!recipient) {
      return json(
        {
          ok: false,
          error:
            'O candidato não possui e-mail cadastrado para receber o agendamento.',
        },
        409,
      )
    }

    const isTest = tipo === 'teste'
    const inicio = isTest ? application.teste_inicio : application.exame_inicio
    const local = isTest ? application.teste_local : application.exame_local

    if (!inicio || !local) {
      return json(
        {
          ok: false,
          error:
            'Salve a data, horário e local antes de enviar o e-mail ao candidato.',
        },
        409,
      )
    }

    const accessToken = await googleAccessToken()
    const subject = isTest
      ? 'Agendamento de teste — Interlaser'
      : 'Agendamento de exame admissional — Interlaser'

    await sendEmail({
      accessToken,
      to: recipient,
      subject,
      html: buildHtml({
        tipo,
        candidatoNome: candidate.nome_completo,
        vagaCargo: vacancy.cargo,
        vagaSetor: vacancy.setor,
        inicio,
        local,
        observacoes: application.observacoes,
        exameStatus: application.exame_status,
      }),
    })

    return json({
      ok: true,
      message: isTest
        ? 'E-mail do teste enviado ao candidato.'
        : 'E-mail do exame enviado ao candidato.',
    })
  } catch (error) {
    console.error('Erro em rh-processo-email:', error)

    return json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : 'Não foi possível enviar o e-mail ao candidato.',
      },
      400,
    )
  }
})
