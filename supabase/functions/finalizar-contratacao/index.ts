import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

type RequestBody = {
  candidaturaId?: string
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

    if (!candidaturaId) {
      return json(
        { ok: false, error: 'Informe a candidatura.' },
        400,
      )
    }

    const { data: application, error: applicationError } =
      await admin
        .from('candidaturas')
        .select(
          'id, candidato_id, vaga_id, exame_status, etapa, status',
        )
        .eq('id', candidaturaId)
        .single()

    if (applicationError || !application) {
      return json(
        { ok: false, error: 'Candidatura não encontrada.' },
        404,
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

    const { data: candidature, error: updateError } = await admin
      .from('candidaturas')
      .update({
        etapa: 'contratado',
        status: 'contratado',
        proxima_acao: null,
        proxima_acao_em: null,
        observacoes:
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
      .update({ status: 'em_andamento' })
      .eq('candidatura_id', candidaturaId)

    return json({
      ok: true,
      message: 'Contratação finalizada e vaga fechada.',
      candidature,
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
