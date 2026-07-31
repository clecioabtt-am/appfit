# Integração Asaas — Sandbox

1. Crie uma conta em Sandbox e gere a chave em **Integrações → Chaves de API**.
2. Nunca coloque a chave no GitHub. No Cloudflare, use **Settings → Variables and Secrets**:
   - `ASAAS_API_KEY` (Secret)
   - `ASAAS_WEBHOOK_TOKEN` (Secret)
   - `JWT_SECRET` (Secret)
   - `SETUP_TOKEN` (Secret)
3. Defina `ASAAS_ENV=sandbox` durante os testes.
4. No Asaas Sandbox, configure o webhook:
   - URL: `https://SEU-DOMINIO/api/asaas/webhook`
   - Token de autenticação: o mesmo valor de `ASAAS_WEBHOOK_TOKEN`
   - Eventos: `PAYMENT_RECEIVED`, `PAYMENT_CONFIRMED`, `PAYMENT_UPDATED`, `PAYMENT_OVERDUE`, `PAYMENT_REFUNDED`.
5. O sistema cria o cliente no Asaas, gera uma cobrança `UNDEFINED` (o cliente escolhe Pix, boleto ou cartão), abre `invoiceUrl` e aguarda o webhook.
6. Somente o webhook libera o plano. Não libere acesso com base apenas no redirecionamento do navegador.

## Produção
Troque `ASAAS_ENV` para `production`, substitua a chave pela chave de produção e revise URL/token do webhook.
