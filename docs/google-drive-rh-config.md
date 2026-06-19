# Configuração do Google Drive para o RH

Esta versão salva os currículos no Google Drive usando o mesmo padrão OAuth já usado na documentação admissional.

## Estrutura recomendada no Drive

Crie ou use uma pasta compartilhada assim:

```txt
Currículos
├── Vagas
├── Banco de Talentos
└── Reprovados

Documentação Admissional
```

A pasta `Vagas` será usada como raiz para as pastas criadas automaticamente quando uma vaga for cadastrada.

## Secrets necessárias no Supabase

Em **Supabase > Edge Functions > Secrets**, mantenha as secrets que já existem na documentação admissional:

```txt
GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET
GOOGLE_REFRESH_TOKEN
```

Adicione também estas 3 secrets novas com os IDs das pastas do Drive:

```txt
GOOGLE_DRIVE_VAGAS_FOLDER_ID=ID_DA_PASTA_VAGAS
GOOGLE_DRIVE_BANCO_TALENTOS_FOLDER_ID=ID_DA_PASTA_BANCO_DE_TALENTOS
GOOGLE_DRIVE_REPROVADOS_FOLDER_ID=ID_DA_PASTA_REPROVADOS
```

O Supabase já disponibiliza normalmente para Edge Functions:

```txt
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
```

## Deploy das Edge Functions

Na raiz do projeto, com a CLI do Supabase logada e linkada:

```bash
supabase functions deploy rh-drive-vagas
supabase functions deploy rh-drive-curriculos
```

## Fluxo implementado

1. RH cria uma vaga no sistema interno.
2. A função `rh-drive-vagas` cria uma pasta no Drive dentro de `Currículos/Vagas`.
3. O ID/link da pasta ficam gravados na tabela `vagas`.
4. O candidato acessa `/vagas`, escolhe uma vaga e envia o currículo.
5. O currículo é salvo na pasta da vaga no Google Drive.
6. Se o candidato enviar currículo espontâneo, o arquivo vai para `Banco de Talentos`.
7. Se o RH marcar como `Reprovado`, a função move o currículo para `Reprovados`.
8. Se o RH marcar como `Banco de talentos`, a função move para `Banco de Talentos`.

## Observação

Não coloque credenciais do Google no `.env.local` do React. As credenciais ficam apenas em **Supabase Edge Functions > Secrets**.
