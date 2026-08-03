ALTERAÇÕES NO functions/api/[[path]].ts

1) Logo depois de requireUser(), adicione:

function hasExpired(until?: string | null): boolean {
  if (!until) return false;
  const timestamp = Date.parse(until);
  return Number.isFinite(timestamp) && timestamp <= Date.now();
}

async function normalizeStudentAccess(env: Env, record: any): Promise<any> {
  if (
    record &&
    record.role === "student" &&
    record.subscription_status === "ACTIVE" &&
    hasExpired(record.subscription_until)
  ) {
    await env.DB.prepare(
      "UPDATE users SET subscription_status = 'INACTIVE' WHERE id = ?",
    )
      .bind(record.id)
      .run();

    return { ...record, subscription_status: "INACTIVE" };
  }

  return record;
}


2) Na rota /api/auth/login, depois de validar a senha e ANTES de montar const user,
troque:

const record: any = ...

por:

let record: any = ...

e adicione:

record = await normalizeStudentAccess(env, record);


3) Na rota /api/plans, troque a consulta por:

const rows = await env.DB.prepare(
  "SELECT id,name,price,period,description,duration_days FROM plans WHERE active = 1 ORDER BY price ASC,id ASC",
).all();


4) Na rota /api/auth/me, troque o SELECT por:

let record: any = await env.DB.prepare(
  "SELECT id,name,email,role,subscription_status,subscription_until,trial_used FROM users WHERE id = ?",
)
  .bind(user.id)
  .first();

if (!record) return error("Usuário não encontrado.", 404);

record = await normalizeStudentAccess(env, record);

return json({
  user: {
    id: record.id,
    name: record.name,
    email: record.email,
    role: record.role,
    subscriptionStatus: record.subscription_status,
    subscriptionUntil: record.subscription_until,
    trialUsed: Boolean(record.trial_used),
  },
});


5) Na rota /api/payments/checkout, imediatamente depois de:

if (!plan || !student) return error("Plano ou aluno inválido.");

adicione:

const isTrial =
  Number(plan.price) === 0 &&
  Number(plan.duration_days) === 20 &&
  String(plan.name).trim().toLowerCase() === "plano teste";

if (isTrial) {
  if (Number(student.trial_used || 0) === 1) {
    return error(
      "O Plano Teste de 20 dias já foi utilizado por esta conta.",
      409,
    );
  }

  const until = new Date(
    Date.now() + 20 * 86_400_000,
  ).toISOString();

  await env.DB.prepare(
    `UPDATE users
     SET subscription_status = 'ACTIVE',
         subscription_until = ?,
         trial_used = 1
     WHERE id = ?`,
  )
    .bind(until, user.id)
    .run();

  return json({
    trial: true,
    status: "ACTIVE",
    until,
    message: "Plano Teste ativado por 20 dias.",
  });
}

IMPORTANTE:
Esse bloco precisa ficar ANTES da criação do customer no Asaas.
Assim o Plano Teste nunca chama a API do Asaas e nunca gera cobrança.


6) Substitua a rota /api/payments/status por:

if (path === "/api/payments/status" && method === "GET") {
  let record: any = await env.DB.prepare(
    "SELECT id,role,subscription_status,subscription_until,trial_used FROM users WHERE id = ?",
  )
    .bind(user.id)
    .first();

  record = await normalizeStudentAccess(env, record);

  return json({
    status: record?.subscription_status,
    until: record?.subscription_until,
    trialUsed: Boolean(record?.trial_used),
  });
}


7) No começo da rota /api/student/content, substitua a validação atual por:

let record: any = await env.DB.prepare(
  "SELECT id,role,subscription_status,subscription_until FROM users WHERE id = ?",
)
  .bind(user.id)
  .first();

record = await normalizeStudentAccess(env, record);

if (record?.subscription_status !== "ACTIVE") {
  return error(
    "Seu acesso está inativo ou o período de teste terminou.",
    402,
  );
}


8) No cadastro de aluno (/api/auth/register), como a migration cria DEFAULT 0,
não é obrigatório mudar o INSERT. O campo trial_used será 0 automaticamente.

9) Na listagem administrativa de students, você pode trocar por:

"SELECT id,name,email,phone,subscription_status,subscription_until,trial_used,created_at FROM users WHERE role='student' ORDER BY id DESC"

Isso permite ao ADM enxergar se o teste já foi usado.
