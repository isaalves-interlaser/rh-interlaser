import { create, getNumericDate } from 'https://deno.land/x/djwt@v3.0.2/mod.ts'

const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive'
const TOKEN_URL = 'https://oauth2.googleapis.com/token'
const DRIVE_API = 'https://www.googleapis.com/drive/v3'
const DRIVE_UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3'

function env(name: string) {
  const value = Deno.env.get(name)

  if (!value) {
    throw new Error(`Variável de ambiente não configurada: ${name}`)
  }

  return value
}

function normalizePrivateKey(value: string) {
  return value.replace(/\\n/g, '\n')
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

async function importPrivateKey(pem: string) {
  const normalized = normalizePrivateKey(pem)
    .replace('-----BEGIN PRIVATE KEY-----', '')
    .replace('-----END PRIVATE KEY-----', '')
    .replace(/\s/g, '')

  const keyData = base64ToUint8Array(normalized)

  return crypto.subtle.importKey(
    'pkcs8',
    keyData,
    {
      name: 'RSASSA-PKCS1-v1_5',
      hash: 'SHA-256',
    },
    false,
    ['sign'],
  )
}

async function getAccessToken() {
  const clientEmail = env('GOOGLE_SERVICE_ACCOUNT_EMAIL')
  const privateKey = env('GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY')
  const key = await importPrivateKey(privateKey)
  const now = Math.floor(Date.now() / 1000)

  const assertion = await create(
    { alg: 'RS256', typ: 'JWT' },
    {
      iss: clientEmail,
      scope: DRIVE_SCOPE,
      aud: TOKEN_URL,
      iat: now,
      exp: getNumericDate(3600),
    },
    key,
  )

  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  })

  const data = await response.json()

  if (!response.ok || !data.access_token) {
    throw new Error(
      data.error_description ??
        data.error ??
        'Não foi possível autenticar no Google Drive.',
    )
  }

  return String(data.access_token)
}

async function driveFetch(
  url: string,
  init: RequestInit = {},
) {
  const token = await getAccessToken()
  const headers = new Headers(init.headers)
  headers.set('Authorization', `Bearer ${token}`)

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
      typeof data === 'object' && data?.error?.message
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
  return env(name)
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
  const data = await driveFetch(
    `${DRIVE_API}/files?supportsAllDrives=true&fields=id,name,webViewLink`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: params.name,
        mimeType: 'application/vnd.google-apps.folder',
        parents: [params.parentId],
      }),
    },
  ) as { id: string; name: string; webViewLink?: string }

  return {
    id: data.id,
    name: data.name,
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
      `--${boundary}\r\nContent-Type: ${params.mimeType || 'application/octet-stream'}\r\n\r\n`,
    ),
    base64ToUint8Array(params.base64),
    stringToUint8Array(`\r\n--${boundary}--`),
  ])

  const data = await driveFetch(
    `${DRIVE_UPLOAD_API}/files?uploadType=multipart&supportsAllDrives=true&fields=id,name,webViewLink,parents`,
    {
      method: 'POST',
      headers: {
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body,
    },
  ) as {
    id: string
    name: string
    webViewLink?: string
    parents?: string[]
  }

  return {
    id: data.id,
    name: data.name,
    url: data.webViewLink ?? null,
    folderId: data.parents?.[0] ?? params.parentId,
  }
}

export async function moveDriveFile(params: {
  fileId: string
  targetFolderId: string
}) {
  const current = await driveFetch(
    `${DRIVE_API}/files/${params.fileId}?supportsAllDrives=true&fields=id,parents`,
  ) as { id: string; parents?: string[] }

  const removeParents = (current.parents ?? []).join(',')
  const search = new URLSearchParams({
    supportsAllDrives: 'true',
    addParents: params.targetFolderId,
    fields: 'id,name,webViewLink,parents',
  })

  if (removeParents) {
    search.set('removeParents', removeParents)
  }

  const data = await driveFetch(
    `${DRIVE_API}/files/${params.fileId}?${search.toString()}`,
    {
      method: 'PATCH',
    },
  ) as {
    id: string
    name: string
    webViewLink?: string
    parents?: string[]
  }

  return {
    id: data.id,
    name: data.name,
    url: data.webViewLink ?? null,
    folderId: data.parents?.[0] ?? params.targetFolderId,
  }
}