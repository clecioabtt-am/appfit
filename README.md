# Wagner Noronha Personal Trainer · AFIT 4.0

Aplicativo web responsivo (PWA) com Cloudflare Pages + Pages Functions, D1 e R2. **Sem integração Asaas para pagamentos novos.** Pagamento por **chave Pix própria**, com escolha de plano pelo aluno, comprovante privado e liberação exclusivamente manual pelo administrador.

## O que mudou

- Logomarca e fotografias enviadas pelo cliente, aplicadas à entrada, menus, painéis e ícones PWA.
- Layout preto/grafite com detalhes metálicos dourados/prateados, botões com profundidade e adaptações de celular.
- Configuração de **chave Pix por plano** (cópia disponível somente após a escolha confirmada).
- Aluno confirma o plano, gera uma solicitação associada à própria conta, anexa imagem/PDF e acompanha o status.
- Administrador seleciona o aluno pelo painel de solicitações, visualiza plano e comprovante, aprova ou rejeita. Somente a aprovação ativa a assinatura pela duração do plano (renovações estendem a validade quando já ativa).
- Comprovantes guardados em `R2/private/proofs`, acessíveis apenas em rotas autenticadas (aluno proprietário e administrador).
- Consultoria online avulsa continua com agendamento; pagamento também passa para Pix + envio de comprovante + aprovação manual.
- Personalização da **logo, foto de entrada e foto interna**, mais títulos e chave Pix da consultoria, pelo painel do Wagner.
- Cadastro e gerência de alunos, biblioteca de exercícios com vídeos, treino semanal individual, registros de conclusão, dicas e dietas.
- Recuperação de indicadores reais de treinos; removeu o progresso fictício de 52% do painel antigo.
- Banco antigo de `users`, `plans`, `exercises`, `tips`, `diet_items`, `workout_assignments`, `workout_completions`, `consultation_requests`, `consultation_slots` e `payments` preservado.

## IMPORTANTE — Antes de implantar

1. **Faça backup do D1 e do R2**. O pacote não foi implantado na sua conta Cloudflare nem testado com o banco de produção.
2. Para um D1 **já existente**, execute no console SQL do D1 **somente** `migrations/0005_PIX_MANUAL_BANCO_EXISTENTE.sql` (e `migrations/0006_INCLUIR_PLANO_TESTE_OPCIONAL.sql` caso deseje o teste grátis). **Não execute** `0001_INSTALACAO_NOVA.sql` num banco com usuários.
3. Para D1 **novo e vazio**, execute `0001_INSTALACAO_NOVA.sql` e, em seguida, `0005_PIX_MANUAL_BANCO_EXISTENTE.sql`. `0006` é opcional, pois o banco novo já inclui o teste.
4. Configure os bindings do projeto Cloudflare Pages: D1 **`DB`** → seu banco `afit-database`; R2 **`MEDIA`** → bucket `afit-media`. Mantenha seu identificador de banco atual. O arquivo opcional `wrangler.example.jsonc` tem `database_id` de exemplo; substitua pelo ID real ou gerencie os bindings pelo painel Cloudflare.
5. Configure o Secret **`JWT_SECRET`** com valor aleatório longo e privado. Para usar o assistente de criação de administrador, configure também **`SETUP_TOKEN`**. Não publique seus secrets. Não é necessário `ASAAS_API_KEY`, `ASAAS_ENV` ou `ASAAS_WEBHOOK_TOKEN`.
6. O arquivo `scripts/02_CONFIGURAR_LOGIN_WAGNER_EXECUTAR_UMA_VEZ.sql` permite definir o login solicitado pelo cliente em um banco existente ou novo. **Esse passo é manual e deliberado**, pois redefine a senha do administrador principal. Execute uma única vez e troque a senha no menu **Minha conta** antes de divulgar o endereço. **Nunca envie esse script a um repositório público**.
7. Implante o conteúdo na Cloudflare Pages. **Build:** `npm run build`; **Output:** `dist`; Framework: `None` ou Vite/React, conforme a interface Cloudflare. Na mesma conta, verifique se `Functions` estão ativas. O pacote contém `functions/api/[[path]].ts` e `functions/media/[[path]].ts`.
8. Abra a página, entre como administrador, acesse **Planos e Pix**, cadastre a chave Pix em cada plano pago e configure o Pix da consultoria em **Personalização**. Sem chave Pix no plano pago, a seleção será bloqueada para impedir o aluno de pagar para uma conta incorreta.

### Login inicial solicitado (requer executar script SQL de configuração)

- E-mail: `wagnernoronha@personal.com`
- Senha temporária: a senha que você forneceu na conversa, implementada como hash PBKDF2 no script acima.
- **Segurança:** para evitar expor uma credencial permanente em fonte pública, o aplicativo não tem senha padrão hardcoded no frontend. A senha definida no script deve ser trocada após o primeiro acesso.

## Fluxo de pagamento

1. O aluno cria conta e entra no aplicativo.
2. Seleciona e **confirma** um plano (salvo em `plan_requests` com status `AWAITING_PROOF`, valor e Pix daquele momento).
3. Copia a chave Pix, paga e envia comprovante de até 8 MB (JPEG, PNG, WebP ou PDF).
4. O pedido passa a `PROOF_SENT`, ficando visível ao personal.
5. O personal verifica **na própria conta Pix/banco** se o pagamento efetivamente entrou. O simples envio do comprovante **não prova pagamento**.
6. Em **Pedidos Pix**, o personal filtra pelo aluno, verifica o plano, abre o comprovante e clica em **Aprovar pagamento e liberar plano**.
7. O servidor só ativa `users.subscription_status='ACTIVE'` e calcula `subscription_until` após a aprovação; a concessão é registrada em `student_plan_access` e em `admin_audit`.
8. Em caso de rejeição, o aluno vê o motivo e pode escolher um plano novamente.

O Asaas deixou de ser chamado pelo frontend ou backend e não recebe novos pedidos. Tabelas históricas do Asaas podem permanecer no banco para preservar registros antigos. Para desativar cobranças/assinaturas externas ou webhooks já configurados na conta Asaas, faça isso **também no painel do Asaas**, pois o código novo não cancela cobranças anteriores no provedor.

## Treinos e conteúdo

- Administrador: `Exercícios` (cadastrar/editar/excluir, mídias em R2); `Treinos por aluno` (atribuição semanal); `Dietas` (vincular ao aluno por e-mail); `Dicas`; `Alunos`; `Consultorias`.
- Aluno com acesso ativo: `Exercícios` (filtrar, visualizar vídeo, instruções e descanso), `Meu treino` (dia atual), `Minha dieta`, `Dicas`, `Meu perfil`, `Planos`, `Consultoria`.
- `workout_completions` armazena conclusão por aluno/exercício/dia.
- `Consulta online`: horário oferecido pelo personal, aluno escolhe, Pix manual, comprovante, aprovação, link de Meet/Zoom, conclusão.

## PWA e imagens

- Ícones 192 e 512 em `public/icons`, manifesto em `public/manifest.webmanifest` e service worker `public/sw.js`.
- No iPhone: Safari → Compartilhar → Adicionar à Tela de Início. Android: Instalar aplicativo pelo Chrome.
- A marca é exibida em cabeçalhos e áreas independentes. A foto do Wagner ocupa a lateral da apresentação, sem logo sobre o rosto ou corpo.
- O cache do service worker **não armazena APIs autenticadas nem comprovantes**.

## Considerações de segurança e continuidade

- Pix é manual: confirme o pagamento no aplicativo do banco, nunca somente pelo PDF/foto.
- As fotos em `public/brand` são recursos públicos do site. Comprovantes em `private/proofs` são privados e só passam pela API autenticada.
- `scripts/02_CONFIGURAR_LOGIN_WAGNER_EXECUTAR_UMA_VEZ.sql` é confidencial durante a implantação; remova-o de qualquer repositório público.
- O frontend foi recriado com React/TypeScript e o backend usa as tabelas essenciais do AFIT 3.0; é necessário validar no seu ambiente D1/R2 antes de substituir a versão em produção.
- Para preservar cadastro e treinos, **não remova o banco antigo nem execute DROP TABLE**.

Veja também `docs/CHECKLIST_DE_TESTES.md` e `docs/ATUALIZACAO_D1.md`.
