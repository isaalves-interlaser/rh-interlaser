import { corsHeaders, jsonResponse } from '../_shared/cors.ts'

type Payload = {
  acao?: string
  candidato?: {
    nomeCompleto?: string | null
    email?: string | null
  }
  vaga?: {
    codigo?: string | null
    cargo?: string | null
    setor?: string | null
  }
  candidaturaId?: string | null
  observacao?: string | null
}

type GoogleTokenResponse = {
  access_token?: string
  error?: string
  error_description?: string
}

function text(value: unknown) {
  return String(value ?? '').trim()
}

function secret(name: string) {
  const value = Deno.env.get(name)?.trim()

  if (!value) {
    throw new Error(`Secret ausente: ${name}`)
  }

  return value
}

function bytesToBinary(bytes: Uint8Array) {
  let binary = ''
  const chunkSize = 0x8000

  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize))
  }

  return binary
}

function base64Utf8(value: string) {
  return btoa(bytesToBinary(new TextEncoder().encode(value)))
}

function base64UrlUtf8(value: string) {
  return base64Utf8(value)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '')
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
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

  const data = (await response.json()) as GoogleTokenResponse

  if (!response.ok || !data.access_token) {
    throw new Error(
      `Não foi possível autenticar no Google: ${
        data.error_description ?? data.error ?? response.status
      }`,
    )
  }

  return data.access_token
}

async function enviarEmailGmail(params: {
  to: string
  subject: string
  html: string
}) {
  const accessToken = await googleAccessToken()
  const senderEmail = secret('GOOGLE_SENDER_EMAIL')

  const rawMessage = [
    `From: RH Interlaser <${senderEmail}>`,
    `To: ${params.to}`,
    `Subject: =?UTF-8?B?${base64Utf8(params.subject)}?=`,
    'MIME-Version: 1.0',
    'Content-Type: text/html; charset=UTF-8',
    '',
    params.html,
  ].join('\r\n')

  const response = await fetch(
    'https://gmail.googleapis.com/gmail/v1/users/me/messages/send',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        raw: base64UrlUtf8(rawMessage),
      }),
    },
  )

  const data = await response.json().catch(() => ({}))

  if (!response.ok) {
    throw new Error(
      data?.error?.message ??
        data?.error_description ??
        'Não foi possível enviar o e-mail ao candidato.',
    )
  }

  return data
}

function montarEmailVinculo(params: {
  nomeCompleto: string
  vagaCodigo: string
  vagaCargo: string
  vagaSetor: string | null
}) {
  const nome = escapeHtml(params.nomeCompleto)
  const vagaCodigo = escapeHtml(params.vagaCodigo)
  const vagaCargo = escapeHtml(params.vagaCargo)
  const vagaSetor = params.vagaSetor ? escapeHtml(params.vagaSetor) : ''
  const portalUrl = escapeHtml(
    (Deno.env.get('APP_PUBLIC_URL')?.trim() || 'https://rh-interlaser.vercel.app').replace(/\/$/g, ''),
  )

  return `
    <div style="margin:0;padding:0;background:#f6f8fb;font-family:Arial,Helvetica,sans-serif;color:#172033;">
      <div style="max-width:640px;margin:0 auto;padding:28px 16px;">
        <div style="background:#ffffff;border:1px solid #e5eaf2;border-radius:18px;overflow:hidden;">
          <div style="padding:26px 28px;background:linear-gradient(135deg,#ff7a1a,#ff9a3d);color:#ffffff;">
            <p style="margin:0 0 8px;font-size:12px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;">Interlaser Máquinas</p>
            <h1 style="margin:0;font-size:25px;line-height:1.2;">Seu currículo foi selecionado para uma oportunidade</h1>
          </div>

          <div style="padding:28px;">
            <p style="margin:0 0 16px;font-size:16px;line-height:1.6;">Olá, <strong>${nome}</strong>.</p>
            <p style="margin:0 0 16px;font-size:16px;line-height:1.6;">
              Seu currículo estava em nosso Banco de Talentos e foi selecionado para participar de uma nova oportunidade na Interlaser.
            </p>

            <div style="margin:22px 0;padding:18px;border:1px solid #e5eaf2;border-radius:14px;background:#f8fafc;">
              <p style="margin:0 0 6px;color:#667085;font-size:13px;font-weight:700;text-transform:uppercase;">Vaga</p>
              <p style="margin:0;font-size:18px;font-weight:800;color:#172033;">${vagaCodigo} — ${vagaCargo}</p>
              ${vagaSetor ? `<p style="margin:6px 0 0;color:#667085;font-size:14px;">Setor: ${vagaSetor}</p>` : ''}
            </div>

            <p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#4b587c;">
              A equipe de RH analisará seu perfil para esta vaga e entrará em contato caso haja avanço no processo seletivo.
            </p>

            <a href="${portalUrl}/vagas" style="display:inline-block;padding:13px 18px;border-radius:999px;background:#ff7a1a;color:#ffffff;text-decoration:none;font-weight:800;">
              Ver vagas da Interlaser
            </a>

            <p style="margin:24px 0 0;font-size:13px;line-height:1.5;color:#7b849c;">
              Esta é uma mensagem automática. Por favor, não responda este e-mail.
            </p>
          </div>
        </div>
      </div>
    </div>
  `
}

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const body = (await request.json()) as Payload

    if (body?.acao !== 'notificar-vinculo-vaga') {
      return jsonResponse({ ok: false, error: 'Ação inválida.' }, 400)
    }

    const email = text(body.candidato?.email).toLowerCase()
    const nomeCompleto = text(body.candidato?.nomeCompleto)
    const vagaCodigo = text(body.vaga?.codigo)
    const vagaCargo = text(body.vaga?.cargo)
    const vagaSetor = text(body.vaga?.setor) || null

    if (!email) {
      return jsonResponse({ ok: false, error: 'E-mail do candidato não informado.' }, 400)
    }

    if (!nomeCompleto || !vagaCargo) {
      return jsonResponse({ ok: false, error: 'Dados obrigatórios não informados.' }, 400)
    }

    await enviarEmailGmail({
      to: email,
      subject: `Nova oportunidade Interlaser - ${vagaCargo}`,
      html: montarEmailVinculo({
        nomeCompleto,
        vagaCodigo: vagaCodigo || 'Vaga',
        vagaCargo,
        vagaSetor,
      }),
    })

    return jsonResponse({ ok: true, emailEnviado: true })
  } catch (error) {
    console.error(error)

    return jsonResponse(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'Erro inesperado ao enviar e-mail.',
      },
      500,
    )
  }
})
