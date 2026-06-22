import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

type RequestBody = {
  candidaturaId?: string
  dataInicio?: string
  horarioInicio?: string
  localApresentacao?: string
  responsavelApresentacao?: string | null
  observacoes?: string | null
  enviarEmail?: boolean
  criarExperiencia?: boolean
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

function optionalText(value: string | null | undefined) {
  const normalized = value?.trim() ?? ''
  return normalized || null
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

function normalizeTime(value: string | undefined) {
  if (!value || !/^\d{2}:\d{2}$/.test(value)) {
    throw new Error('Informe o horário de apresentação.')
  }

  return value
}

function addDays(value: string, days: number) {
  const date = new Date(`${value}T12:00:00-03:00`)
  date.setDate(date.getDate() + days)

  return date.toISOString().slice(0, 10)
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('pt-BR').format(
    new Date(`${value}T12:00:00-03:00`),
  )
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
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

  return String(data.access_token)
}

async function sendHiringConfirmationEmail(args: {
  accessToken: string
  recipient: string
  candidateName: string
  vacancyName: string
  startDate: string
  startTime: string
  location: string
  responsible: string | null
  notes: string | null
}) {
  const sender = secret('GOOGLE_SENDER_EMAIL')
  const responsible = args.responsible
    ? `<p>Ao chegar, procure: <strong>${escapeHtml(args.responsible)}</strong>.</p>`
    : ''
  const notes = args.notes
    ? `<p><strong>Observações para o primeiro dia:</strong><br>${escapeHtml(args.notes).replaceAll('\n', '<br>')}</p>`
    : ''

  const html = `
    <div style="font-family:Arial,sans-serif;color:#172033;line-height:1.6;max-width:620px;margin:auto">
      <h2 style="color:#185fa5">Confirmação de contratação</h2>
      <p>Olá, <strong>${escapeHtml(args.candidateName)}</strong>.</p>
      <p>Temos o prazer de informar que você foi selecionado(a) para a vaga de <strong>${escapeHtml(args.vacancyName)}</strong>.</p>
      <p>Sua data de início está prevista para:</p>
      <div style="background:#f8fafc;border:1px solid #dfe6ee;border-radius:10px;padding:14px 16px;margin:18px 0">
        <p style="margin:0"><strong>Data:</strong> ${formatDate(args.startDate)}</p>
        <p style="margin:6px 0 0"><strong>Horário:</strong> ${escapeHtml(args.startTime)}</p>
        <p style="margin:6px 0 0"><strong>Local:</strong> ${escapeHtml(args.location)}</p>
      </div>
      ${responsible}
      ${notes}
      <p>No primeiro dia, compareça com documento pessoal e procure o RH.</p>
      <p>Atenciosamente,<br><strong>Recursos Humanos — Interlaser Máquinas</strong></p>
    </div>
  `.trim()

  const raw = [
    `From: RH Interlaser <${sender}>`,
    `To: ${args.recipient}`,
    `Subject: ${mimeHeader('Confirmação de contratação — Interlaser')}`,
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
    const userClient = createClient(
      supabaseUrl,
      secret('SUPABASE_ANON_KEY'),
    )
    const admin = createClient(
      supabaseUrl,
      secret('SUPABASE_SERVICE_ROLE_KEY'),
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      },
    )

    const { data: userData, error: userError } =
      await userClient.auth.getUser(token)

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
      !['admin', 'rh'].includes(actor.role)
    ) {
      return json(
        {
          ok: false,
          error:
            'Somente Recursos Humanos ou Administrador pode finalizar a contratação.',
        },
        403,
      )
    }

    const body = (await request.json()) as RequestBody
    const candidaturaId = body.candidaturaId?.trim()
    const dataInicio = normalizeDate(
      body.dataInicio,
      'a data de início do colaborador',
    )
    const horarioInicio = normalizeTime(body.horarioInicio)
    const localApresentacao = optionalText(body.localApresentacao)
    const responsavelApresentacao = optionalText(
      body.responsavelApresentacao,
    )
    const observacoes = optionalText(body.observacoes)
    const enviarEmail = body.enviarEmail !== false
    const criarExperiencia = body.criarExperiencia !== false

    if (!candidaturaId) {
      return json(
        { ok: false, error: 'Informe a candidatura.' },
        400,
      )
    }

    if (!localApresentacao) {
      return json(
        { ok: false, error: 'Informe o local de apresentação.' },
        400,
      )
    }

    const { data: application, error: applicationError } =
      await admin
        .from('candidaturas')
        .select(
          'id, candidato_id, vaga_id, exame_status, etapa, status, responsavel_id',
        )
        .eq('id', candidaturaId)
        .single()

    if (applicationError || !application) {
      return json(
        { ok: false, error: 'Candidatura não encontrada.' },
        404,
      )
    }

    const [candidateResult, vacancyResult] = await Promise.all([
      admin
        .from('candidatos')
        .select('id, nome_completo, email')
        .eq('id', application.candidato_id)
        .single(),
      admin
        .from('vagas')
        .select(
          'id, cargo, setor, empresa_id, filial_id, tipo_contrato',
        )
        .eq('id', application.vaga_id)
        .single(),
    ])

    if (candidateResult.error || !candidateResult.data) {
      throw new Error('Candidato não encontrado.')
    }

    if (vacancyResult.error || !vacancyResult.data) {
      throw new Error('Vaga não encontrada.')
    }

    const candidate = candidateResult.data
    const vacancy = vacancyResult.data

    if (enviarEmail && !candidate.email) {
      return json(
        {
          ok: false,
          error:
            'O candidato não possui e-mail cadastrado. Desmarque o envio ou atualize o cadastro.',
        },
        409,
      )
    }

    const { data: solicitation, error: solicitationError } =
      await admin
        .from('solicitacoes_documentos')
        .select('id, status')
        .eq('candidatura_id', candidaturaId)
        .maybeSingle()

    if (solicitationError) {
      throw new Error(
        `Não foi possível verificar a documentação: ${solicitationError.message}`,
      )
    }

    if (!solicitation || solicitation.status !== 'concluida') {
      return json(
        {
          ok: false,
          error:
            'A contratação só pode ser finalizada depois que todos os documentos forem recebidos.',
        },
        409,
      )
    }

    if (application.exame_status !== 'apto') {
      return json(
        {
          ok: false,
          error:
            'Marque o exame admissional como Apto antes de finalizar a contratação.',
        },
        409,
      )
    }

    const contractPayload = {
      candidatura_id: candidaturaId,
      candidato_id: application.candidato_id,
      vaga_id: application.vaga_id,
      empresa_id: vacancy.empresa_id,
      filial_id: vacancy.filial_id,
      status: 'ativo',
      data_admissao: dataInicio,
      tipo_contrato: vacancy.tipo_contrato ?? 'clt',
      cargo: vacancy.cargo,
      setor: vacancy.setor,
      contratacao_horario_apresentacao: horarioInicio,
      contratacao_local_apresentacao: localApresentacao,
      contratacao_responsavel_apresentacao: responsavelApresentacao,
      observacoes:
        observacoes ??
        'Contrato criado automaticamente pela finalização da contratação.',
      experiencia_status: criarExperiencia ? 'adaptacao_14' : 'nao_iniciado',
      experiencia_inicio: criarExperiencia ? dataInicio : null,
      adaptacao_14_data: criarExperiencia ? addDays(dataInicio, 14) : null,
      adaptacao_14_status: criarExperiencia ? 'aguardando' : 'aguardando',
      experiencia_44_data: criarExperiencia ? addDays(dataInicio, 44) : null,
      experiencia_44_status: criarExperiencia ? 'aguardando' : 'aguardando',
      avaliacao_anual_data: criarExperiencia ? addDays(dataInicio, 365) : null,
      avaliacao_anual_status: criarExperiencia ? 'aguardando' : 'aguardando',
      contratacao_email_ultimo_erro: null,
    }

    const { data: existingContract, error: existingContractError } =
      await admin
        .from('contratos')
        .select('id, contratacao_email_enviado_em')
        .eq('candidatura_id', candidaturaId)
        .maybeSingle()

    if (existingContractError) {
      throw new Error(
        `Não foi possível verificar contrato existente: ${existingContractError.message}`,
      )
    }

    const contractResult = existingContract
      ? await admin
          .from('contratos')
          .update(contractPayload)
          .eq('id', existingContract.id)
          .select('id')
          .single()
      : await admin
          .from('contratos')
          .insert(contractPayload)
          .select('id')
          .single()

    if (contractResult.error || !contractResult.data) {
      throw new Error(
        `Não foi possível criar/atualizar o contrato: ${
          contractResult.error?.message ?? 'sem retorno'
        }`,
      )
    }

    const { data: candidature, error: updateError } = await admin
      .from('candidaturas')
      .update({
        etapa: 'contratado',
        status: 'contratado',
        proxima_acao: 'Início do colaborador',
        proxima_acao_em: `${dataInicio}T${horarioInicio}:00-03:00`,
        observacoes:
          observacoes ??
          'Contratação finalizada após documentação concluída e exame admissional apto.',
      })
      .eq('id', candidaturaId)
      .select(
        'id, candidato_id, vaga_id, etapa, status, responsavel_id, data_entrada, proxima_acao, proxima_acao_em, motivo_reprovacao, parecer_final, observacoes, teste_inicio, teste_local, exame_inicio, exame_local, exame_status, created_at, updated_at',
      )
      .single()

    if (updateError || !candidature) {
      throw new Error(
        `Não foi possível finalizar a candidatura: ${
          updateError?.message ?? 'sem retorno'
        }`,
      )
    }

    const { error: vacancyError } = await admin
      .from('vagas')
      .update({ status: 'preenchida' })
      .eq('id', application.vaga_id)

    if (vacancyError) {
      throw new Error(
        `A candidatura foi contratada, mas a vaga não pôde ser fechada: ${vacancyError.message}`,
      )
    }

    await admin
      .from('onboardings')
      .update({
        status: 'em_andamento',
        data_prevista_inicio: dataInicio,
        data_admissao: dataInicio,
      })
      .eq('candidatura_id', candidaturaId)

    let emailEnviado = false
    let emailErro: string | null = null

    if (enviarEmail && candidate.email) {
      try {
        const accessToken = await googleAccessToken()
        await sendHiringConfirmationEmail({
          accessToken,
          recipient: candidate.email,
          candidateName: candidate.nome_completo,
          vacancyName: vacancy.cargo,
          startDate: dataInicio,
          startTime: horarioInicio,
          location: localApresentacao,
          responsible: responsavelApresentacao,
          notes: observacoes,
        })

        emailEnviado = true
        await admin
          .from('contratos')
          .update({
            contratacao_email_enviado_em: new Date().toISOString(),
            contratacao_email_ultimo_erro: null,
          })
          .eq('id', contractResult.data.id)
      } catch (error) {
        emailErro =
          error instanceof Error
            ? error.message
            : 'Não foi possível enviar o e-mail de contratação.'

        await admin
          .from('contratos')
          .update({ contratacao_email_ultimo_erro: emailErro })
          .eq('id', contractResult.data.id)
      }
    }

    const message = emailErro
      ? 'Contratação finalizada, contrato criado e experiência iniciada. Atenção: o e-mail não foi enviado.'
      : emailEnviado
        ? 'Contratação finalizada, contrato criado, experiência iniciada e e-mail enviado ao candidato.'
        : 'Contratação finalizada, contrato criado e experiência iniciada.'

    return json({
      ok: true,
      message,
      candidature,
      contractId: contractResult.data.id,
      emailEnviado,
      emailErro,
    })
  } catch (error) {
    console.error('Erro em finalizar-contratacao:', error)

    return json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : 'Não foi possível finalizar a contratação.',
      },
      400,
    )
  }
})
