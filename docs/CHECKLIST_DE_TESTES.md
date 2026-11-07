# Checklist de implantação e testes — Wagner Noronha

Marque apenas após testar no Cloudflare com D1/R2 configurados e banco de teste, **antes** de substituir a produção.

- [ ] O login do administrador Wagner funciona e sua senha inicial foi trocada.
- [ ] A logo enviada aparece no cabeçalho e no PWA sem cobrir a foto.
- [ ] A foto do Wagner aparece no login, no dashboard do aluno e no menu.
- [ ] Trocar logo, foto inicial e foto interna pelo admin funciona e persiste após atualizar.
- [ ] O mesmo layout fica legível e sem rolagem horizontal em iPhone e Android.
- [ ] Instalação PWA por Safari e Chrome com ícone adequado.
- [ ] Alterar a chave Pix em um plano e confirmar persistência.
- [ ] Um aluno novo registra conta, escolhe plano e confirma seleção.
- [ ] O pedido pendente aparece no painel admin com o nome do aluno e plano correto.
- [ ] O aluno visualiza a chave Pix e o preço correto, antes de efetuar pagamento.
- [ ] O aluno envia PNG/JPG ou PDF de comprovante.
- [ ] O comprovante só pode ser visualizado pelo aluno dono e pelo administrador.
- [ ] Enviar comprovante NÃO libera o plano automaticamente.
- [ ] O administrador abre comprovante e autoriza o plano; expiração é calculada corretamente.
- [ ] O aluno vê o plano ativo e os treinos liberados após autenticação/atualização.
- [ ] O administrador rejeita um pedido e o aluno consegue escolher novamente.
- [ ] As assinaturas e alunos existentes continuam preservados no D1.
- [ ] O treinador cadastra exercício, anexa mídia e atribui treino semanal ao aluno.
- [ ] O aluno completa exercício com cronômetro e a conclusão aparece ao recarregar.
- [ ] O treinador cadastra dieta para o aluno e o aluno visualiza na aba Minha dieta.
- [ ] Consultoria individual: solicitação, oferta e seleção de horário, chave Pix, comprovante, aprovação e link da reunião.
- [ ] Não existe cobrança Pix do Asaas, webhook automático nem abertura de invoiceUrl.
- [ ] Qualquer webhook Asaas da infraestrutura anterior foi revisado/desativado no provedor.
- [ ] Comprovantes ficam inacessíveis na rota pública `/media/private/proofs/...`.
- [ ] O upload rejeita arquivos não autorizados e maiores que o limite.
- [ ] Há backup e plano de reversão antes da implantação.
