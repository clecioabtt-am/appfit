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
        const consultation: any = await env.DB.prepare(
          "SELECT id FROM consultation_requests WHERE asaas_payment_id = ?",
        ).bind(payment.id).first();

        if (consultation) {
          const paid = ["RECEIVED", "CONFIRMED", "RECEIVED_IN_CASH"].includes(payment.status);
          await env.DB.prepare(
            `UPDATE consultation_requests
             SET payment_status = ?,
                 status = CASE WHEN ? = 1 THEN 'CONFIRMED' ELSE status END,
                 paid_at = CASE WHEN ? = 1 THEN COALESCE(paid_at,CURRENT_TIMESTAMP) ELSE paid_at END,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = ?`,
          ).bind(payment.status, paid ? 1 : 0, paid ? 1 : 0, consultation.id).run();
          return new Response(null, { status: 204 });
        }

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

    if (path === "/api/auth/reset-password" && method === "POST") {
      const body: any = await request.json();
      const email = String(body.email || "").trim().toLowerCase();
      const cpf5 = String(body.cpf5 || "").replace(/\D/g, "").slice(0, 5);
      const password = String(body.password || "");
      if (!email || cpf5.length !== 5 || password.length < 8) return error("Informe e-mail, os 5 primeiros números do CPF e uma nova senha com 8 caracteres.");
      const record: any = await env.DB.prepare("SELECT id,cpf FROM users WHERE email=? AND role='student'").bind(email).first();
      const stored = String(record?.cpf || "").replace(/\D/g, "");
      if (!record || stored.slice(0,5) !== cpf5) return error("Dados de recuperação não conferem.", 403);
      await env.DB.prepare("UPDATE users SET password_hash=? WHERE id=?").bind(await hashPassword(password), record.id).run();
      return json({ ok: true });
    }

    const user = await requireUser(request, env);

    if (!user) {
      return error("Não autenticado.", 401);
    }

    if (path === "/api/auth/me" && method === "GET") {
      let record: any = await env.DB.prepare(
        "SELECT id,name,email,role,subscription_status,subscription_until,trial_used,profile_image_url FROM users WHERE id = ?",
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
          profileImageUrl: record.profile_image_url || undefined,
        },
      });
    }

    if (path === "/api/student/consultation" && method === "GET") {
      if (user.role !== "student") return error("Operação exclusiva para alunos.", 403);
      const req: any = await env.DB.prepare(
        `SELECT cr.id,cr.status,cr.price,cr.selected_slot_id AS selectedSlotId,
                cr.payment_status AS paymentStatus,cr.invoice_url AS invoiceUrl,
                cr.meeting_url AS meetingUrl,cr.requested_at AS requestedAt,
                cs.starts_at AS selectedStartsAt
         FROM consultation_requests cr
         LEFT JOIN consultation_slots cs ON cs.id=cr.selected_slot_id
         WHERE cr.student_id=? AND cr.status!='CANCELLED'
         ORDER BY cr.id DESC LIMIT 1`,
      ).bind(user.id).first();
      if (!req) return json({ request: null, slots: [] });
      const slots = await env.DB.prepare(
        `SELECT id,starts_at AS startsAt,status FROM consultation_slots
         WHERE request_id=? AND status!='CANCELLED' ORDER BY starts_at`,
      ).bind(req.id).all();
      return json({ request: req, slots: slots.results });
    }

    if (path === "/api/student/consultation/request" && method === "POST") {
      if (user.role !== "student") return error("Operação exclusiva para alunos.", 403);
      const existing: any = await env.DB.prepare(
        `SELECT id,status FROM consultation_requests WHERE student_id=?
         AND status IN ('REQUESTED','AVAILABILITY_SENT','AWAITING_PAYMENT','CONFIRMED')
         ORDER BY id DESC LIMIT 1`,
      ).bind(user.id).first();
      if (existing) return error("Você já possui uma solicitação de consultoria em andamento.", 409);
      const created: any = await env.DB.prepare(
        "INSERT INTO consultation_requests(student_id,price,status) VALUES(?,300,'REQUESTED') RETURNING id",
      ).bind(user.id).first();
      return json({ ok:true, id:created.id, status:'REQUESTED' }, 201);
    }

    if (path === "/api/student/consultation/select" && method === "POST") {
      if (user.role !== "student") return error("Operação exclusiva para alunos.", 403);
      const body:any = await request.json();
      const slotId = Number(body.slotId);
      const slot:any = await env.DB.prepare(
        `SELECT cs.id,cs.request_id,cs.starts_at,cr.status,cr.price,cr.student_id
         FROM consultation_slots cs JOIN consultation_requests cr ON cr.id=cs.request_id
         WHERE cs.id=? AND cr.student_id=? AND cs.status='AVAILABLE'`,
      ).bind(slotId,user.id).first();
      if (!slot || !['AVAILABILITY_SENT','REQUESTED'].includes(slot.status)) return error("Este horário não está mais disponível.",409);

      let student:any = await env.DB.prepare("SELECT * FROM users WHERE id=?").bind(user.id).first();
      let customerId=student.asaas_customer_id;
      if(!customerId){
        const customer=await asaasRequest(env,"/customers","POST",{name:student.name,cpfCnpj:student.cpf,email:student.email,mobilePhone:student.phone,externalReference:String(student.id)});
        customerId=customer.id;
        await env.DB.prepare("UPDATE users SET asaas_customer_id=? WHERE id=?").bind(customerId,user.id).run();
      }
      const dueDate=new Date(Date.now()+3*86_400_000).toISOString().slice(0,10);
      const payment=await asaasRequest(env,"/payments","POST",{
        customer:customerId,billingType:"UNDEFINED",value:300,dueDate,
        description:`AFIT - Consultoria Online - ${slot.starts_at}`,
        externalReference:`consultation:${slot.request_id}`,
      });
      const invoiceUrl=payment.invoiceUrl||payment.bankSlipUrl;
      await env.DB.batch([
        env.DB.prepare("UPDATE consultation_slots SET status='SELECTED' WHERE id=?").bind(slot.id),
        env.DB.prepare("UPDATE consultation_slots SET status='CANCELLED' WHERE request_id=? AND id<>?").bind(slot.request_id,slot.id),
        env.DB.prepare(`UPDATE consultation_requests SET selected_slot_id=?,status='AWAITING_PAYMENT',asaas_payment_id=?,payment_status=?,invoice_url=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`).bind(slot.id,payment.id,payment.status,invoiceUrl,slot.request_id),
      ]);
      return json({ invoiceUrl,paymentId:payment.id,status:'AWAITING_PAYMENT' });
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

      const assignments = await env.DB.prepare(`SELECT wa.id,wa.weekday,wa.sort_order AS sortOrder,e.id AS exerciseId,e.name,e.training_category AS trainingCategory,e.muscle_group AS muscleGroup,e.level,e.execution_mode AS executionMode,e.description,e.objective,e.instructions,e.benefits,e.common_errors AS commonErrors,e.equipment,e.sets,e.reps,e.duration,e.rest,e.tags,e.video_url AS videoUrl,e.image_url AS imageUrl FROM workout_assignments wa JOIN exercises e ON e.id=wa.exercise_id WHERE wa.student_id=? AND e.active=1 ORDER BY wa.weekday,wa.sort_order,wa.id`).bind(user.id).all();
      const completions = await env.DB.prepare("SELECT exercise_id AS exerciseId,completed_date AS completedDate FROM workout_completions WHERE user_id=? AND completed_date >= date('now','-7 day')").bind(user.id).all();
      return json({ exercises: exercises.results, tips: tips.results, diet: [], assignments: assignments.results, completions: completions.results });
    }

    if (path === "/api/student/profile-photo" && method === "POST") {
      const formData = await request.formData(); const file = formData.get("file");
      if (!(file instanceof File) || !String(file.type).startsWith("image/")) return error("Selecione uma imagem válida.");
      if (file.size > 8 * 1024 * 1024) return error("A foto deve ter no máximo 8 MB.");
      const key = `profiles/${user.id}/${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g,"_")}`;
      await env.MEDIA.put(key, file.stream(), { httpMetadata: { contentType: file.type } });
      const url = `/media/${encodeURIComponent(key)}`;
      await env.DB.prepare("UPDATE users SET profile_image_url=? WHERE id=?").bind(url,user.id).run();
      return json({ url });
    }

    if (path === "/api/student/workout-complete" && method === "POST") {
      const body:any=await request.json(); const exerciseId=Number(body.exerciseId);
      await env.DB.prepare("INSERT OR IGNORE INTO workout_completions(user_id,exercise_id,completed_date) VALUES(?,?,date('now'))").bind(user.id,exerciseId).run();
      return json({ok:true});
    }

    if (!path.startsWith("/api/admin/")) {
      return error("Rota não encontrada.", 404);
    }

    if (user.role !== "admin") {
      return error("Acesso restrito ao administrador.", 403);
    }

    if (path === "/api/admin/consultations" && method === "GET") {
      const rows = await env.DB.prepare(
        `SELECT cr.id,cr.student_id AS studentId,u.name,u.email,u.phone,cr.status,cr.price,
                cr.payment_status AS paymentStatus,cr.invoice_url AS invoiceUrl,
                cr.meeting_url AS meetingUrl,cr.requested_at AS requestedAt,
                cr.selected_slot_id AS selectedSlotId,cs.starts_at AS selectedStartsAt
         FROM consultation_requests cr JOIN users u ON u.id=cr.student_id
         LEFT JOIN consultation_slots cs ON cs.id=cr.selected_slot_id
         ORDER BY CASE cr.status WHEN 'REQUESTED' THEN 0 WHEN 'AVAILABILITY_SENT' THEN 1 WHEN 'AWAITING_PAYMENT' THEN 2 WHEN 'CONFIRMED' THEN 3 ELSE 4 END, cr.id DESC`,
      ).all();
      for (const r of rows.results as any[]) {
        const slots=await env.DB.prepare("SELECT id,starts_at AS startsAt,status FROM consultation_slots WHERE request_id=? ORDER BY starts_at").bind(r.id).all();
        r.slots=slots.results;
      }
      return json({items:rows.results});
    }

    if (path === "/api/admin/consultations/slots" && method === "POST") {
      const body:any=await request.json(); const requestId=Number(body.requestId);
      const slots=(Array.isArray(body.slots)?body.slots:[]).map((x:any)=>String(x).trim()).filter(Boolean);
      if(!requestId||!slots.length) return error("Informe pelo menos uma data e horário.");
      const cr:any=await env.DB.prepare("SELECT id,status FROM consultation_requests WHERE id=?").bind(requestId).first();
      if(!cr||['CONFIRMED','COMPLETED','CANCELLED'].includes(cr.status)) return error("Solicitação inválida para envio de horários.",409);
      await env.DB.prepare("DELETE FROM consultation_slots WHERE request_id=? AND status='AVAILABLE'").bind(requestId).run();

      // Compatibilidade com bancos D1 criados por versões anteriores do módulo de consultoria.
      // A estrutura antiga possuía available_date/available_time como NOT NULL; a atual usa starts_at.
      const slotColumns = await env.DB.prepare("PRAGMA table_info(consultation_slots)").all();
      const slotColumnNames = new Set((slotColumns.results as any[]).map((c:any)=>String(c.name)));
      const hasLegacySlotColumns = slotColumnNames.has('available_date') && slotColumnNames.has('available_time');

      for(const startsAt of slots){
        if(hasLegacySlotColumns){
          const normalized=String(startsAt).trim();
          const availableDate=normalized.slice(0,10);
          const availableTime=normalized.length>=16 ? normalized.slice(11,16) : normalized.slice(11);
          await env.DB.prepare(
            "INSERT INTO consultation_slots(request_id,available_date,available_time,starts_at,status) VALUES(?,?,?,?,'AVAILABLE')"
          ).bind(requestId,availableDate,availableTime,normalized).run();
        } else {
          await env.DB.prepare(
            "INSERT INTO consultation_slots(request_id,starts_at,status) VALUES(?,?,'AVAILABLE')"
          ).bind(requestId,startsAt).run();
        }
      }
      await env.DB.prepare("UPDATE consultation_requests SET status='AVAILABILITY_SENT',updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(requestId).run();
      return json({ok:true});
    }

    if (path === "/api/admin/consultations" && method === "PUT") {
      const body:any=await request.json(); const id=Number(body.id); const action=String(body.action||'');
      if(!id) return error("Consultoria inválida.");
      if(action==='meeting'){
        await env.DB.prepare("UPDATE consultation_requests SET meeting_url=?,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(String(body.meetingUrl||'').trim()||null,id).run();
      } else if(action==='complete') {
        await env.DB.prepare("UPDATE consultation_requests SET status='COMPLETED',updated_at=CURRENT_TIMESTAMP WHERE id=? AND status='CONFIRMED'").bind(id).run();
      } else if(action==='cancel') {
        const current:any=await env.DB.prepare("SELECT asaas_payment_id,payment_status FROM consultation_requests WHERE id=?").bind(id).first();
        if(current?.asaas_payment_id && !["RECEIVED","CONFIRMED","RECEIVED_IN_CASH"].includes(current.payment_status)){
          try { await asaasRequest(env,`/payments/${current.asaas_payment_id}`,"DELETE"); } catch {}
        }
        await env.DB.prepare("UPDATE consultation_requests SET status='CANCELLED',updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(id).run();
        await env.DB.prepare("UPDATE consultation_slots SET status='CANCELLED' WHERE request_id=?").bind(id).run();
      } else return error("Ação inválida.");
      return json({ok:true});
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
          `SELECT u.id,u.name,u.email,u.cpf,u.phone,u.profile_image_url AS profileImageUrl,u.subscription_status,u.subscription_until,u.trial_used,u.created_at,
          (SELECT p.name FROM payments py JOIN plans p ON p.id=py.plan_id WHERE py.user_id=u.id AND py.status IN ('RECEIVED','CONFIRMED','RECEIVED_IN_CASH') ORDER BY py.id DESC LIMIT 1) AS paid_plan,
          (SELECT py.status FROM payments py WHERE py.user_id=u.id ORDER BY py.id DESC LIMIT 1) AS last_payment_status
          FROM users u WHERE u.role='student' ORDER BY u.id DESC`,
      },
    };

    if (resource === "exercises" && method === "PUT") {
      const body:any=await request.json(); if(!body.id) return error("Exercício inválido.");
      await env.DB.prepare(`UPDATE exercises SET name=?,training_category=?,muscle_group=?,level=?,execution_mode=?,description=?,objective=?,instructions=?,benefits=?,common_errors=?,equipment=?,sets=?,reps=?,duration=?,rest=?,tags=?,video_url=?,image_url=? WHERE id=?`).bind(body.name,body.trainingCategory||"Musculação",body.muscleGroup||null,body.level||"Iniciante",body.executionMode||"Repetições",body.description||null,body.objective||null,body.instructions||null,body.benefits||null,body.commonErrors||null,body.equipment||null,Number(body.sets||0),body.reps||null,body.duration||null,body.rest||null,body.tags||null,body.videoUrl||null,body.imageUrl||null,Number(body.id)).run(); return json({ok:true});
    }
    if ((resource === "exercises" || resource === "students") && method === "DELETE") {
      const id=Number(new URL(request.url).searchParams.get("id")); if(!id) return error("ID inválido.");
      if(resource==="students") { await env.DB.prepare("DELETE FROM workout_assignments WHERE student_id=?").bind(id).run(); await env.DB.prepare("DELETE FROM workout_completions WHERE user_id=?").bind(id).run(); await env.DB.prepare("DELETE FROM diet_items WHERE user_id=?").bind(id).run(); await env.DB.prepare("DELETE FROM payments WHERE user_id=?").bind(id).run(); await env.DB.prepare("DELETE FROM users WHERE id=? AND role='student'").bind(id).run(); }
      else await env.DB.prepare("DELETE FROM exercises WHERE id=?").bind(id).run();
      return json({ok:true});
    }
    if (resource === "assignments" && method === "GET") {
      const studentId=Number(new URL(request.url).searchParams.get("studentId"));
      const r=await env.DB.prepare("SELECT id,student_id AS studentId,weekday,exercise_id AS exerciseId,sort_order AS sortOrder FROM workout_assignments WHERE student_id=? ORDER BY weekday,sort_order,id").bind(studentId).all(); return json({items:r.results});
    }
    if (resource === "assignments" && method === "POST") {
      const body:any=await request.json(); const studentId=Number(body.studentId); const weekday=Number(body.weekday); const ids=(body.exerciseIds||[]).map(Number);
      if(!studentId || weekday<0 || weekday>6) return error("Aluno ou dia inválido.");
      await env.DB.prepare("DELETE FROM workout_assignments WHERE student_id=? AND weekday=?").bind(studentId,weekday).run();
      for(let i=0;i<ids.length;i++) await env.DB.prepare("INSERT INTO workout_assignments(student_id,weekday,exercise_id,sort_order) VALUES(?,?,?,?)").bind(studentId,weekday,ids[i],i).run();
      return json({ok:true});
    }

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
