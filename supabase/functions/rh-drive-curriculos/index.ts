import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders, jsonResponse } from '../_shared/cors.ts'
import {
  createDriveFolder,
  getFolderUrl,
  getRequiredFolderId,
  moveDriveFile,
  safeDriveName,
  uploadDriveFile,
} from '../_shared/googleDrive.ts'

type Vaga = {
  id: string
  numero: number
  cargo: string
  setor: string
  drive_folder_id: string | null
  drive_folder_url: string | null
}

type Candidato = {
  id: string
  nome_completo: string
  curriculo_drive_file_id: string | null
  curriculo_drive_url: string | null
  curriculo_drive_nome: string | null
  curriculo_drive_folder_id: string | null
}

type Candidatura = {
  id: string
  candidato_id: string
  vaga_id: string
}

function supabaseAdmin() {
  return createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    { auth: { persistSession: false } },
  )
}

function extensionFromName(fileName: string) {
  const extension = fileName.split('.').pop()?.toLowerCase()
  return extension ? `.${extension}` : ''
}

async function ensureVagaFolder(
  supabase: ReturnType<typeof supabaseAdmin>,
  vagaId: string,
) {
  const { data: vaga, error } = await supabase
    .from('vagas')
    .select('id, numero, cargo, setor, drive_folder_id, drive_folder_url')
    .eq('id', vagaId)
    .single<Vaga>()

  if (error || !vaga) {
    throw new Error('Vaga não encontrada para salvar o currículo.')
  }

  if (vaga.drive_folder_id) {
    return {
      folderId: vaga.drive_folder_id,
      folderUrl: vaga.drive_folder_url ?? getFolderUrl(vaga.drive_folder_id),
    }
  }

  const rootFolderId = getRequiredFolderId('GOOGLE_DRIVE_VAGAS_FOLDER_ID')

  const folder = await createDriveFolder({
    name: safeDriveName(
      `VAG-${String(vaga.numero).padStart(6, '0')} - ${vaga.cargo} - ${vaga.setor}`,
    ),
    parentId: rootFolderId,
  })

  await supabase
    .from('vagas')
    .update({
      drive_folder_id: folder.id,
      drive_folder_url: folder.url,
    })
    .eq('id', vaga.id)

  return {
    folderId: folder.id,
    folderUrl: folder.url,
  }
}

async function uploadCurriculo(body: Record<string, unknown>) {
  const supabase = supabaseAdmin()

  const destino = String(body.destino ?? '')
  const vagaId = body.vagaId ? String(body.vagaId) : null

  const candidato = body.candidato as {
    nomeCompleto?: string
    email?: string
    whatsapp?: string
  } | null

  const arquivo = body.arquivo as {
    nome?: string
    tipo?: string
    base64?: string
  } | null

  if (!arquivo?.base64 || !arquivo?.nome) {
    throw new Error('Arquivo do currículo não informado.')
  }

  if (!candidato?.nomeCompleto) {
    throw new Error('Nome do candidato não informado.')
  }

  let folderId = ''
  let folderUrl: string | null = null

  if (destino === 'vaga') {
    if (!vagaId) {
      throw new Error('Vaga não informada para salvar o currículo.')
    }

    const folder = await ensureVagaFolder(supabase, vagaId)
    folderId = folder.folderId
    folderUrl = folder.folderUrl
  } else if (destino === 'banco_talentos') {
    folderId = getRequiredFolderId('GOOGLE_DRIVE_BANCO_TALENTOS_FOLDER_ID')
    folderUrl = getFolderUrl(folderId)
  } else {
    throw new Error('Destino do currículo inválido.')
  }

  const now = new Date().toISOString().slice(0, 10)

  const fileName = safeDriveName(
    `${now} - ${candidato.nomeCompleto}${extensionFromName(arquivo.nome)}`,
  )

  const uploaded = await uploadDriveFile({
    name: fileName,
    mimeType: arquivo.tipo ?? 'application/octet-stream',
    base64: arquivo.base64,
    parentId: folderId,
  })

  return jsonResponse({
    ok: true,
    fileId: uploaded.id,
    fileUrl: uploaded.url,
    fileName: uploaded.name,
    folderId,
    folderUrl,
  })
}

async function moverCurriculo(body: Record<string, unknown>) {
  const supabase = supabaseAdmin()

  const candidaturaId = String(body.candidaturaId ?? '')
  const destino = String(body.destino ?? '')

  if (!candidaturaId) {
    throw new Error('candidaturaId é obrigatório.')
  }

  const targetFolderId =
    destino === 'reprovados'
      ? getRequiredFolderId('GOOGLE_DRIVE_REPROVADOS_FOLDER_ID')
      : destino === 'banco_talentos'
        ? getRequiredFolderId('GOOGLE_DRIVE_BANCO_TALENTOS_FOLDER_ID')
        : ''

  if (!targetFolderId) {
    throw new Error('Destino para movimentação do currículo é inválido.')
  }

  const { data: candidatura, error: candidaturaError } = await supabase
    .from('candidaturas')
    .select('id, candidato_id, vaga_id')
    .eq('id', candidaturaId)
    .single<Candidatura>()

  if (candidaturaError || !candidatura) {
    throw new Error('Candidatura não encontrada.')
  }

  const { data: candidato, error: candidatoError } = await supabase
    .from('candidatos')
    .select(
      'id, nome_completo, curriculo_drive_file_id, curriculo_drive_url, curriculo_drive_nome, curriculo_drive_folder_id',
    )
    .eq('id', candidatura.candidato_id)
    .single<Candidato>()

  if (candidatoError || !candidato) {
    throw new Error('Candidato não encontrado.')
  }

  if (!candidato.curriculo_drive_file_id) {
    throw new Error(
      'Este candidato não possui currículo vinculado ao Google Drive.',
    )
  }

  const moved = await moveDriveFile({
    fileId: candidato.curriculo_drive_file_id,
    targetFolderId,
  })

  await supabase
    .from('candidatos')
    .update({
      curriculo_drive_folder_id: targetFolderId,
      curriculo_drive_url: moved.url ?? candidato.curriculo_drive_url,
      curriculo_drive_nome: moved.name ?? candidato.curriculo_drive_nome,
    })
    .eq('id', candidato.id)

  return jsonResponse({
    ok: true,
    fileId: moved.id,
    fileUrl: moved.url ?? candidato.curriculo_drive_url,
    fileName: moved.name ?? candidato.curriculo_drive_nome ?? 'curriculo',
    folderId: targetFolderId,
    folderUrl: getFolderUrl(targetFolderId),
  })
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const body = await request.json()
    const acao = String(body?.acao ?? '')

    if (acao === 'upload-curriculo') {
      return await uploadCurriculo(body)
    }

    if (acao === 'mover-curriculo') {
      return await moverCurriculo(body)
    }

    return jsonResponse({ ok: false, error: 'Ação inválida.' }, 400)
  } catch (error) {
    console.error(error)

    return jsonResponse(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : 'Erro inesperado ao processar currículo no Drive.',
      },
      500,
    )
  }
})