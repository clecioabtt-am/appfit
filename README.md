# AFIT 3.0 — Cloudflare Pages + Pages Functions

Plataforma responsiva e instalável (PWA) para musculação, funcional, dietas, dicas e assinaturas.

## Recursos Cloudflare já esperados

No projeto Pages `appfit`:

- Binding D1: `DB` → `afit-database`
- Binding R2: `MEDIA` → `afit-media`
- Variável: `ASAAS_ENV=sandbox`
- Secrets: `JWT_SECRET` e `SETUP_TOKEN`
- Posteriormente: `ASAAS_API_KEY` e `ASAAS_WEBHOOK_TOKEN`

## Deploy GitHub → Cloudflare Pages

- Framework preset: `None`
- Build command: `npm run build`
- Build output directory: `dist`
- Root directory: vazio

## Banco D1

Abra `migrations/0001_initial.sql`, copie o conteúdo e execute no Console do banco `afit-database`.

## Primeiro administrador

Depois do deploy e da migration, abra a página. Enquanto nenhum administrador existir, aparecerá a aba **Configurar ADM**.

Preencha:

- Nome
- E-mail
- Senha com pelo menos 8 caracteres
- O mesmo valor de `SETUP_TOKEN` configurado no Cloudflare

Após a criação, a aba desaparece e o administrador entra pela opção **Entrar**.

## PWA

- Android: o botão **Instalar** é exibido quando o Chrome libera o prompt.
- iPhone/iPad: a página orienta `Compartilhar → Adicionar à Tela de Início`.
- O projeto inclui manifesto, ícones e Service Worker.

## Uploads

Vídeos e imagens vão para o bucket R2 `afit-media`. O upload simples desta versão aceita arquivos de até 95 MB. Para vídeos maiores e streaming adaptativo, recomenda-se Cloudflare Stream ou upload direto multipart para R2.

## Asaas

O frontend cria a cobrança pela rota `/api/payments/checkout`. O webhook deverá apontar para:

`https://SEU-DOMINIO/api/asaas/webhook`

e enviar o token configurado em `ASAAS_WEBHOOK_TOKEN`.
