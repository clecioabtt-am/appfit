-- OPERAÇÃO MANUAL E ÚNICA: define o login solicitado para Wagner Noronha.
-- NÃO publique este SQL em repositório público e troque a senha após o primeiro login.
-- Este script NÃO apaga nenhum aluno; altera SOMENTE o administrador mais antigo.
-- Executar DEPOIS de criar as tabelas básicas users (e migração Pix manual).
INSERT INTO users(name,email,password_hash,role,subscription_status)
 SELECT 'Wagner Noronha','wagnernoronha@personal.com','ac414c99-2007-4dd5-95ea-abdfb002fb12.ImH7JS5dgMuPYMOIjsfdpnpaB_MSj7pRoyLzsp-W2_M','admin','ACTIVE'
 WHERE NOT EXISTS(SELECT 1 FROM users WHERE role='admin');
UPDATE users SET name='Wagner Noronha',email='wagnernoronha@personal.com',password_hash='ac414c99-2007-4dd5-95ea-abdfb002fb12.ImH7JS5dgMuPYMOIjsfdpnpaB_MSj7pRoyLzsp-W2_M'
 WHERE id=(SELECT id FROM users WHERE role='admin' ORDER BY id LIMIT 1);
