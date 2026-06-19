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


export type RegistroCandidaturaPublicaResult = {
  ok: true
  candidatoId: string
  candidaturaId: string | null
  situacao:
    | 'candidato_criado'
    | 'candidato_atualizado'
    | 'candidatura_criada_candidato_existente'
    | 'ja_inscrito'
    | 'banco_talentos_atualizado'
  mensagem: string
}

export async function registrarCandidaturaPublica(params: {
  tipo: 'vaga' | 'banco_talentos'
  vagaId: string | null
  candidato: {
    nomeCompleto: string
    email: string
    whatsapp: string
    cidade: string | null
    uf: string | null
  }
  curriculoDrive: DriveUploadResult
  observacoes: string | null
}) {
  const { data, error } = await supabase.functions.invoke<
    | RegistroCandidaturaPublicaResult
    | { ok: false; error: string }
  >('rh-candidatura-publica', {
    body: {
      acao: 'registrar-candidatura-publica',
      tipo: params.tipo,
      vagaId: params.vagaId,
      candidato: params.candidato,
      curriculoDrive: params.curriculoDrive,
      observacoes: params.observacoes,
    },
  })

  if (error) {
    throw new Error(
      await readFunctionError(
        error,
        'Não foi possível registrar a candidatura no sistema.',
      ),
    )
  }

  if (!data?.ok) {
    throw new Error(
      (data as { error?: string } | null)?.error ??
        'O sistema não confirmou o registro da candidatura.',
    )
  }

  return data
}

export async function enviarConfirmacaoCandidatura(params: {
  candidatoId: string
  vagaId: string | null
  tipo: 'vaga' | 'banco_talentos'
  email: string
}) {
  const { data, error } = await supabase.functions.invoke<
    | { ok: true; emailSent: boolean; message?: string }
    | { ok: false; error: string }
  >('rh-candidatura-confirmacao', {
    body: {
      acao: 'enviar-confirmacao',
      candidatoId: params.candidatoId,
      vagaId: params.vagaId,
      tipo: params.tipo,
      email: params.email,
    },
  })

  if (error) {
    throw new Error(
      await readFunctionError(
        error,
        'Não foi possível enviar o e-mail de confirmação ao candidato.',
      ),
    )
  }

  if (!data?.ok) {
    throw new Error(
      (data as { error?: string } | null)?.error ??
        'O e-mail de confirmação não foi enviado.',
    )
  }

  return data
}
