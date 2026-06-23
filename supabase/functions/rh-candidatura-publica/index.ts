import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders, jsonResponse } from '../_shared/cors.ts'

type Candidato = {
  id: string
  nome_completo: string | null
  email: string | null
  whatsapp: string | null
}

type RegistroPayload = {
  acao?: string
  tipo?: 'vaga' | 'banco_talentos'
  vagaId?: string | null
  candidato?: {
    nomeCompleto?: string
    email?: string
    whatsapp?: string
    cidade?: string | null
    uf?: string | null
  }
  curriculoDrive?: {
    fileId?: string
    fileUrl?: string | null
    fileName?: string
    folderId?: string
    folderUrl?: string | null
  }
  observacoes?: string | null
  bancoTalentosArea?: 'administrativo' | 'producao' | null
}

function supabaseAdmin() {
  return createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    { auth: { persistSession: false } },
  )
}

function text(value: unknown) {
  return String(value ?? '').trim()
}

function normalizeEmail(value: unknown) {
  return text(value).toLowerCase()
}

function normalizePhone(value: unknown) {
  return text(value).replace(/\D/g, '')
}

function nullable(value: unknown) {
  const normalized = text(value)
  return normalized || null
}

function normalizeBancoTalentosArea(value: unknown) {
  const normalized = text(value).toLowerCase()

  if (normalized === 'administrativo' || normalized === 'producao') {
    return normalized
  }

  return null
}

function driveFileUrl(fileId: string, fileUrl: string | null | undefined) {
  return fileUrl || `https://drive.google.com/file/d/${fileId}/view`
}

function mergeObservacoes(previous: string | null | undefined, next: string | null) {
  const values = [previous?.trim(), next?.trim()].filter(Boolean)
  return values.join('\n\n---\n\n') || null
}

type GoogleTokenResponse = {
  access_token?: string
  error?: string
  error_description?: string
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
        'Não foi possível enviar o e-mail de confirmação.',
    )
  }

  return data
}

function montarEmailConfirmacao(params: {
  nomeCompleto: string
  vagaTitulo: string
  confirmacaoUrl: string
  situacao: string
}) {
  const nome = escapeHtml(params.nomeCompleto)
  const vaga = escapeHtml(params.vagaTitulo)
  const confirmacaoUrl = escapeHtml(params.confirmacaoUrl)

  const textoPrincipal =
    params.situacao === 'ja_inscrito'
      ? 'Identificamos que você já estava inscrito nesta vaga e atualizamos seus dados/currículo para análise do RH.'
      : 'Recebemos sua inscrição com sucesso. Seu currículo foi encaminhado para análise da equipe de RH.'

  return `
    <div style="margin:0;padding:0;background:#f6f8fb;font-family:Arial,Helvetica,sans-serif;color:#172033;">
      <div style="max-width:640px;margin:0 auto;padding:28px 16px;">
        <div style="background:#ffffff;border:1px solid #e5eaf2;border-radius:18px;overflow:hidden;">
          <div style="padding:26px 28px;background:linear-gradient(135deg,#ff7a1a,#ff9a3d);color:#ffffff;">
            <p style="margin:0 0 8px;font-size:12px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;">Interlaser Máquinas</p>
            <h1 style="margin:0;font-size:26px;line-height:1.2;">Inscrição recebida com sucesso</h1>
          </div>

          <div style="padding:28px;">
            <p style="margin:0 0 16px;font-size:16px;line-height:1.6;">Olá, <strong>${nome}</strong>.</p>
            <p style="margin:0 0 16px;font-size:16px;line-height:1.6;">${textoPrincipal}</p>

            <div style="margin:22px 0;padding:18px;border:1px solid #e5eaf2;border-radius:14px;background:#f8fafc;">
              <p style="margin:0 0 6px;color:#667085;font-size:13px;font-weight:700;text-transform:uppercase;">Vaga</p>
              <p style="margin:0;font-size:18px;font-weight:800;color:#172033;">${vaga}</p>
            </div>

            <p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#4b587c;">
              Caso seu perfil avance no processo seletivo, entraremos em contato pelo e-mail ou WhatsApp informado na candidatura.
            </p>

            <a href="${confirmacaoUrl}" style="display:inline-block;padding:13px 18px;border-radius:999px;background:#ff7a1a;color:#ffffff;text-decoration:none;font-weight:800;">
              Ver confirmação
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

async function enviarConfirmacaoCandidatura(params: {
  email: string
  nomeCompleto: string
  vagaTitulo: string
  situacao: string
}) {
  const appUrl = Deno.env.get('APP_PUBLIC_URL')?.trim() || 'https://rh-interlaser.vercel.app'
  const confirmacaoUrl = `${appUrl.replace(/\/$/g, '')}/confirmacao-candidatura`

  await enviarEmailGmail({
    to: params.email,
    subject: `Inscrição recebida - ${params.vagaTitulo}`,
    html: montarEmailConfirmacao({
      nomeCompleto: params.nomeCompleto,
      vagaTitulo: params.vagaTitulo,
      confirmacaoUrl,
      situacao: params.situacao,
    }),
  })
}

async function buscarCandidatoExistente(
  supabase: ReturnType<typeof supabaseAdmin>,
  email: string,
  whatsapp: string,
) {
  const encontrados = new Map<string, Candidato>()

  if (email) {
    const { data, error } = await supabase
      .from('candidatos')
      .select('id, nome_completo, email, whatsapp')
      .eq('email', email)
      .limit(2)

    if (error) {
      throw new Error(`Erro ao consultar candidato por e-mail: ${error.message}`)
    }

    for (const candidato of (data ?? []) as Candidato[]) {
      encontrados.set(candidato.id, candidato)
    }
  }

  if (whatsapp) {
    const { data, error } = await supabase
      .from('candidatos')
      .select('id, nome_completo, email, whatsapp')
      .eq('whatsapp', whatsapp)
      .limit(2)

    if (error) {
      throw new Error(`Erro ao consultar candidato por WhatsApp: ${error.message}`)
    }

    for (const candidato of (data ?? []) as Candidato[]) {
      encontrados.set(candidato.id, candidato)
    }
  }

  const candidatos = Array.from(encontrados.values())

  if (candidatos.length > 1) {
    throw new Error(
      'Encontramos dados divergentes no cadastro. Entre em contato com o RH para atualização das informações.',
    )
  }

  return candidatos[0] ?? null
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const body = (await request.json()) as RegistroPayload

    if (body?.acao !== 'registrar-candidatura-publica') {
      return jsonResponse({ ok: false, error: 'Ação inválida.' }, 400)
    }

    const tipo = body.tipo === 'banco_talentos' ? 'banco_talentos' : 'vaga'
    const vagaId = body.vagaId ? text(body.vagaId) : null
    const nomeCompleto = text(body.candidato?.nomeCompleto)
    const email = normalizeEmail(body.candidato?.email)
    const whatsapp = normalizePhone(body.candidato?.whatsapp)
    const cidade = nullable(body.candidato?.cidade)
    const uf = nullable(body.candidato?.uf)?.toUpperCase() ?? null
    const observacoes = nullable(body.observacoes)
    const bancoTalentosArea = normalizeBancoTalentosArea(body.bancoTalentosArea)
    const curriculo = body.curriculoDrive

    if (!nomeCompleto || nomeCompleto.length < 3) {
      return jsonResponse({ ok: false, error: 'Nome do candidato é obrigatório.' }, 400)
    }

    if (!email) {
      return jsonResponse({ ok: false, error: 'E-mail do candidato é obrigatório.' }, 400)
    }

    if (!whatsapp) {
      return jsonResponse({ ok: false, error: 'WhatsApp do candidato é obrigatório.' }, 400)
    }

    if (tipo === 'vaga' && !vagaId) {
      return jsonResponse({ ok: false, error: 'Vaga não informada.' }, 400)
    }

    if (tipo === 'banco_talentos' && !bancoTalentosArea) {
      return jsonResponse(
        { ok: false, error: 'Área de interesse do banco de talentos é obrigatória.' },
        400,
      )
    }

    if (!curriculo?.fileId || !curriculo?.fileName || !curriculo?.folderId) {
      return jsonResponse(
        { ok: false, error: 'Dados do currículo no Drive não foram informados.' },
        400,
      )
    }

    const supabase = supabaseAdmin()
    const curriculoUrl = driveFileUrl(curriculo.fileId, curriculo.fileUrl)

    const existente = await buscarCandidatoExistente(supabase, email, whatsapp)

    let candidatoId = existente?.id ?? null
    let situacao:
      | 'candidato_criado'
      | 'candidato_atualizado'
      | 'candidatura_criada_candidato_existente'
      | 'ja_inscrito'
      | 'banco_talentos_atualizado' = 'candidato_criado'

    if (existente) {
      const { data: candidatoCompleto } = await supabase
        .from('candidatos')
        .select('observacoes')
        .eq('id', existente.id)
        .maybeSingle<{ observacoes: string | null }>()

      const { error: updateError } = await supabase
        .from('candidatos')
        .update({
          nome_completo: nomeCompleto,
          email,
          whatsapp,
          cidade,
          uf,
          origem: tipo === 'banco_talentos' ? 'banco_talentos' : 'site',
          ...(tipo === 'banco_talentos'
            ? { banco_talentos_area: bancoTalentosArea }
            : {}),
          observacoes: mergeObservacoes(candidatoCompleto?.observacoes, observacoes),
          curriculo_path: curriculoUrl,
          curriculo_drive_file_id: curriculo.fileId,
          curriculo_drive_url: curriculoUrl,
          curriculo_drive_nome: curriculo.fileName,
          curriculo_drive_folder_id: curriculo.folderId,
          active: true,
        })
        .eq('id', existente.id)

      if (updateError) {
        throw new Error(`Não foi possível atualizar o cadastro do candidato: ${updateError.message}`)
      }

      candidatoId = existente.id
      situacao = tipo === 'banco_talentos'
        ? 'banco_talentos_atualizado'
        : 'candidato_atualizado'
    } else {
      const { data: candidatoCriado, error: insertError } = await supabase
        .from('candidatos')
        .insert({
          nome_completo: nomeCompleto,
          email,
          whatsapp,
          cidade,
          uf,
          origem: tipo === 'banco_talentos' ? 'banco_talentos' : 'site',
          banco_talentos_area: tipo === 'banco_talentos' ? bancoTalentosArea : null,
          observacoes,
          curriculo_path: curriculoUrl,
          curriculo_drive_file_id: curriculo.fileId,
          curriculo_drive_url: curriculoUrl,
          curriculo_drive_nome: curriculo.fileName,
          curriculo_drive_folder_id: curriculo.folderId,
          active: true,
        })
        .select('id')
        .single<{ id: string }>()

      if (insertError || !candidatoCriado) {
        throw new Error(
          `Não foi possível cadastrar o candidato: ${insertError?.message ?? 'erro desconhecido'}`,
        )
      }

      candidatoId = candidatoCriado.id
      situacao = 'candidato_criado'
    }

    let candidaturaId: string | null = null

    if (tipo === 'vaga' && vagaId && candidatoId) {
      const { data: candidaturaExistente, error: consultaCandidaturaError } =
        await supabase
          .from('candidaturas')
          .select('id')
          .eq('candidato_id', candidatoId)
          .eq('vaga_id', vagaId)
          .maybeSingle<{ id: string }>()

      if (consultaCandidaturaError) {
        throw new Error(
          `Não foi possível verificar candidatura existente: ${consultaCandidaturaError.message}`,
        )
      }

      if (candidaturaExistente) {
        candidaturaId = candidaturaExistente.id
        situacao = 'ja_inscrito'

        await supabase
          .from('candidaturas')
          .update({
            status: 'ativo',
            observacoes:
              'Candidato já estava inscrito nesta vaga e reenviou/atualizou o currículo pelo portal público.',
          })
          .eq('id', candidaturaExistente.id)
      } else {
        const { data: candidaturaCriada, error: candidaturaError } =
          await supabase
            .from('candidaturas')
            .insert({
              candidato_id: candidatoId,
              vaga_id: vagaId,
              etapa: 'recebido',
              status: 'ativo',
              observacoes:
                existente
                  ? 'Candidatura criada pelo portal público para candidato já existente. Currículo atualizado no Google Drive.'
                  : 'Candidatura enviada pelo portal público. Currículo armazenado no Google Drive.',
            })
            .select('id')
            .single<{ id: string }>()

        if (candidaturaError || !candidaturaCriada) {
          throw new Error(
            `Não foi possível vincular candidato à vaga: ${candidaturaError?.message ?? 'erro desconhecido'}`,
          )
        }

        candidaturaId = candidaturaCriada.id
        situacao = existente
          ? 'candidatura_criada_candidato_existente'
          : 'candidato_criado'
      }
    }


    let vagaTitulo = tipo === 'banco_talentos' ? 'Banco de Talentos' : 'Vaga selecionada'

    if (tipo === 'vaga' && vagaId) {
      const { data: vagaInfo, error: vagaInfoError } = await supabase
        .from('vagas')
        .select('cargo')
        .eq('id', vagaId)
        .maybeSingle<{ cargo: string | null }>()

      if (vagaInfoError) {
        console.warn('Não foi possível buscar o título da vaga para o e-mail:', vagaInfoError.message)
      }

      vagaTitulo = vagaInfo?.cargo || vagaTitulo
    }

    const mensagem =
      situacao === 'ja_inscrito'
        ? 'Você já estava inscrito nesta vaga. Atualizamos seus dados e currículo para análise do RH.'
        : situacao === 'candidatura_criada_candidato_existente'
          ? 'Sua candidatura foi enviada com sucesso. Identificamos que você já tinha cadastro conosco e atualizamos sua participação para esta vaga.'
          : situacao === 'banco_talentos_atualizado'
            ? 'Seu currículo foi atualizado com sucesso no banco de talentos.'
            : tipo === 'banco_talentos'
              ? 'Currículo enviado com sucesso para o banco de talentos.'
              : 'Candidatura enviada com sucesso. Nossa equipe de RH analisará seu perfil.'


    let emailEnviado = false
    let emailErro: string | null = null

    try {
      await enviarConfirmacaoCandidatura({
        email,
        nomeCompleto,
        vagaTitulo,
        situacao,
      })

      emailEnviado = true
    } catch (emailError) {
      emailErro = emailError instanceof Error ? emailError.message : 'Erro inesperado ao enviar e-mail.'
      console.error('Candidatura registrada, mas o e-mail de confirmação não foi enviado:', emailErro)
    }

    return jsonResponse({
      ok: true,
      candidatoId,
      candidaturaId,
      situacao,
      mensagem,
      emailEnviado,
      emailErro,
    })
  } catch (error) {
    console.error(error)

    return jsonResponse(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : 'Erro inesperado ao registrar candidatura.',
      },
      500,
    )
  }
})
