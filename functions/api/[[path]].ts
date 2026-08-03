import {
  type Env,
  asaasRequest,
  error,
  hashPassword,
  json,
  readUser,
  signToken,
  verifyPassword,
} from "../_lib/core";

type Context = {
  request: Request;
  env: Env;
  params: { path?: string[] | string };
};

function normalizedPath(context: Context): string {
  const value = context.params.path;
  const suffix = Array.isArray(value) ? value.join("/") : value || "";
  return `/api/${suffix}`.replace(/\/+$/, "") || "/api";
}

async function requireUser(request: Request, env: Env): Promise<any> {
  return readUser(request, env);
}

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

    return {
      ...record,
      subscription_status: "INACTIVE",
    };
  }

  return record;
}

export const onRequest = async (context: Context): Promise<Response> => {
  const { request, env } = context;
  const path = normalizedPath(context);
  const method = request.method.toUpperCase();

  try {
    if (path === "/api/health") {
      return json({ ok: true, service: "AFIT Pages Functions" });
    }

    if (path === "/api/setup/status" && method === "GET") {
      const admin = await env.DB.prepare(
        "SELECT id FROM users WHERE role = 'admin' LIMIT 1",
      ).first();

      return json({ configured: Boolean(admin) });
    }

    if (path === "/api/setup/admin" && method === "POST") {
      if (request.headers.get("x-setup-token") !== env.SETUP_TOKEN) {
        return error("Token de configuração inválido.", 403);
      }

      const existing = await env.DB.prepare(
        "SELECT id FROM users WHERE role = 'admin' LIMIT 1",
      ).first();

      if (existing) {
        return error("O administrador inicial já foi configurado.", 409);
      }

      const body: any = await request.json();

      if (!body.name || !body.email || !body.password || body.password.length < 8) {
        return error(
          "Informe nome, e-mail e senha com pelo menos 8 caracteres.",
        );
      }

      await env.DB.prepare(
        "INSERT INTO users(name,email,password_hash,role,subscription_status) VALUES(?,?,?,?,?)",
      )
        .bind(
          String(body.name).trim(),
          String(body.email).trim().toLowerCase(),
          await hashPassword(body.password),
          "admin",
          "ACTIVE",
        )
        .run();

      return json({ ok: true }, 201);
    }

    if (path === "/api/auth/register" && method === "POST") {
      const body: any = await request.json();

      if (!body.name || !body.email || !body.password || body.password.length < 8) {
        return error(
          "Informe nome, e-mail e senha com pelo menos 8 caracteres.",
        );
      }

      try {
        const created: any = await env.DB.prepare(
          "INSERT INTO users(name,email,password_hash,role,cpf,phone,subscription_status) VALUES(?,?,?,?,?,?,?) RETURNING id",
        )
          .bind(
            String(body.name).trim(),
            String(body.email).trim().toLowerCase(),
            await hashPassword(body.password),
            "student",
            body.cpf || null,
            body.phone || null,
            "INACTIVE",
          )
          .first();

        const user = {
          id: created.id,
          name: String(body.name).trim(),
          email: String(body.email).trim().toLowerCase(),
          role: "student",
          subscriptionStatus: "INACTIVE",
        };

        return json(
          {
            token: await signToken(user, env.JWT_SECRET),
            user,
          },
          201,
        );
      } catch {
        return error("Este e-mail já está cadastrado.", 409);
      }
    }

    if (path === "/api/auth/login" && method === "POST") {
      const body: any = await request.json();

      let record: any = await env.DB.prepare(
        "SELECT * FROM users WHERE email = ?",
      )
        .bind(String(body.email || "").trim().toLowerCase())
        .first();

      if (
        !record ||
        !(await verifyPassword(
          String(body.password || ""),
          record.password_hash,
        ))
      ) {
        return error("E-mail ou senha inválidos.", 401);
      }

      record = await normalizeStudentAccess(env, record);

      const user = {
        id: record.id,
        name: record.name,
        email: record.email,
        role: record.role,
        subscriptionStatus: record.subscription_status,
      };

      return json({
        token: await signToken(user, env.JWT_SECRET),
        user,
      });
    }

    if (path === "/api/plans" && method === "GET") {
      const rows = await env.DB.prepare(
        "SELECT id,name,price,period,description,duration_days FROM plans WHERE active = 1 ORDER BY price ASC,id ASC",
      ).all();

      return json({ plans: rows.results });
    }

    if (path === "/api/asaas/webhook" && method === "POST") {
      if (
        !env.ASAAS_WEBHOOK_TOKEN ||
        request.headers.get("asaas-access-token") !== env.ASAAS_WEBHOOK_TOKEN
      ) {
        return error("Webhook não autorizado.", 401);
      }

      const event: any = await request.json();
      const payment = event.payment;

      if (payment?.id) {
        await env.DB.prepare(
          "UPDATE payments SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE asaas_payment_id = ?",
        )
          .bind(payment.status, payment.id)
          .run();

        if (
          ["RECEIVED", "CONFIRMED", "RECEIVED_IN_CASH"].includes(
            payment.status,
          )
        ) {
          const row: any = await env.DB.prepare(
            "SELECT user_id,plan_id FROM payments WHERE asaas_payment_id = ?",
          )
            .bind(payment.id)
            .first();

          if (row) {
            const plan: any = await env.DB.prepare(
              "SELECT duration_days FROM plans WHERE id = ?",
            )
              .bind(row.plan_id)
              .first();

            const until = new Date(
              Date.now() + Number(plan?.duration_days || 30) * 86_400_000,
            ).toISOString();

            await env.DB.prepare(
              "UPDATE users SET subscription_status = 'ACTIVE', subscription_until = ? WHERE id = ?",
            )
              .bind(until, row.user_id)
              .run();
          }
        }
      }

      return new Response(null, { status: 204 });
    }

    const user = await requireUser(request, env);

    if (!user) {
      return error("Não autenticado.", 401);
    }

    if (path === "/api/auth/me" && method === "GET") {
      let record: any = await env.DB.prepare(
        "SELECT id,name,email,role,subscription_status,subscription_until,trial_used FROM users WHERE id = ?",
      )
        .bind(user.id)
        .first();

      if (!record) {
        return error("Usuário não encontrado.", 404);
      }

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
    }

    if (path === "/api/payments/checkout" && method === "POST") {
      if (user.role !== "student") {
        return error("Operação exclusiva para alunos.", 403);
      }

      const body: any = await request.json();

      const plan: any = await env.DB.prepare(
        "SELECT * FROM plans WHERE id = ? AND active = 1",
      )
        .bind(Number(body.planId))
        .first();

      let student: any = await env.DB.prepare(
        "SELECT * FROM users WHERE id = ?",
      )
        .bind(user.id)
        .first();

      if (!plan || !student) {
        return error("Plano ou aluno inválido.");
      }

      student = await normalizeStudentAccess(env, student);

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

      let customerId = student.asaas_customer_id;

      if (!customerId) {
        const customer = await asaasRequest(
          env,
          "/customers",
          "POST",
          {
            name: student.name,
            cpfCnpj: student.cpf,
            email: student.email,
            mobilePhone: student.phone,
            externalReference: String(student.id),
          },
        );

        customerId = customer.id;

        await env.DB.prepare(
          "UPDATE users SET asaas_customer_id = ? WHERE id = ?",
        )
          .bind(customerId, user.id)
          .run();
      }

      const dueDate = new Date(Date.now() + 3 * 86_400_000)
        .toISOString()
        .slice(0, 10);

      const payment = await asaasRequest(
        env,
        "/payments",
        "POST",
        {
          customer: customerId,
          billingType: "UNDEFINED",
          value: Number(plan.price),
          dueDate,
          description: `AFIT - ${plan.name}`,
          externalReference: `user:${user.id}|plan:${plan.id}`,
        },
      );

      const invoiceUrl =
        payment.invoiceUrl || payment.bankSlipUrl;

      await env.DB.prepare(
        "INSERT INTO payments(user_id,plan_id,asaas_payment_id,status,value,invoice_url) VALUES(?,?,?,?,?,?)",
      )
        .bind(
          user.id,
          plan.id,
          payment.id,
          payment.status,
          plan.price,
          invoiceUrl,
        )
        .run();

      return json({
        invoiceUrl,
        paymentId: payment.id,
      });
    }

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

    if (path === "/api/student/content" && method === "GET") {
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

      const [exercises, tips] = await Promise.all([
        env.DB.prepare(
          `SELECT id,name,training_category AS trainingCategory,muscle_group AS muscleGroup,
          level,execution_mode AS executionMode,description,objective,instructions,benefits,
          common_errors AS commonErrors,equipment,sets,reps,duration,rest,tags,
          video_url AS videoUrl,image_url AS imageUrl
          FROM exercises WHERE active = 1 ORDER BY training_category,name`,
        ).all(),

        env.DB.prepare(
          "SELECT id,title,description,category,video_url AS videoUrl,image_url AS imageUrl FROM tips WHERE active = 1 ORDER BY id DESC",
        ).all(),
      ]);

      return json({
        exercises: exercises.results,
        tips: tips.results,
        diet: [],
      });
    }

    if (!path.startsWith("/api/admin/")) {
      return error("Rota não encontrada.", 404);
    }

    if (user.role !== "admin") {
      return error("Acesso restrito ao administrador.", 403);
    }

    const resource = path.split("/")[3];

    if (resource === "upload" && method === "POST") {
      const formData = await request.formData();
      const file = formData.get("file");

      if (!(file instanceof File)) {
        return error("Selecione um arquivo válido.");
      }

      if (file.size > 95 * 1024 * 1024) {
        return error(
          "Neste modo de upload, o arquivo deve ter no máximo 95 MB.",
        );
      }

      const safeName = file.name.replace(
        /[^a-zA-Z0-9._-]/g,
        "_",
      );

      const key =
        `uploads/${new Date().toISOString().slice(0, 10)}/` +
        `${crypto.randomUUID()}-${safeName}`;

      await env.MEDIA.put(key, file.stream(), {
        httpMetadata: {
          contentType:
            file.type || "application/octet-stream",
        },
      });

      return json(
        {
          key,
          url: `/media/${encodeURIComponent(key)}`,
        },
        201,
      );
    }

    const definitions: Record<string, any> = {
      exercises: {
        select: `SELECT id,name,training_category AS trainingCategory,muscle_group AS muscleGroup,
          level,execution_mode AS executionMode,description,objective,instructions,benefits,
          common_errors AS commonErrors,equipment,sets,reps,duration,rest,tags,
          video_url AS videoUrl,image_url AS imageUrl,active
          FROM exercises ORDER BY id DESC`,

        insert: `INSERT INTO exercises(
          name,training_category,muscle_group,level,execution_mode,description,objective,
          instructions,benefits,common_errors,equipment,sets,reps,duration,rest,tags,
          video_url,image_url
        ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,

        values: (body: any) => [
          body.name,
          body.trainingCategory || "Musculação",
          body.muscleGroup || null,
          body.level || "Iniciante",
          body.executionMode || "Repetições",
          body.description || null,
          body.objective || null,
          body.instructions || null,
          body.benefits || null,
          body.commonErrors || null,
          body.equipment || null,
          Number(body.sets || 0),
          body.reps || null,
          body.duration || null,
          body.rest || null,
          body.tags || null,
          body.videoUrl || null,
          body.imageUrl || null,
        ],
      },

      tips: {
        select:
          "SELECT id,title,description,category,video_url AS videoUrl,image_url AS imageUrl,active FROM tips ORDER BY id DESC",

        insert:
          "INSERT INTO tips(title,description,category,video_url,image_url) VALUES(?,?,?,?,?)",

        values: (body: any) => [
          body.title,
          body.description || null,
          body.category || null,
          body.videoUrl || null,
          body.imageUrl || null,
        ],
      },

      diets: {
        select:
          "SELECT d.id,d.time,d.title,d.description,u.email FROM diet_items d JOIN users u ON u.id=d.user_id ORDER BY d.id DESC",

        insert:
          "INSERT INTO diet_items(user_id,time,title,description) SELECT id,?,?,? FROM users WHERE email=? AND role='student'",

        values: (body: any) => [
          body.time || null,
          body.title,
          body.description || null,
          String(body.studentEmail || "")
            .trim()
            .toLowerCase(),
        ],
      },

      students: {
        select:
          "SELECT id,name,email,phone,subscription_status,subscription_until,trial_used,created_at FROM users WHERE role='student' ORDER BY id DESC",
      },
    };

    const definition = definitions[resource];

    if (!definition) {
      return error("Recurso administrativo inválido.", 404);
    }

    if (method === "GET") {
      const result = await env.DB.prepare(
        definition.select,
      ).all();

      return json({
        items: result.results,
      });
    }

    if (method === "POST" && definition.insert) {
      const body: any = await request.json();

      if (resource === "exercises" && !body.name) {
        return error("Informe o nome do exercício.");
      }

      if (resource === "tips" && !body.title) {
        return error("Informe o título da dica.");
      }

      if (
        resource === "diets" &&
        (!body.studentEmail || !body.title)
      ) {
        return error(
          "Informe o e-mail do aluno e o título da refeição.",
        );
      }

      const result = await env.DB.prepare(
        definition.insert,
      )
        .bind(...definition.values(body))
        .run();

      if (
        resource === "diets" &&
        result.meta?.changes === 0
      ) {
        return error(
          "Aluno não encontrado com o e-mail informado.",
          404,
        );
      }

      return json({ ok: true }, 201);
    }

    return error("Método não permitido.", 405);
  } catch (caught: any) {
    console.error(caught);

    return error(
      caught?.message || "Erro interno do sistema.",
      500,
    );
  }
};
