# AFIT — versão web PWA

Projeto web responsivo e instalável, pronto para GitHub e Cloudflare Pages.

## Recursos incluídos
- Layout preto e amarelo baseado na identidade AFIT
- Dashboard do aluno
- Planos mensal e trimestral
- Treinos e detalhes de exercícios
- Espaço para vídeo do personal
- Dieta, dicas, consultoria e perfil
- Navegação responsiva para desktop e celular
- PWA instalável no Android/iPhone
- Service Worker para cache básico/offline
- Sem framework e sem etapa de build

## Testar localmente
O Service Worker não funciona abrindo `index.html` diretamente. Execute um servidor local:

```bash
python -m http.server 8080
```

Acesse `http://localhost:8080`.

## Publicar no GitHub
1. Crie um repositório.
2. Envie todos os arquivos desta pasta para a raiz do repositório.

## Deploy no Cloudflare Pages
1. Acesse **Workers & Pages** no painel Cloudflare.
2. Clique em **Create** > **Pages** > **Connect to Git**.
3. Selecione o repositório.
4. Em **Framework preset**, escolha `None`.
5. Deixe **Build command** vazio.
6. Em **Build output directory**, use `/` ou deixe vazio conforme o painel permitir.
7. Faça o deploy.

## Instalação como aplicativo
- Android/Chrome: o botão “Instalar” usa o evento nativo `beforeinstallprompt`.
- iPhone/Safari: o sistema mostra instruções para “Adicionar à Tela de Início”.
- A instalação PWA exige HTTPS; o domínio `.pages.dev` já fornece HTTPS.

## Integrações futuras
- Cloudflare Workers: API e autenticação
- Cloudflare D1: alunos, treinos, dietas e assinaturas
- Cloudflare R2: vídeos e imagens
- Asaas/Mercado Pago: cobrança recorrente

## Observação
Os dados atuais são demonstrativos e ficam em `app.js`. Substitua-os por chamadas à API quando o backend estiver pronto.
