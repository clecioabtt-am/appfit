# Atualização 4.3 — Guia rápido para o D1 existente

## Não apague os alunos atuais
A migração a executar em uma instalação 4.2 é `migrations/0007_PARCEIRA_SAUDE_DR_ALISON_D1.sql`. Não execute a migração de instalação nova `0001` em D1 já utilizado. Faça backup/exportação prévia antes de atualizar.

## O que o SQL 0007 cria
- `doctor_accounts`: conta exclusiva do Dr. Alison, criada com senha inicial armazenada como hash PBKDF2.
- `doctor_public_info`: WhatsApp, CRM, desconto e links públicos.
- `doctor_patient_links`: autorização individual por aluno e revogação.
- `medical_food_plans`: documentos estruturados por paciente/médico, com estado de rascunho/publicado, versões e referência ao PDF privado no R2.

As tabelas de alunos, exercícios, treinos, histórico de pagamentos e planos Pix não são recriadas nem esvaziadas.

## Configuração
- Front-end e Pages Functions juntos no Cloudflare Pages.
- D1: binding `DB` para o mesmo banco já utilizado.
- R2: binding `MEDIA` para o mesmo bucket já utilizado.
- Secrets: preserve `JWT_SECRET`, `SETUP_TOKEN` e demais segredos existentes. Nenhuma chave Asaas é necessária para as novas funcionalidades.
- Publicação: `npm install`, `npm run build`, publicar `dist` com Pages Functions.

## Verificação manual após o deploy
1. `/api/health` retorna JSON de saúde.
2. `/api/public/doctor` retorna os quatro links e os campos públicos do Dr. Alison.
3. Login do Wagner continua funcionando.
4. Login do Dr. Alison funciona e apresenta **Painel médico**; troque a senha inicial.
5. No aluno, acesse **Saúde e Emagrecimento** (mesmo sem assinatura ativa) e abra o WhatsApp; revise a mensagem preenchida.
6. Autorize o vínculo pelo aluno; confirme que ele aparece no painel médico.
7. Salve um rascunho, anexe PDF e publique; verifique a visualização em **Minha dieta** do aluno.
8. Revogue vínculo; o médico não deve mais visualizar o paciente. O aluno continua vendo os próprios documentos publicados.
9. Verifique responsividade e instalação PWA no celular.

## Limitações / precauções
- Os horários e a confirmação de agendamento médico ocorrem pelo WhatsApp, não por um calendário automático dentro da plataforma.
- O médico deve validar o conteúdo clínico e sua habilitação profissional antes de publicar qualquer documento. O sistema não gera prescrições automaticamente.
- O desconto deve estar de acordo com a campanha médica aprovada, sem obrigar contratação do treinamento do Wagner.
- Antes da produção com dados de saúde, avalie requisitos de LGPD, auditoria, termos de autorização, política de retenção, segurança e contingência.
