# Atualização do D1 existente — sem perda de dados

## 1. Backup obrigatório

No painel Cloudflare, faça backup/exportação do banco `afit-database`, e preserve o bucket `afit-media`. Registre o nome e ID dos recursos atuais. Não altere o binding `DB` ou `MEDIA` para recursos vazios.

## 2. Migrar apenas o novo módulo

Execute no console do D1:

- `migrations/0005_PIX_MANUAL_BANCO_EXISTENTE.sql`
- `migrations/0006_INCLUIR_PLANO_TESTE_OPCIONAL.sql` **apenas** se quiser que um plano de teste apareça no D1 existente.

`0005` cria novas tabelas e configurações. Não altera nem exclui alunos, treinos e pagamentos antigos. Ele exige que as tabelas existentes `users`, `plans` e `consultation_requests` já estejam presentes (a versão AFIT 3.0 já as utiliza). Se o seu ambiente nunca executou `migrations/0003_student_experience.sql` ou `migrations/0004_consultations.sql`, primeiro verifique quais tabelas e colunas ainda faltam. **Não execute cegamente migrações antigas**, pois algumas repetem `ALTER TABLE` que pode já ter sido aplicado.

As novas tabelas são:
- `plan_pix_config`: chave Pix e beneficiário por plano;
- `plan_requests`: pedido do aluno, plano escolhido, comprovante e decisão;
- `student_plan_access`: plano autorizado e sua validade;
- `app_settings`: logo, fotos, títulos e Pix de consultoria;
- `consultation_manual_proofs`: anexos privados da consultoria;
- `admin_audit`: rastreabilidade das liberações.

O plano não é liberado automaticamente quando o usuário envia o comprovante.

## 3. Configurar administrador

Execute **de forma privada** `scripts/02_CONFIGURAR_LOGIN_WAGNER_EXECUTAR_UMA_VEZ.sql` no console D1 para aplicar o e-mail e a senha inicial solicitados. Esse arquivo altera apenas o primeiro administrador, sem apagar os alunos. Troque a senha imediatamente no painel; não publique o SQL em repositório aberto.

## 4. Preparar Cloudflare Pages

Build: `npm run build`. Output: `dist`. Bindings Pages Functions: `DB` (D1 atual), `MEDIA` (R2 atual). Secret: `JWT_SECRET` (use o já existente se quiser preservar sessões; recomenda-se rotacionar e exigir novo login para atualização importante). `SETUP_TOKEN` apenas para setup do primeiro admin, se necessário.

## 5. Validar e liberar

Acesse como administrador; cadastre Pix nos planos pagos. Use uma conta de aluno de teste, selecione e confirme um plano, envie comprovante e confirme que **sem aprovação** o treino continua bloqueado. Faça aprovação no painel e verifique a liberação. Valide também expiração, exercício, foto, PWA e arquivos privados.

## 6. Desconectar o Asaas

Esta versão não chama endpoints do Asaas nem mantém webhook para novas assinaturas. Não apague a tabela `payments` se ela contiver seu histórico. No site/painel do Asaas, revise cobranças recorrentes/webhooks antigos separadamente; remover o código não cancela cobranças já existentes.
