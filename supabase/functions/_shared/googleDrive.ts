type GoogleTokenResponse = {
  access_token?: string
  error?: string
  error_description?: string
}

type DriveFile = {
  id?: string
  name?: string
  webViewLink?: string
  parents?: string[]
  error?: {
    message?: string
  }
}

const DRIVE_API = 'https://www.googleapis.com/drive/v3'
const DRIVE_UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3'

function secret(name: string) {
  const value = Deno.env.get(name)?.trim()

  if (!value) {
    throw new Error(`Secret ausente: ${name}`)
  }

  return value
}

function base64ToUint8Array(base64: string) {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }

  return bytes
}

function stringToUint8Array(value: string) {
  return new TextEncoder().encode(value)
}

function concatBytes(parts: Uint8Array[]) {
  const total = parts.reduce((sum, part) => sum + part.length, 0)
  const output = new Uint8Array(total)

  let offset = 0

  for (const part of parts) {
    output.set(part, offset)
    offset += part.length
  }

  return output
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

async function driveFetch(url: string, init: RequestInit = {}) {
  const accessToken = await googleAccessToken()

  const headers = new Headers(init.headers)
  headers.set('Authorization', `Bearer ${accessToken}`)

  const response = await fetch(url, {
    ...init,
    headers,
  })

  const contentType = response.headers.get('content-type') ?? ''

  const data = contentType.includes('application/json')
    ? await response.json()
    : await response.text()

  if (!response.ok) {
    const message =
      typeof data === 'object' &&
      data !== null &&
      'error' in data &&
      typeof data.error === 'object' &&
      data.error !== null &&
      'message' in data.error
        ? String(data.error.message)
        : typeof data === 'string'
          ? data
          : 'Erro ao comunicar com o Google Drive.'

    throw new Error(message)
  }

  return data
}

export function getFolderUrl(folderId: string) {
  return `https://drive.google.com/drive/folders/${folderId}`
}

export function getRequiredFolderId(name: string) {
  return secret(name)
}

export function safeDriveName(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 160)
}

export async function createDriveFolder(params: {
  name: string
  parentId: string
}) {
  const data = (await driveFetch(
    `${DRIVE_API}/files?supportsAllDrives=true&fields=id,name,webViewLink`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
      },
      body: JSON.stringify({
        name: params.name,
        mimeType: 'application/vnd.google-apps.folder',
        parents: [params.parentId],
      }),
    },
  )) as DriveFile

  if (!data.id) {
    throw new Error('O Google Drive não retornou o ID da pasta criada.')
  }

  return {
    id: data.id,
    name: data.name ?? params.name,
    url: data.webViewLink ?? getFolderUrl(data.id),
  }
}

export async function uploadDriveFile(params: {
  name: string
  mimeType: string
  base64: string
  parentId: string
}) {
  const boundary = `rh_drive_${crypto.randomUUID()}`

  const metadata = JSON.stringify({
    name: params.name,
    parents: [params.parentId],
  })

  const body = concatBytes([
    stringToUint8Array(
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n`,
    ),
    stringToUint8Array(
      `--${boundary}\r\nContent-Type: ${
        params.mimeType || 'application/octet-stream'
      }\r\n\r\n`,
    ),
    base64ToUint8Array(params.base64),
    stringToUint8Array(`\r\n--${boundary}--`),
  ])

  const data = (await driveFetch(
    `${DRIVE_UPLOAD_API}/files?uploadType=multipart&supportsAllDrives=true&fields=id,name,webViewLink,parents`,
    {
      method: 'POST',
      headers: {
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body,
    },
  )) as DriveFile

  if (!data.id) {
    throw new Error('O Google Drive não retornou o ID do currículo enviado.')
  }

  return {
    id: data.id,
    name: data.name ?? params.name,
    url: data.webViewLink ?? null,
    folderId: data.parents?.[0] ?? params.parentId,
  }
}

export async function moveDriveFile(params: {
  fileId: string
  targetFolderId: string
}) {
  const current = (await driveFetch(
    `${DRIVE_API}/files/${params.fileId}?supportsAllDrives=true&fields=id,parents`,
  )) as DriveFile

  const removeParents = (current.parents ?? []).join(',')

  const search = new URLSearchParams({
    supportsAllDrives: 'true',
    addParents: params.targetFolderId,
    fields: 'id,name,webViewLink,parents',
  })

  if (removeParents) {
    search.set('removeParents', removeParents)
  }

  const data = (await driveFetch(
    `${DRIVE_API}/files/${params.fileId}?${search.toString()}`,
    {
      method: 'PATCH',
    },
  )) as DriveFile

  if (!data.id) {
    throw new Error('O Google Drive não retornou o ID do arquivo movido.')
  }

  return {
    id: data.id,
    name: data.name ?? 'curriculo',
    url: data.webViewLink ?? null,
    folderId: data.parents?.[0] ?? params.targetFolderId,
  }
}