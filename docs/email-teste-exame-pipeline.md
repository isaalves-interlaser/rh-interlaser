# E-mail automático de teste e exame

Esta melhoria adiciona o envio de e-mail ao candidato quando o RH agenda teste prático ou exame admissional pela Pipeline.

## Arquivos alterados

- `src/components/Pipeline.tsx`
- `src/components/Pipeline.css`
- `supabase/functions/rh-processo-email/index.ts`

## Secrets usadas

A função usa as mesmas secrets do Gmail já usadas na documentação admissional:

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_REFRESH_TOKEN`
- `GOOGLE_SENDER_EMAIL`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

## Deploy da função

```bash
supabase functions deploy rh-processo-email
```

## Fluxo

1. RH arrasta o candidato para **Teste prático** ou **Exame admissional**.
2. O sistema abre o modal para informar data, horário, local e observações.
3. Ao confirmar, o sistema salva a etapa.
4. Em seguida, envia o e-mail ao candidato.
5. Se o e-mail falhar, a etapa continua salva e o sistema mostra o aviso.
