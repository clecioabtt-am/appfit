# Correção da foto do Dr. Alison — v4.3.2

## Causa comprovada no código 4.3.1
O botão envia POST para `/api/account/photo`, rota inexistente. O servidor devolvia HTTP 404 com o texto `Endereço não encontrado.`.

## Correção
- Criação da rota POST `/api/account/photo`, disponível somente para sessão médica autenticada.
- Formatos JPG, PNG ou WEBP, com limite de 4 MB.
- Armazenamento no R2 `MEDIA`, prefixo `public/doctor-avatars/`.
- Campo D1 `doctor_accounts.profile_image_url`, já criado pela migração `0008_DOUTOR_FOTO_PERFIL.sql`.
- Interface do médico atualiza a foto do menu e do cabeçalho imediatamente após o upload.
- Troca de versão do cache PWA.

## Como atualizar sem perder cadastros
1. Não apague o D1 nem o R2. Faça backup antes da atualização.
2. Verifique se a migração 0008 já foi aplicada. No D1: `PRAGMA table_info(doctor_accounts);` e procure `profile_image_url`. Só execute o 0008 se a coluna ainda não existir.
3. Faça o deploy do projeto 4.3.2, mantendo os bindings `DB` (D1) e `MEDIA` (R2).
4. No perfil médico, clique em Configurações → Alterar imagem e envie JPG/PNG/WEBP (até 4 MB).
5. Atualize/reabra o PWA, caso esteja usando versão instalada no Windows ou no celular.

A rota não usa Asaas nem afeta planos, pagamentos, pacientes ou documentos médicos.
