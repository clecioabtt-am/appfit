-- Opcional: execute SOMENTE se desejar oferecer Plano Teste com aprovação do administrador.
INSERT INTO plans(name,price,period,duration_days,description,active)
 SELECT 'Plano Teste',0,'teste',20,'Acesso gratuito de 20 dias mediante aprovação manual.',1
 WHERE NOT EXISTS(SELECT 1 FROM plans WHERE lower(name)='plano teste');
INSERT OR IGNORE INTO plan_pix_config(plan_id,pix_key,pix_type,recipient_name)
 SELECT id,'','Isento','Wagner Noronha' FROM plans WHERE lower(name)='plano teste';
