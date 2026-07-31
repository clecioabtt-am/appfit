# AFIT — Plataforma Cloudflare: musculação e funcional

Projeto React + Vite + Cloudflare Worker, D1, R2 e integração inicial com Asaas.

## Atualizações desta versão

- Cadastro de musculação, funcional e outras modalidades
- Vídeo do personal e imagem de capa
- Descrição, objetivo, como executar, benefícios e erros comuns
- Equipamentos, nível, séries, repetições, duração, descanso e tags
- Exercícios executados por repetições, tempo ou distância
- Busca e filtros por modalidade para o aluno
- Layout mobile-first e PWA instalável
- Migration `0002_functional_training.sql` para atualizar bancos existentes

## Preparação

```bash
npm install
npx wrangler login
npx wrangler d1 create afit-database
npx wrangler r2 bucket create afit-media
```

Copie o `database_id` para `wrangler.jsonc`.

## Banco

```bash
npm run db:remote
```

## Secrets

```bash
npx wrangler secret put JWT_SECRET
npx wrangler secret put SETUP_TOKEN
npx wrangler secret put ASAAS_API_KEY
npx wrangler secret put ASAAS_WEBHOOK_TOKEN
```

Mantenha `ASAAS_ENV` como `sandbox` durante os testes.

## Deploy

```bash
npm run deploy
```

O administrador alimenta os exercícios dentro da opção **Exercícios**. Os vídeos e imagens vão para o R2 e os demais dados para o D1.
