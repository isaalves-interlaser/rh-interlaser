import { supabase } from './supabase'

export type DriveUploadResult = {
  fileId: string
  fileUrl: string | null
  fileName: string
  folderId: string
  folderUrl: string | null
}

export type DriveFolderResult = {
  folderId: string
  folderUrl: string | null
  folderName: string
}

async function fileToBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = () => {
      const result = String(reader.result ?? '')
      const base64 = result.includes(',')
        ? result.split(',')[1]
        : result

      resolve(base64)
    }

    reader.onerror = () => {
      reject(new Error('Não foi possível ler o arquivo do currículo.'))
    }

    reader.readAsDataURL(file)
  })
}

async function readFunctionError(error: unknown, fallback: string) {
  const candidate = error as {
    message?: string
    context?: Response
  }

  if (candidate.context) {
    try {
      const body = await candidate.context.clone().json()
      if (body?.error) {
        return String(body.error)
      }
    } catch {
      // Mantém a mensagem padrão.
    }
  }

  return candidate.message ?? fallback
}


export async function criarPastaVagaDrive(vagaId: string) {
  const { data, error } = await supabase.functions.invoke<
    | ({ ok: true } & DriveFolderResult)
    | { ok: false; error: string }
  >('rh-drive-vagas', {
    body: {
      acao: 'criar-pasta-vaga',
      vagaId,
    },
  })

  if (error) {
    throw new Error(
      await readFunctionError(
        error,
        'Não foi possível criar a pasta da vaga no Google Drive.',
      ),
    )
  }

  if (!data?.ok) {
    throw new Error(
      (data as { error?: string } | null)?.error ??
        'O Google Drive não confirmou a criação da pasta da vaga.',
    )
  }

  return data
}

export async function enviarCurriculoParaDrive(params: {
  arquivo: File
  nomeCompleto: string
  email: string
  whatsapp: string
  vagaId: string | null
  destino: 'vaga' | 'banco_talentos'
}) {
  const base64 = await fileToBase64(params.arquivo)

  const { data, error } = await supabase.functions.invoke<
    | ({ ok: true } & DriveUploadResult)
    | { ok: false; error: string }
  >('rh-drive-curriculos', {
    body: {
      acao: 'upload-curriculo',
      destino: params.destino,
      vagaId: params.vagaId,
      candidato: {
        nomeCompleto: params.nomeCompleto,
        email: params.email,
        whatsapp: params.whatsapp,
      },
      arquivo: {
        nome: params.arquivo.name,
        tipo: params.arquivo.type || 'application/octet-stream',
        base64,
      },
    },
  })

  if (error) {
    throw new Error(
      await readFunctionError(
        error,
        'Não foi possível enviar o currículo para o Google Drive.',
      ),
    )
  }

  if (!data?.ok) {
    throw new Error(
      (data as { error?: string } | null)?.error ??
        'O Google Drive não confirmou o envio do currículo.',
    )
  }

  return data
}

export async function moverCurriculoDrive(params: {
  candidaturaId: string
  destino: 'reprovados' | 'banco_talentos'
}) {
  const { data, error } = await supabase.functions.invoke<
    | ({ ok: true } & DriveUploadResult)
    | { ok: false; error: string }
  >('rh-drive-curriculos', {
    body: {
      acao: 'mover-curriculo',
      candidaturaId: params.candidaturaId,
      destino: params.destino,
    },
  })

  if (error) {
    throw new Error(
      await readFunctionError(
        error,
        'Não foi possível mover o currículo no Google Drive.',
      ),
    )
  }

  if (!data?.ok) {
    throw new Error(
      (data as { error?: string } | null)?.error ??
        'O Google Drive não confirmou a movimentação do currículo.',
    )
  }

  return data
}
