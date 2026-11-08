# Wagner Noronha — Personal Trainer | Versão 4.3.2

Plataforma web e PWA para alunos, personal trainer e médico parceiro. Interface premium preto/dourado, adaptada a celulares, tablets e computadores. **A marca exibida ao público é exclusivamente Wagner Noronha — Personal Trainer.**

## Principais módulos

### Aluno
- Cadastro e autenticação; escolha de planos de treinamento, Pix com chave por plano, envio de comprovante e liberação manual pelo Wagner.
- Treinos programados por dia, biblioteca de exercícios, vídeos, cronômetro de descanso, registro de conclusão, perfil e dicas.
- **Saúde e Emagrecimento**: perfil do Dr. Alison Martins, CRM-AM 6678, chamada com desconto de 10% na primeira consulta, botão do WhatsApp com nome do aluno e origem Wagner Noronha pré-preenchidos. O aluno revisa e envia a mensagem no próprio WhatsApp.
- Links para Instagram, Facebook, site oficial e artigos do Dr. Alison.
- Autorização explícita para vincular seu cadastro ao Dr. Alison; pode ser revogada na mesma aba.
- **Minha dieta**: orientações antigas e novos planos médicos publicados, refeições detalhadas, histórico por versão e visualização de PDF privado. A aba funciona mesmo sem assinatura ativa de treinos.

### Personal Wagner (administrador)
- Gestão de alunos, planos, Pix, comprovantes, aprovação manual, consultorias, exercícios, treinos por aluno, dicas e imagens da plataforma.
- **Parceria Dr. Alison**: edição do número de WhatsApp, links, percentual e ativação da divulgação. **Sem acesso aos planos médicos confidenciais.**

### Dr. Alison (médico)
- Login separado no mesmo formulário de entrada, identificado automaticamente pelo sistema.
- Lista **somente de alunos que autorizaram o vínculo**, com nome e e-mail. Não tem acesso às cobranças Pix ou ao cadastro de outros alunos.
- Criação e edição de **rascunhos** de orientações alimentares por paciente (título, orientações, horário, refeições e observações), upload opcional de PDF privado (máx. 10 MB) e botão **Publicar**.
- O plano publicado não pode ser alterado; criar nova versão preserva o histórico para o aluno.
- Troca de senha pelo próprio painel.

## Acesso médico inicial
- E-mail: `alisonmartins@gmail.com`
- Senha inicial: a senha que foi solicitada no desenvolvimento. **Trocar no primeiro acesso**, pela opção Minha senha.
- Criado por hash PBKDF2 na migração `migrations/0007_PARCEIRA_SAUDE_DR_ALISON_D1.sql`; nenhuma senha em texto puro é enviada ao front-end nem salva diretamente no banco.
- O médico é mantido em `doctor_accounts` para preservar a restrição antiga de perfis na tabela `users` (admin/student) do banco em uso.

## Implantação em Cloudflare Pages — banco já existente

**Faça backup do banco D1 e do bucket R2 ANTES de atualizar.** Execute os passos na ordem:

1. No painel Cloudflare Pages, identifique o projeto atualmente publicado e o banco e bucket já conectados. Preserve os bindings existentes `DB` (D1) e `MEDIA` (R2). Não crie um banco novo por engano.
2. Se o sistema atual está na versão 4.2, execute **somente** o arquivo `migrations/0007_PARCEIRA_SAUDE_DR_ALISON_D1.sql` no D1 de produção, pela aba Console. Ele cria tabelas novas, preserva alunos e treinos e configura o acesso médico inicial.
3. Extraia este ZIP, entre na pasta `wagner-noronha-personal` e use `npm install` e `npm run build`. No projeto Cloudflare Pages, configure **Build command**: `npm run build`, **Output directory**: `dist`, e Root directory na pasta deste projeto, se o repositório tiver outras pastas.
4. Faça novo deploy contendo os arquivos de origem e Pages Functions; confirme que `/api/health` e `/api/public/doctor` respondem. O PWA usa um cache novo para carregar os arquivos atualizados.
5. Acesse o login com as credenciais iniciais informadas para o médico e altere imediatamente a senha. A senha do administrador Wagner permanece inalterada.
6. No painel Wagner, abra **Parceria Dr. Alison**, confirme o WhatsApp com DDI, os endereços oficiais e os 10% de desconto.
7. Crie um aluno de teste, abra **Saúde e Emagrecimento**, autorize o vínculo, entre como médico e publique um rascunho de teste. Confira em **Minha dieta** do aluno. Depois revogue o vínculo e confirme que ele deixa de aparecer na lista do médico.

### Se o banco é novo e está vazio
Execute `migrations/0001_INSTALACAO_NOVA.sql` (apenas banco vazio), depois `migrations/0005_PIX_MANUAL_BANCO_EXISTENTE.sql`, depois `migrations/0007_PARCEIRA_SAUDE_DR_ALISON_D1.sql`. A configuração do login Wagner existente deve ser realizada pelo procedimento de bootstrap da versão 4.2. Nunca rode o `0001` em banco com dados.

### Banco e storage
Os nomes físicos de recursos Cloudflare existentes podem continuar com identificadores históricos como `afit-database` e `afit-media`; **não os renomeie sem migração**, pois são recursos de infraestrutura e não a marca exibida ao aluno.

### Segurança dos documentos médicos
- Documentos são salvos no R2 sob `private/medical-plans/` e servidos somente pela rota autenticada `/api/medical/plans/:id/pdf`.
- O paciente só pode acessar os próprios planos publicados; o médico só pode acessar planos de pacientes atualmente vinculados, inclusive para PDF.
- A revogação do vínculo bloqueia novo acesso do médico, mas não apaga os planos já publicados que pertencem ao paciente.
- O administrador do personal não tem rotas para visualizar os arquivos clínicos. Dados da parceria pública são separados.
- Dados sensíveis exigem controle de acesso, backup, retenção e governança de privacidade conforme a legislação aplicável. Antes da utilização clínica real, valide os aspectos profissionais, jurídicos e de segurança com os responsáveis.

### Importante
Esta versão foi testada com um ambiente D1 SQLite simulado e testes de API, **não foi implantada automaticamente** na Cloudflare. A compilação completa do front-end exige dependências npm e validação no ambiente real. Veja `docs/GUIA_PUBLICACAO_4_3.md`.

## Correção 4.3.2 — imagem do perfil médico

A versão 4.3.1 exibia a tela de Configurações, mas o servidor não tinha a rota POST `/api/account/photo`; ao escolher a foto, mostrava **"Endereço não encontrado."**. A versão 4.3.2 cria a rota protegida exclusivamente para o perfil `doctor`, grava JPG/PNG/WEBP (até 4 MB) no bucket `MEDIA` (R2) sob `public/doctor-avatars/{id}/`, atualiza `doctor_accounts.profile_image_url` no D1 e atualiza a interface do médico após o upload.

**Implantação:** mantenha o binding R2 `MEDIA` e o binding D1 `DB` já existentes. A migração `0008_DOUTOR_FOTO_PERFIL.sql` deve ter sido executada uma vez para acrescentar a coluna `profile_image_url` à tabela `doctor_accounts`. Se você já vê o painel médico 4.3.1 normalmente, ela provavelmente já foi aplicada. **Não execute o 0008 novamente**, pois o SQLite D1 não permite adicionar a mesma coluna duas vezes. Para o conserto da rota na versão 4.3.2 não há novo SQL.

Após o deploy, entre como Dr. Alison, acesse **Configurações → Alterar imagem**, selecione um JPG/PNG/WEBP até 4 MB e confirme a imagem no menu inferior esquerdo e no cabeçalho. Se aparecer erro de upload no R2, verifique o binding `MEDIA`.
