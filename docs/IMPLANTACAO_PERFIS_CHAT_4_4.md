# Wagner Noronha — Versão 4.4 — Fotos de perfil + chat de planos pagos

## O que mudou

- Aluno: **Meu perfil → Alterar minha foto**.
- Wagner (administrador): **Minha conta → Alterar minha foto**.
- Dr. Alison: **Configurações → Alterar imagem** (preservado).
- O avatar de cada perfil é exibido no cabeçalho. No chat, o aluno e o personal aparecem com **nome e foto próprios**.
- Chat privado entre Wagner e aluno com **plano pago vigente e aprovado manualmente após Pix**.
- Alunos no plano teste, aguardando pagamento ou com assinatura vencida **não acessam o chat**; essa regra é reavaliada pelo servidor em cada requisição, não apenas pela tela.
- Histórico de mensagens no D1, leitura, mensagens não lidas e recuperação de mensagens anteriores.
- Presença: verde = aplicativo em primeiro plano; laranja = aplicativo em segundo plano/fechado com login ainda válido; vermelho = logout ou sessão expirada. O estado pode demorar alguns segundos para refletir mudanças de abas, encerramentos abruptos e falhas de rede.

## Atualizar o site já implantado (4.3.2)

1. **Faça backup do banco D1 e dos arquivos importantes do R2**.
2. Confirme que a migração `0008_DOUTOR_FOTO_PERFIL.sql` da versão anterior foi aplicada. Se o login do Dr. Alison já mostra sua própria foto, provavelmente já está; caso contrário, confira a estrutura antes de repetir `ALTER TABLE`.
3. Execute **somente** `migrations/0009_CHAT_TEMPO_REAL_PERFIS.sql` no **D1 existente**. A migração cria duas tabelas (`chat_messages` e `chat_presence`) e seus índices; não apaga usuários, planos, comprovantes ou dietas.
4. Publique o conteúdo completo do ZIP pelo repositório GitHub conectado ao Cloudflare Pages. A compilação configurada é `npm run build`, saída `dist`.
5. Preserve os bindings **DB** (D1) e **MEDIA** (R2) e o segredo **JWT_SECRET**. Não altere as senhas existentes.
6. Atualize/feche/reabra o PWA após o deploy, se ele apresentar arquivos em cache.
7. Teste em duas sessões de navegador (uma Wagner e outra aluno), com o aluno tendo **um plano pago, aprovado e ainda válido**.

> Para uma instalação do zero, use primeiro o schema de instalação nova e as migrações requeridas pelo projeto, na ordem descrita no README. Não aplique `0001_INSTALACAO_NOVA.sql` sobre um banco com dados.

## Como testar o chat

1. Como aluno: escolha um plano pago, envie o comprovante pelo Pix e aguarde aprovação no painel do Wagner.
2. Quando o plano estiver ativo, abra **Chat com personal**. Aparece o nome e a foto do Wagner.
3. Como Wagner, abra **Chat com alunos** e selecione o aluno; aparecem nome, imagem de perfil e bolinha de presença.
4. Envie mensagens nos dois sentidos. As mensagens novas são verificadas aproximadamente a cada **2,5 segundos** enquanto a conversa está aberta. As conversas/presenças são atualizadas a cada **5 segundos** e as mensagens não lidas no menu a cada **12 segundos**.
5. Minimize a aba ou mude para outra janela: presença muda para laranja. Volte à aba: verde. Clique em **Sair da conta**: vermelho, salvo se outra sessão do mesmo usuário estiver ativa.
6. Um aluno em Plano Teste ou assinatura vencida deve visualizar o chat bloqueado e não pode enviar mensagens. O médico não tem acesso a esse canal.

## Observações operacionais

- O chat é **quase em tempo real, via consultas HTTP frequentes ao D1**. Não utiliza WebSocket; um envio pode levar alguns segundos para aparecer na outra tela. Para entrega instantânea de alto volume ou push com o aplicativo fechado, seria necessário adicionar uma infraestrutura de WebSockets/Durable Objects e notificações.
- As mensagens permanecem gravadas para leitura posterior, mesmo se uma das partes fechar o aplicativo. **Não há envio de notificação push** nesta versão.
- Presença laranja com app fechado só é confiável enquanto a sessão de login mantém validade; o navegador não fornece uma confirmação infalível de que foi fechado.
- A foto é armazenada no R2 em `public/avatars/<perfil>/<id>/`, com formato JPG/PNG/WEBP e limite de 4 MB. Os documentos médicos e comprovantes continuam em diretórios privados.
- Este chat é **para dúvidas sobre o treinamento com o personal** e não é um canal de prontuário ou atendimento médico. O perfil médico não visualiza essas mensagens.
