import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

type RequestBody = {
  entrevistaId?: string
}

type GoogleTokenResponse = {
  access_token?: string
  error?: string
  error_description?: string
}

type GoogleEvent = {
  id?: string
  htmlLink?: string
  hangoutLink?: string
  conferenceData?: {
    entryPoints?: Array<{
      entryPointType?: string
      uri?: string
    }>
    createRequest?: {
      status?: {
        statusCode?: string
      }
    }
  }
  error?: {
    code?: number
    message?: string
    status?: string
  }
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

function meetLink(event: GoogleEvent) {
  if (event.hangoutLink) {
    return event.hangoutLink
  }

  return (
    event.conferenceData?.entryPoints?.find(
      (entry) => entry.entryPointType === 'video',
    )?.uri ?? null
  )
}

async function googleAccessToken() {
  const response = await fetch(
    'https://oauth2.googleapis.com/token',
    {
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
    },
  )

  const data = (await response.json()) as GoogleTokenResponse

  if (!response.ok || !data.access_token) {
    throw new Error(
      `Não foi possível autenticar no Google: ${
        data.error_description ??
        data.error ??
        `HTTP ${response.status}`
      }`,
    )
  }

  return data.access_token
}

async function loadGoogleEvent(
  accessToken: string,
  calendarId: string,
  eventId: string,
) {
  const response = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}?conferenceDataVersion=1`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  )

  const data = (await response.json()) as GoogleEvent

  if (!response.ok) {
    throw new Error(
      `Não foi possível consultar o evento no Google Agenda: ${
        data.error?.message ?? `HTTP ${response.status}`
      }`,
    )
  }

  return data
}

async function waitForMeetLink(
  accessToken: string,
  calendarId: string,
  event: GoogleEvent,
) {
  let current = event

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const link = meetLink(current)

    if (link) {
      return {
        event: current,
        link,
      }
    }

    if (!current.id) {
      break
    }

    await new Promise((resolve) => setTimeout(resolve, 750))
    current = await loadGoogleEvent(
      accessToken,
      calendarId,
      current.id,
    )
  }

  return {
    event: current,
    link: meetLink(current),
  }
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (request.method !== 'POST') {
    return json({ ok: false, error: 'Use o método POST.' }, 405)
  }

  let entrevistaId = ''

  const admin = createClient(
    secret('SUPABASE_URL'),
    secret('SUPABASE_SERVICE_ROLE_KEY'),
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  )

  try {
    const authorization = request.headers.get('Authorization')

    if (!authorization) {
      return json({ ok: false, error: 'Sessão não informada.' }, 401)
    }

    const userClient = createClient(
      secret('SUPABASE_URL'),
      secret('SUPABASE_ANON_KEY'),
      {
        global: {
          headers: {
            Authorization: authorization,
          },
        },
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      },
    )

    const {
      data: { user },
      error: userError,
    } = await userClient.auth.getUser()

    if (userError || !user) {
      return json({ ok: false, error: 'Sessão inválida.' }, 401)
    }

    const { data: profile, error: profileError } = await admin
      .from('profiles')
      .select('id, role, active')
      .eq('id', user.id)
      .single()

    if (
      profileError ||
      !profile?.active ||
      !['admin', 'rh'].includes(profile.role)
    ) {
      return json(
        {
          ok: false,
          error: 'Somente RH ou Administrador pode sincronizar entrevistas.',
        },
        403,
      )
    }

    const body = (await request.json()) as RequestBody
    entrevistaId = body.entrevistaId?.trim() ?? ''

    if (!entrevistaId) {
      return json(
        { ok: false, error: 'Informe a entrevista.' },
        400,
      )
    }

    const { data: interview, error: interviewError } = await admin
      .from('entrevistas')
      .select(
        'id, candidatura_id, tipo, inicio, fim, observacoes, gestor_nome, gestor_email, google_event_id, google_calendar_id',
      )
      .eq('id', entrevistaId)
      .single()

    if (interviewError || !interview) {
      return json(
        { ok: false, error: 'Entrevista não encontrada.' },
        404,
      )
    }

    const { data: application, error: applicationError } = await admin
      .from('candidaturas')
      .select('id, candidato_id, vaga_id')
      .eq('id', interview.candidatura_id)
      .single()

    if (applicationError || !application) {
      throw new Error('Candidatura da entrevista não encontrada.')
    }

    const [candidateResult, vacancyResult] = await Promise.all([
      admin
        .from('candidatos')
        .select('id, nome_completo, email')
        .eq('id', application.candidato_id)
        .single(),
      admin
        .from('vagas')
        .select('id, numero, cargo, setor')
        .eq('id', application.vaga_id)
        .single(),
    ])

    if (candidateResult.error || !candidateResult.data) {
      throw new Error('Candidato da entrevista não encontrado.')
    }

    if (vacancyResult.error || !vacancyResult.data) {
      throw new Error('Vaga da entrevista não encontrada.')
    }

    const candidate = candidateResult.data
    const vacancy = vacancyResult.data

    if (!candidate.email?.trim()) {
      throw new Error(
        'O candidato não possui e-mail cadastrado para receber o convite.',
      )
    }

    if (
      interview.tipo === 'gestor' &&
      (!interview.gestor_nome?.trim() ||
        !interview.gestor_email?.trim())
    ) {
      throw new Error(
        'Informe o nome e o e-mail do gestor antes de criar o convite.',
      )
    }

    const accessToken = await googleAccessToken()
    const calendarId = secret('GOOGLE_CALENDAR_ID')
    const timezone =
      Deno.env.get('GOOGLE_CALENDAR_TIMEZONE')?.trim() ||
      'America/Sao_Paulo'

    const typeLabel =
      interview.tipo === 'gestor'
        ? 'Entrevista com gestor'
        : 'Entrevista RH'

    const eventPayload = {
      summary: `${typeLabel} — ${candidate.nome_completo}`,
      description: [
        `Candidato: ${candidate.nome_completo}`,
        `Vaga: VAG-${String(vacancy.numero).padStart(6, '0')} — ${vacancy.cargo}`,
        `Setor: ${vacancy.setor}`,
        interview.tipo === 'gestor' && interview.gestor_nome
          ? `Gestor: ${interview.gestor_nome}`
          : '',
        interview.observacoes
          ? `Observações: ${interview.observacoes}`
          : '',
      ]
        .filter(Boolean)
        .join('\n'),
      start: {
        dateTime: interview.inicio,
        timeZone: timezone,
      },
      end: {
        dateTime: interview.fim,
        timeZone: timezone,
      },
      attendees: [
        {
          email: candidate.email.trim().toLowerCase(),
          displayName: candidate.nome_completo,
        },
        ...(interview.tipo === 'gestor' &&
        interview.gestor_email?.trim()
          ? [
              {
                email: interview.gestor_email
                  .trim()
                  .toLowerCase(),
                displayName:
                  interview.gestor_nome?.trim() ||
                  'Gestor',
              },
            ]
          : []),
      ],
      conferenceData: interview.google_event_id
        ? undefined
        : {
            createRequest: {
              requestId: crypto.randomUUID(),
              conferenceSolutionKey: {
                type: 'hangoutsMeet',
              },
            },
          },
    }

    const eventId = interview.google_event_id as string | null
    const method = eventId ? 'PATCH' : 'POST'
    const eventUrl = eventId
      ? `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}?conferenceDataVersion=1&sendUpdates=all`
      : `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?conferenceDataVersion=1&sendUpdates=all`

    await admin
      .from('entrevistas')
      .update({
        google_sync_status: 'sincronizando',
        google_sync_error: null,
      })
      .eq('id', entrevistaId)

    const googleResponse = await fetch(eventUrl, {
      method,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json; charset=utf-8',
      },
      body: JSON.stringify(eventPayload),
    })

    const googleData = (await googleResponse.json()) as GoogleEvent

    if (!googleResponse.ok || !googleData.id) {
      throw new Error(
        `Google Agenda recusou o evento: ${
          googleData.error?.message ??
          `HTTP ${googleResponse.status}`
        }`,
      )
    }

    const meetResult = await waitForMeetLink(
      accessToken,
      calendarId,
      googleData,
    )

    if (!meetResult.link) {
      if (!eventId && googleData.id) {
        await fetch(
          `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(googleData.id)}?sendUpdates=none`,
          {
            method: 'DELETE',
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          },
        )
      }

      throw new Error(
        'O evento foi processado, mas o Google Meet não foi gerado.',
      )
    }

    const { error: updateError } = await admin
      .from('entrevistas')
      .update({
        modalidade: 'google_meet',
        local: null,
        link_reuniao: meetResult.link,
        google_event_id: meetResult.event.id,
        google_calendar_id: calendarId,
        google_event_link: meetResult.event.htmlLink ?? null,
        google_sync_status: 'sincronizado',
        google_sync_error: null,
        google_synced_at: new Date().toISOString(),
      })
      .eq('id', entrevistaId)

    if (updateError) {
      if (!eventId && meetResult.event.id) {
        await fetch(
          `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(meetResult.event.id)}?sendUpdates=all`,
          {
            method: 'DELETE',
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          },
        )
      }

      throw new Error(
        `O evento foi criado, mas não foi possível gravar a sincronização: ${updateError.message}`,
      )
    }

    return json({
      ok: true,
      message: eventId
        ? 'Evento e Google Meet atualizados.'
        : 'Evento, Google Meet e convite criados.',
      eventId: meetResult.event.id,
      eventLink: meetResult.event.htmlLink ?? null,
      meetLink: meetResult.link,
      recipient: candidate.email,
    })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Erro desconhecido.'

    console.error('Erro ao sincronizar entrevista:', error)

    if (entrevistaId) {
      await admin
        .from('entrevistas')
        .update({
          google_sync_status: 'erro',
          google_sync_error: message,
        })
        .eq('id', entrevistaId)
    }

    return json(
      {
        ok: false,
        error: message,
      },
      500,
    )
  }
})
