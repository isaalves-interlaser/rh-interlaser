import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders, jsonResponse } from '../_shared/cors.ts'
import {
  createDriveFolder,
  getFolderUrl,
  getRequiredFolderId,
  safeDriveName,
} from '../_shared/googleDrive.ts'

type Vaga = {
  id: string
  numero: number
  cargo: string
  setor: string
  drive_folder_id: string | null
  drive_folder_url: string | null
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const body = await request.json()

    if (body?.acao !== 'criar-pasta-vaga') {
      return jsonResponse({ ok: false, error: 'Ação inválida.' }, 400)
    }

    const vagaId = String(body?.vagaId ?? '')

    if (!vagaId) {
      return jsonResponse({ ok: false, error: 'vagaId é obrigatório.' }, 400)
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } },
    )

    const { data: vaga, error: vagaError } = await supabase
      .from('vagas')
      .select('id, numero, cargo, setor, drive_folder_id, drive_folder_url')
      .eq('id', vagaId)
      .single<Vaga>()

    if (vagaError || !vaga) {
      return jsonResponse(
        { ok: false, error: 'Vaga não encontrada.' },
        404,
      )
    }

    if (vaga.drive_folder_id) {
      return jsonResponse({
        ok: true,
        folderId: vaga.drive_folder_id,
        folderUrl: vaga.drive_folder_url ?? getFolderUrl(vaga.drive_folder_id),
        folderName: `VAG-${String(vaga.numero).padStart(6, '0')} - ${vaga.cargo}`,
      })
    }

    const rootFolderId = getRequiredFolderId('GOOGLE_DRIVE_VAGAS_FOLDER_ID')

    const folderName = safeDriveName(
      `VAG-${String(vaga.numero).padStart(6, '0')} - ${vaga.cargo} - ${vaga.setor}`,
    )

    const folder = await createDriveFolder({
      name: folderName,
      parentId: rootFolderId,
    })

    const { error: updateError } = await supabase
      .from('vagas')
      .update({
        drive_folder_id: folder.id,
        drive_folder_url: folder.url,
      })
      .eq('id', vaga.id)

    if (updateError) {
      return jsonResponse(
        {
          ok: false,
          error:
            'A pasta foi criada no Drive, mas não foi salva no cadastro da vaga.',
        },
        500,
      )
    }

    return jsonResponse({
      ok: true,
      folderId: folder.id,
      folderUrl: folder.url,
      folderName: folder.name,
    })
  } catch (error) {
    console.error(error)

    return jsonResponse(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : 'Erro inesperado ao criar pasta no Drive.',
      },
      500,
    )
  }
})