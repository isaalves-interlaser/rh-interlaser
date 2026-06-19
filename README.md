# RH Interlaser

Sistema de RH com área interna protegida por login e portal público de vagas.

## Rodar localmente

```bash
npm install
npm run dev
```

Acesse:

```txt
http://localhost:5173
```

Portal público:

```txt
http://localhost:5173/vagas
```

## Variáveis locais

Crie um arquivo `.env.local` baseado em `.env.example`:

```env
VITE_SUPABASE_URL=https://SEU_PROJETO.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=SUA_CHAVE_PUBLICA_ANON
```

## Google Drive

A integração do Drive roda pelas Supabase Edge Functions. As credenciais do Google não ficam no React.

Secrets necessárias no Supabase:

```txt
GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET
GOOGLE_REFRESH_TOKEN
GOOGLE_DRIVE_VAGAS_FOLDER_ID
GOOGLE_DRIVE_BANCO_TALENTOS_FOLDER_ID
GOOGLE_DRIVE_REPROVADOS_FOLDER_ID
```

Deploy das funções:

```bash
supabase functions deploy rh-drive-vagas
supabase functions deploy rh-drive-curriculos
```

## Banco de dados

Execute no Supabase SQL Editor:

```txt
docs/portal-vagas-fase1-supabase.sql
```

## Build

```bash
npm run build
```

Não envie para GitHub:

```txt
node_modules
dist
.env.local
supabase/.temp
```
