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

function driveFileUrl(fileId: string, fileUrl: string | null | undefined) {
  return fileUrl || `https://drive.google.com/file/d/${fileId}/view`
}

function mergeObservacoes(previous: string | null | undefined, next: string | null) {
  const values = [previous?.trim(), next?.trim()].filter(Boolean)
  return values.join('\n\n---\n\n') || null
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

    return jsonResponse({
      ok: true,
      candidatoId,
      candidaturaId,
      situacao,
      mensagem,
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
