import {Env,json,fail,hashPassword,verifyPassword,signToken,readUser,ensureActive,storeFile,imageTypes,proofTypes,writeAudit,asText,today,normalizeDate} from '../_lib/core';
type Context={request:Request;env:Env;params:{path?:string|string[]}};
class HttpError extends Error {constructor(public status:number,message:string){super(message);}}
const bad=(message:string,status=400):never=>{throw new HttpError(status,message);};
const auth=(u:any,role?:'admin'|'student'|'doctor')=>{if(!u)bad('Faça login para continuar.',401);if(role&&u.role!==role)bad('Acesso não autorizado.',403);return u;};
const pathFrom=(p:Context['params'])=>'/api/'+(Array.isArray(p.path)?p.path.join('/'):p.path||'');
const sid=(n:string)=>{const v=Number(n);if(!Number.isSafeInteger(v)||v<=0)bad('Identificador inválido.');return v;};
const data=async (req:Request)=>{try{return await req.json()}catch{bad('Envie dados JSON válidos.');}};
const fetchPlan=async (env:Env,id:number)=>env.DB.prepare('SELECT id,name,price,period,duration_days AS durationDays,description,active FROM plans WHERE id=?').bind(id).first();
const fetchPix=async(env:Env,id:number)=>env.DB.prepare('SELECT plan_id AS planId,pix_key AS pixKey,pix_type AS pixType,recipient_name AS recipientName,instructions FROM plan_pix_config WHERE plan_id=?').bind(id).first();
const getSettings=async(env:Env)=>env.DB.prepare('SELECT brand_name AS brandName,logo_url AS logoUrl,hero_image_url AS heroImageUrl,inside_image_url AS insideImageUrl,hero_title AS heroTitle,hero_subtitle AS heroSubtitle,consultation_pix_key AS consultationPixKey,consultation_pix_recipient AS consultationPixRecipient FROM app_settings WHERE id=1').first();
const publicDoctor=async(env:Env)=>env.DB.prepare('SELECT name,crm,title,whatsapp,discount_percent AS discountPercent,instagram,facebook,website,articles,enabled FROM doctor_public_info WHERE id=1').first();
const hasDoctorLink=async(env:Env,doctorId:number,studentId:number)=>!!await env.DB.prepare("SELECT id FROM doctor_patient_links WHERE doctor_id=? AND student_id=? AND status='ACTIVE'").bind(doctorId,studentId).first();
const doctorForStudent=async(env:Env)=>env.DB.prepare('SELECT id FROM doctor_accounts WHERE active=1 ORDER BY id LIMIT 1').first();
const doctorPlans=async(env:Env,where:string,args:any[])=>env.DB.prepare(`SELECT p.id,p.doctor_id AS doctorId,p.student_id AS studentId,u.name AS studentName,p.title,p.overview,p.meals_json AS mealsJson,p.status,p.version,p.pdf_name AS pdfName,p.published_at AS publishedAt,p.created_at AS createdAt,p.updated_at AS updatedAt FROM medical_food_plans p JOIN users u ON u.id=p.student_id ${where} ORDER BY p.id DESC`).bind(...args).all();
const getRequests=async(env:Env,where='',args:any[]=[])=>env.DB.prepare(`SELECT r.id,r.student_id AS studentId,u.name AS studentName,u.email AS studentEmail,u.phone AS studentPhone,r.plan_id AS planId,r.plan_name AS planName,r.price,r.duration_days AS durationDays,r.pix_key_snapshot AS pixKey,r.recipient_snapshot AS recipientName,r.status,r.proof_name AS proofName,r.requested_at AS requestedAt,r.proof_sent_at AS proofSentAt,r.decided_at AS decidedAt,r.decision_note AS decisionNote,r.activated_until AS activatedUntil FROM plan_requests r JOIN users u ON u.id=r.student_id ${where} ORDER BY r.id DESC`).bind(...args).all();
const sendPrivateFile=async(env:Env,key:string,mime:string,name:string)=>{if(!key.startsWith('private/proofs/'))return fail('Arquivo inválido.',403);const obj=await env.MEDIA.get(key);if(!obj)return fail('Comprovante não encontrado.',404);return new Response(obj.body,{headers:{'content-type':mime||'application/octet-stream','content-disposition':`inline; filename="${String(name||'comprovante').replace(/["\r\n]/g,'_')}"`,'cache-control':'no-store','x-content-type-options':'nosniff'}});};
const parseProof=async(req:Request,env:Env,ownerId:number,kind:string)=>{const form=await req.formData();const file=form.get('file');if(!(file instanceof File))bad('Selecione o comprovante.');try{return await storeFile(env,file,`private/proofs/${kind}/${ownerId}`,proofTypes,8*1024*1024)}catch(e:any){bad(e.message||'Arquivo inválido.');}};
const safeDate=(value:string)=>{const dt=new Date(value);return Number.isFinite(dt.getTime())?dt.toISOString():null;};
const isStudent=(u:any)=>u?.role==='student';
const checkPlanStatus=async(env:Env,u:any)=>{const active=await ensureActive(env,u);return {active,subscriptionStatus:active?'ACTIVE':'INACTIVE',subscriptionUntil:u.subscription_until};};

export const onRequest=async ({request,env,params}:Context):Promise<Response>=>{
 const path=pathFrom(params);const method=request.method.toUpperCase();const url=new URL(request.url); const seg=path.split('/').filter(Boolean);
 try{
  if(path==='/api/health')return json({ok:true,service:'Wagner Noronha - PWA Pix Manual 4.0',asaas:false});
  if(path==='/api/public/settings'&&method==='GET'){
   const s=await getSettings(env);return json({settings:{brandName:s.brandName,logoUrl:s.logoUrl,heroImageUrl:s.heroImageUrl,insideImageUrl:s.insideImageUrl,heroTitle:s.heroTitle,heroSubtitle:s.heroSubtitle}});
  }
  if(path==='/api/public/doctor'&&method==='GET')return json({doctor:await publicDoctor(env)});
  if(path==='/api/public/plans'&&method==='GET'){
   const rows=await env.DB.prepare('SELECT id,name,price,period,duration_days AS durationDays,description FROM plans WHERE active=1 ORDER BY price,id').all();return json({plans:rows.results});
  }
  if(path==='/api/setup/status'&&method==='GET'){
   const r=await env.DB.prepare("SELECT id FROM users WHERE role='admin' LIMIT 1").first();return json({configured:!!r});
  }
  if(path==='/api/setup/admin'&&method==='POST'){
   if(!env.SETUP_TOKEN||request.headers.get('x-setup-token')!==env.SETUP_TOKEN)bad('Token de configuração inválido.',403);
   const existing=await env.DB.prepare("SELECT id FROM users WHERE role='admin' LIMIT 1").first();if(existing)bad('Administrador já configurado.',409);
   const b=await data(request);if(!b.name||!String(b.email).includes('@')||String(b.password||'').length<8)bad('Informe nome, e-mail e senha de pelo menos 8 caracteres.');
   await env.DB.prepare("INSERT INTO users(name,email,password_hash,role,subscription_status) VALUES(?,?,?,'admin','ACTIVE')").bind(asText(b.name,120),asText(b.email,180).toLowerCase(),await hashPassword(b.password)).run();return json({ok:true},201);
  }
  if(path==='/api/auth/register'&&method==='POST'){
   const b=await data(request);const name=asText(b.name,120),email=asText(b.email,180).toLowerCase(),cpf=asText(b.cpf,20).replace(/\D/g,''),phone=asText(b.phone,22);
   if(name.length<3||!email.includes('@')||String(b.password||'').length<8||cpf.length!==11)bad('Preencha nome, e-mail, CPF com 11 dígitos e senha de ao menos 8 caracteres.');
   try{const r=await env.DB.prepare("INSERT INTO users(name,email,password_hash,role,cpf,phone,subscription_status) VALUES(?,?,?,'student',?,?,'INACTIVE') RETURNING id").bind(name,email,await hashPassword(b.password),cpf,phone).first();const token=await signToken({id:r.id,role:'student'},env.JWT_SECRET);return json({token,user:{id:r.id,name,email,role:'student',subscriptionStatus:'INACTIVE'}},201);}catch{bad('Este e-mail já está cadastrado.',409);}
  }
  if(path==='/api/auth/login'&&method==='POST'){
   const b=await data(request);const email=asText(b.email,180).toLowerCase(),password=String(b.password||'');
   const doctor=await env.DB.prepare('SELECT id,name,email,password_hash,profile_image_url AS profile_image_url FROM doctor_accounts WHERE email=? AND active=1').bind(email).first();
   if(doctor&&await verifyPassword(password,doctor.password_hash))return json({token:await signToken({id:doctor.id,role:'doctor'},env.JWT_SECRET),user:{id:doctor.id,name:doctor.name,email:doctor.email,role:'doctor',profileImageUrl:doctor.profile_image_url||null,subscriptionStatus:'ACTIVE'}});
   const u=await env.DB.prepare('SELECT id,name,email,role,password_hash,subscription_status,subscription_until FROM users WHERE email=?').bind(email).first();
   if(!u||!await verifyPassword(password,u.password_hash))bad('E-mail ou senha incorretos.',401);
   const a=await checkPlanStatus(env,u);return json({token:await signToken({id:u.id,role:u.role},env.JWT_SECRET),user:{id:u.id,name:u.name,email:u.email,role:u.role,subscriptionStatus:a.subscriptionStatus,subscriptionUntil:a.subscriptionUntil}});
  }
  const user=await readUser(request,env);auth(user);
  if(path==='/api/me'&&method==='GET'&&user.role==='doctor')return json({user:{id:user.id,name:user.name,email:user.email,role:'doctor',profileImageUrl:user.profile_image_url||null,subscriptionStatus:'ACTIVE'}});
  if(path==='/api/me'&&method==='GET'){
   const v=await checkPlanStatus(env,user);const access=await env.DB.prepare('SELECT a.plan_id AS planId,p.name AS planName,a.expires_at AS expiresAt FROM student_plan_access a JOIN plans p ON p.id=a.plan_id WHERE a.student_id=?').bind(user.id).first();
   let photo=null;try{const rr=await env.DB.prepare('SELECT profile_image_url FROM users WHERE id=?').bind(user.id).first();photo=rr?.profile_image_url||null;}catch{}
   return json({user:{id:user.id,name:user.name,email:user.email,role:user.role,phone:user.phone,profileImageUrl:photo,subscriptionStatus:v.subscriptionStatus,subscriptionUntil:user.subscription_until,activePlan:access}});
  }
  if(path==='/api/account/password'&&method==='POST'){
   const b=await data(request);const r=await env.DB.prepare(`SELECT password_hash FROM ${user.role==='doctor'?'doctor_accounts':'users'} WHERE id=?`).bind(user.id).first();if(!await verifyPassword(String(b.currentPassword||''),r.password_hash))bad('Senha atual incorreta.',403);if(String(b.newPassword||'').length<8)bad('A nova senha precisa ter pelo menos 8 caracteres.');
   await env.DB.prepare(`UPDATE ${user.role==='doctor'?'doctor_accounts':'users'} SET password_hash=? WHERE id=?`).bind(await hashPassword(String(b.newPassword)),user.id).run();return json({ok:true});
  }
  if(path==='/api/student/profile-photo'&&method==='POST'){
   auth(user,'student');const fd=await request.formData();const file=fd.get('file');if(!(file instanceof File))bad('Selecione sua foto.');let f;try{f=await storeFile(env,file,`profiles/${user.id}`,imageTypes);}catch(e:any){bad(e.message);}
   const photo=`/media/${encodeURIComponent(f.key)}`;await env.DB.prepare('UPDATE users SET profile_image_url=? WHERE id=?').bind(photo,user.id).run();return json({url:photo});
  }
  // Portal médico: acesso exclusivo com vínculo concedido pelo próprio aluno.
  if(path==='/api/student/doctor-link'&&method==='GET'){
    auth(user,'student');const dr=await doctorForStudent(env);const link=dr?await env.DB.prepare('SELECT status,consented_at AS consentedAt,revoked_at AS revokedAt FROM doctor_patient_links WHERE doctor_id=? AND student_id=?').bind(dr.id,user.id).first():null;
    return json({linked:link?.status==='ACTIVE',consentedAt:link?.consentedAt||null});
  }
  if(path==='/api/student/doctor-link'&&method==='POST'){
    auth(user,'student');const b=await data(request);const dr=await doctorForStudent(env);if(!dr)bad('Médico ainda não configurado.',404);
    if(b.consent===true){await env.DB.prepare("INSERT INTO doctor_patient_links(doctor_id,student_id,status,consented_at,revoked_at) VALUES(?,?,'ACTIVE',CURRENT_TIMESTAMP,NULL) ON CONFLICT(doctor_id,student_id) DO UPDATE SET status='ACTIVE',consented_at=CURRENT_TIMESTAMP,revoked_at=NULL").bind(dr.id,user.id).run();}
    else if(b.consent===false){await env.DB.prepare("UPDATE doctor_patient_links SET status='REVOKED',revoked_at=CURRENT_TIMESTAMP WHERE doctor_id=? AND student_id=?").bind(dr.id,user.id).run();}
    else bad('Confirme sua decisão de autorização.');return json({ok:true,linked:b.consent===true});
  }
  if(path==='/api/student/medical-plans'&&method==='GET'){
    auth(user,'student');const rows=await doctorPlans(env,"WHERE p.student_id=? AND p.status='PUBLISHED'",[user.id]);return json({items:rows.results});
  }
  if(path==='/api/doctor/patients'&&method==='GET'){
    auth(user,'doctor');const rows=await env.DB.prepare("SELECT u.id,u.name,u.email,l.consented_at AS consentedAt FROM doctor_patient_links l JOIN users u ON u.id=l.student_id WHERE l.doctor_id=? AND l.status='ACTIVE' AND u.role='student' ORDER BY u.name").bind(user.id).all();return json({items:rows.results});
  }
  if(path==='/api/doctor/plans'&&method==='GET'){
    auth(user,'doctor');const rows=await doctorPlans(env,"JOIN doctor_patient_links l ON l.doctor_id=p.doctor_id AND l.student_id=p.student_id AND l.status='ACTIVE' WHERE p.doctor_id=?",[user.id]);return json({items:rows.results});
  }
  if(path==='/api/doctor/plans'&&method==='POST'){
    auth(user,'doctor');const b=await data(request),studentId=sid(String(b.studentId));if(!await hasDoctorLink(env,user.id,studentId))bad('Paciente não autorizou o vínculo com este médico.',403);
    const title=asText(b.title,140),overview=asText(b.overview,4000);if(title.length<3)bad('Informe o título do plano.');const meals=Array.isArray(b.meals)?b.meals:[];if(meals.length>15)bad('Limite de 15 refeições.');
    const clean=meals.map((m:any)=>({time:asText(m.time,12),title:asText(m.title,110),description:asText(m.description,2200)})).filter((m:any)=>m.title);
    const version=await env.DB.prepare('SELECT COALESCE(MAX(version),0)+1 AS n FROM medical_food_plans WHERE doctor_id=? AND student_id=?').bind(user.id,studentId).first();
    const r=await env.DB.prepare("INSERT INTO medical_food_plans(doctor_id,student_id,title,overview,meals_json,version,status) VALUES(?,?,?,?,?,?,'DRAFT') RETURNING id").bind(user.id,studentId,title,overview,JSON.stringify(clean),version.n).first();return json({ok:true,id:r.id},201);
  }
  if(seg[0]==='api'&&seg[1]==='doctor'&&seg[2]==='plans'&&seg[3]&&seg[4]==='publish'&&method==='POST'){
    auth(user,'doctor');const id=sid(seg[3]);const r=await env.DB.prepare("SELECT id,student_id AS studentId,status,title,overview,meals_json AS mealsJson,pdf_key AS pdfKey FROM medical_food_plans WHERE id=? AND doctor_id=?").bind(id,user.id).first();
    if(!r)bad('Plano não encontrado.',404);if(!await hasDoctorLink(env,user.id,r.studentId))bad('Vínculo não autorizado.',403);
    if(r.status!=='DRAFT')bad('Plano já publicado e preservado no histórico.',409);
    if(!r.overview&&!r.pdfKey&&JSON.parse(r.mealsJson||'[]').length===0)bad('Inclua orientações, refeições ou anexo antes de publicar.');
    await env.DB.prepare("UPDATE medical_food_plans SET status='PUBLISHED',published_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=? AND status='DRAFT'").bind(id).run();return json({ok:true});
  }
  if(seg[0]==='api'&&seg[1]==='doctor'&&seg[2]==='plans'&&seg[3]&&method==='PUT'&&seg.length===4){
    auth(user,'doctor');const id=sid(seg[3]);const r=await env.DB.prepare('SELECT student_id AS studentId,status FROM medical_food_plans WHERE id=? AND doctor_id=?').bind(id,user.id).first();if(!r)bad('Plano não encontrado.',404);if(!await hasDoctorLink(env,user.id,r.studentId))bad('Vínculo não autorizado.',403);if(r.status!=='DRAFT')bad('Crie nova versão para alterar um plano já publicado.',409);
    const b=await data(request),title=asText(b.title,140),overview=asText(b.overview,4000),meals=Array.isArray(b.meals)?b.meals:[];if(title.length<3||meals.length>15)bad('Título inválido ou mais de 15 refeições.');const clean=meals.map((m:any)=>({time:asText(m.time,12),title:asText(m.title,110),description:asText(m.description,2200)})).filter((m:any)=>m.title);
    await env.DB.prepare('UPDATE medical_food_plans SET title=?,overview=?,meals_json=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').bind(title,overview,JSON.stringify(clean),id).run();return json({ok:true});
  }
  if(seg[0]==='api'&&seg[1]==='doctor'&&seg[2]==='plans'&&seg[3]&&seg[4]==='pdf'&&method==='POST'){
    auth(user,'doctor');const id=sid(seg[3]);const r=await env.DB.prepare('SELECT student_id AS studentId,status,pdf_key AS pdfKey FROM medical_food_plans WHERE id=? AND doctor_id=?').bind(id,user.id).first();if(!r)bad('Plano não encontrado.',404);if(!await hasDoctorLink(env,user.id,r.studentId))bad('Vínculo não autorizado.',403);if(r.status!=='DRAFT')bad('Plano publicado não pode ser alterado.',409);
    const form=await request.formData(),file=form.get('file');if(!(file instanceof File)||file.type!=='application/pdf')bad('Envie um PDF válido.');let f;try{f=await storeFile(env,file,`private/medical-plans/${user.id}/${r.studentId}`,['application/pdf'],10*1048576);}catch(e:any){bad(e.message);}
    await env.DB.prepare('UPDATE medical_food_plans SET pdf_key=?,pdf_name=?,pdf_mime=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').bind(f.key,f.name,f.mime,id).run();if(r.pdfKey)await env.MEDIA.delete(r.pdfKey).catch(()=>{});return json({ok:true});
  }
  if(seg[0]==='api'&&seg[1]==='medical'&&seg[2]==='plans'&&seg[3]&&seg[4]==='pdf'&&method==='GET'){
    const id=sid(seg[3]);const r=await env.DB.prepare('SELECT doctor_id AS doctorId,student_id AS studentId,status,pdf_key AS pdfKey,pdf_name AS pdfName FROM medical_food_plans WHERE id=?').bind(id).first();if(!r||!r.pdfKey)bad('Arquivo não encontrado.',404);
    if(user.role==='student'){if(r.studentId!==user.id||r.status!=='PUBLISHED')bad('Arquivo indisponível.',403);}
    else if(user.role==='doctor'){if(r.doctorId!==user.id||!await hasDoctorLink(env,user.id,r.studentId))bad('Arquivo não autorizado.',403);}
    else bad('Informações clínicas restritas ao paciente e médico.',403);
    if(!String(r.pdfKey).startsWith('private/medical-plans/'))bad('Caminho inválido.',403);
    const object=await env.MEDIA.get(r.pdfKey);if(!object)bad('Arquivo PDF não encontrado.',404);
    return new Response(object.body,{headers:{'content-type':'application/pdf','content-disposition':`inline; filename="${String(r.pdfName||'plano.pdf').replace(/["\r\n]/g,'_')}"`,'cache-control':'no-store','x-content-type-options':'nosniff','content-security-policy':"default-src 'none'; sandbox"}});
  }
  // Fluxo de planos escolhido PELO ALUNO, sem checkout/webhook Asaas.
  if(path==='/api/student/requests'&&method==='GET'){
   auth(user,'student');const r=await getRequests(env,'WHERE r.student_id=?',[user.id]);return json({items:r.results});
  }
  if(path==='/api/student/requests'&&method==='POST'){
   auth(user,'student');const b=await data(request);const plan=await fetchPlan(env,sid(String(b.planId)));
   if(!plan||!plan.active)bad('Este plano não está disponível.',404);
   const cfg=await fetchPix(env,plan.id);if(Number(plan.price)>0&&!cfg?.pixKey)bad('O personal ainda não cadastrou a chave Pix deste plano.');
   const existing=await env.DB.prepare("SELECT id,plan_id AS planId,status FROM plan_requests WHERE student_id=? AND status IN ('AWAITING_PROOF','PROOF_SENT') ORDER BY id DESC LIMIT 1").bind(user.id).first();
   if(existing?.status==='PROOF_SENT')bad('Você já enviou um comprovante. Aguarde a conferência do personal.',409);
   if(existing?.planId===plan.id)return json({ok:true,id:existing.id});
   if(existing)await env.DB.prepare("UPDATE plan_requests SET status='CANCELLED' WHERE id=? AND status='AWAITING_PROOF'").bind(existing.id).run();
   const r=await env.DB.prepare("INSERT INTO plan_requests(student_id,plan_id,plan_name,price,duration_days,pix_key_snapshot,recipient_snapshot) VALUES(?,?,?,?,?,?,?) RETURNING id").bind(user.id,plan.id,plan.name,Number(plan.price),Number(plan.durationDays),cfg?.pixKey||'',cfg?.recipientName||'').first();return json({ok:true,id:r.id},201);
  }
  if(seg[0]==='api'&&seg[1]==='student'&&seg[2]==='requests'&&seg[3]&&seg[4]==='proof'){
   auth(user,'student');const id=sid(seg[3]);const r=await env.DB.prepare('SELECT * FROM plan_requests WHERE id=? AND student_id=?').bind(id,user.id).first();if(!r)bad('Solicitação não encontrada.',404);
   if(method==='POST'){
    if(Number(r.price)===0)bad('Este plano é gratuito: aguarde a aprovação do personal.');
    if(!['AWAITING_PROOF','PROOF_SENT'].includes(r.status))bad('Este pedido não aceita comprovantes.',409);
    const f=await parseProof(request,env,user.id,'plan');await env.DB.prepare("UPDATE plan_requests SET proof_key=?,proof_mime=?,proof_name=?,status='PROOF_SENT',proof_sent_at=CURRENT_TIMESTAMP WHERE id=?").bind(f.key,f.mime,f.name,id).run();
    if(r.proof_key)await env.MEDIA.delete(r.proof_key).catch(()=>{});return json({ok:true});
   }
   if(method==='GET'){if(!r.proof_key)bad('Comprovante ainda não enviado.',404);return sendPrivateFile(env,r.proof_key,r.proof_mime,r.proof_name);}
  }
  if(seg[0]==='api'&&seg[1]==='student'&&seg[2]==='requests'&&seg[3]&&seg[4]==='cancel'&&method==='POST'){
   auth(user,'student');const id=sid(seg[3]);const r=await env.DB.prepare("UPDATE plan_requests SET status='CANCELLED' WHERE id=? AND student_id=? AND status='AWAITING_PROOF'").bind(id,user.id).run();if(!r.meta.changes)bad('O pedido não pode mais ser cancelado.',409);return json({ok:true});
  }
  if(path==='/api/student/content'&&method==='GET'){
   auth(user,'student');if(!await ensureActive(env,user))bad('Escolha um plano e aguarde a liberação de acesso.',403);
   const [exercises,tips,diet,assignments,completions]=await Promise.all([
    env.DB.prepare('SELECT id,name,training_category AS trainingCategory,muscle_group AS muscleGroup,level,execution_mode AS executionMode,description,objective,instructions,benefits,common_errors AS commonErrors,equipment,sets,reps,duration,rest,tags,video_url AS videoUrl,image_url AS imageUrl FROM exercises WHERE active=1 ORDER BY id DESC').all(),
    env.DB.prepare('SELECT id,title,description,category,video_url AS videoUrl,image_url AS imageUrl FROM tips WHERE active=1 ORDER BY id DESC').all(),
    env.DB.prepare('SELECT id,time,title,description FROM diet_items WHERE user_id=? ORDER BY sort_order,id').bind(user.id).all(),
    env.DB.prepare('SELECT w.id,w.weekday,w.sort_order AS sortOrder,e.id AS exerciseId,e.name,e.training_category AS trainingCategory,e.muscle_group AS muscleGroup,e.level,e.execution_mode AS executionMode,e.description,e.objective,e.instructions,e.benefits,e.common_errors AS commonErrors,e.equipment,e.sets,e.reps,e.duration,e.rest,e.tags,e.video_url AS videoUrl,e.image_url AS imageUrl FROM workout_assignments w JOIN exercises e ON e.id=w.exercise_id WHERE w.student_id=? AND e.active=1 ORDER BY w.weekday,w.sort_order').bind(user.id).all(),
    env.DB.prepare("SELECT exercise_id AS exerciseId,completed_date AS completedDate FROM workout_completions WHERE user_id=? AND completed_date>=date('now','-30 day')").bind(user.id).all()
   ]);return json({exercises:exercises.results,tips:tips.results,diet:diet.results,assignments:assignments.results,completions:completions.results});
  }
  if(path==='/api/student/workout-complete'&&method==='POST'){
   auth(user,'student');if(!await ensureActive(env,user))bad('Seu plano está inativo.',403);const b=await data(request);const id=sid(String(b.exerciseId));const exercise=await env.DB.prepare('SELECT id FROM exercises WHERE id=? AND active=1').bind(id).first();if(!exercise)bad('Exercício inválido.',404);
   await env.DB.prepare("INSERT OR IGNORE INTO workout_completions(user_id,exercise_id,completed_date) VALUES(?,?,date('now'))").bind(user.id,id).run();return json({ok:true});
  }
  // Consultoria avulsa também sem Asaas; Pix e comprovante validado pelo personal.
  if(path==='/api/student/consultation'&&method==='GET'){
   auth(user,'student');const r=await env.DB.prepare("SELECT c.id,c.status,c.price,c.meeting_url AS meetingUrl,c.requested_at AS requestedAt,c.paid_at AS paidAt,s.starts_at AS selectedStartsAt,m.proof_name AS proofName FROM consultation_requests c LEFT JOIN consultation_slots s ON s.id=c.selected_slot_id LEFT JOIN consultation_manual_proofs m ON m.request_id=c.id WHERE c.student_id=? AND c.status!='CANCELLED' ORDER BY c.id DESC LIMIT 1").bind(user.id).first();
   const slots=r?await env.DB.prepare("SELECT id,starts_at AS startsAt,status FROM consultation_slots WHERE request_id=? AND status!='CANCELLED' ORDER BY starts_at").bind(r.id).all():{results:[]};const s=await getSettings(env);return json({request:r,slots:slots.results,pixKey:s.consultationPixKey,pixRecipient:s.consultationPixRecipient});
  }
  if(path==='/api/student/consultation/request'&&method==='POST'){
   auth(user,'student');const existing=await env.DB.prepare("SELECT id FROM consultation_requests WHERE student_id=? AND status IN ('REQUESTED','AVAILABILITY_SENT','AWAITING_PAYMENT','CONFIRMED') LIMIT 1").bind(user.id).first();if(existing)bad('Já existe uma consultoria em andamento.',409);
   const r=await env.DB.prepare("INSERT INTO consultation_requests(student_id,price,status) VALUES(?,300,'REQUESTED') RETURNING id").bind(user.id).first();return json({ok:true,id:r.id},201);
  }
  if(path==='/api/student/consultation/select'&&method==='POST'){
   auth(user,'student');const b=await data(request);const id=sid(String(b.slotId));const slot=await env.DB.prepare("SELECT s.id,s.request_id,c.student_id,c.status FROM consultation_slots s JOIN consultation_requests c ON c.id=s.request_id WHERE s.id=? AND c.student_id=? AND s.status='AVAILABLE'").bind(id,user.id).first();if(!slot||slot.status!=='AVAILABILITY_SENT')bad('Horário não disponível.',409);
   const s=await getSettings(env);if(!s.consultationPixKey)bad('O personal ainda não cadastrou o Pix da consultoria.');
   await env.DB.batch([env.DB.prepare("UPDATE consultation_slots SET status='SELECTED' WHERE id=?").bind(id),env.DB.prepare("UPDATE consultation_slots SET status='CANCELLED' WHERE request_id=? AND id<>?").bind(slot.request_id,id),env.DB.prepare("UPDATE consultation_requests SET status='AWAITING_PAYMENT',selected_slot_id=?,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(id,slot.request_id)]);return json({ok:true});
  }
  if(path==='/api/student/consultation/proof'&&method==='POST'){
   auth(user,'student');const req=await env.DB.prepare("SELECT id FROM consultation_requests WHERE student_id=? AND status='AWAITING_PAYMENT' ORDER BY id DESC LIMIT 1").bind(user.id).first();if(!req)bad('Não há consultoria aguardando pagamento.',404);const f=await parseProof(request,env,user.id,'consultation');
   const old=await env.DB.prepare('SELECT proof_key FROM consultation_manual_proofs WHERE request_id=?').bind(req.id).first();await env.DB.prepare("INSERT INTO consultation_manual_proofs(request_id,proof_key,proof_mime,proof_name,sent_at) VALUES(?,?,?,?,CURRENT_TIMESTAMP) ON CONFLICT(request_id) DO UPDATE SET proof_key=excluded.proof_key,proof_mime=excluded.proof_mime,proof_name=excluded.proof_name,sent_at=CURRENT_TIMESTAMP").bind(req.id,f.key,f.mime,f.name).run();if(old?.proof_key)await env.MEDIA.delete(old.proof_key).catch(()=>{});return json({ok:true});
  }
  // Painel administrativo
  if(!path.startsWith('/api/admin/'))bad('Endereço não encontrado.',404);auth(user,'admin');
  if(path==='/api/admin/summary'&&method==='GET'){
   const [students,active,requests,consults]=await Promise.all([
    env.DB.prepare("SELECT COUNT(*) n FROM users WHERE role='student'").first(),
    env.DB.prepare("SELECT COUNT(*) n FROM users WHERE role='student' AND subscription_status='ACTIVE' AND (subscription_until IS NULL OR datetime(subscription_until)>datetime('now'))").first(),
    env.DB.prepare("SELECT COUNT(*) n FROM plan_requests WHERE status IN ('AWAITING_PROOF','PROOF_SENT')").first(),
    env.DB.prepare("SELECT COUNT(*) n FROM consultation_requests WHERE status IN ('REQUESTED','AVAILABILITY_SENT','AWAITING_PAYMENT')").first()
   ]);return json({students:students.n,active:active.n,requests:requests.n,consultations:consults.n});
  }
  if(path==='/api/admin/doctor-public'&&method==='GET')return json({doctor:await publicDoctor(env)});
  if(path==='/api/admin/doctor-public'&&method==='PUT'){
    const b=await data(request),whatsapp=String(b.whatsapp||'').replace(/\D/g,'').slice(0,15);
    const links=['instagram','facebook','website','articles'];const safe:any={};for(const k of links){const v=asText(b[k],400);try{if(!['https:'].includes(new URL(v).protocol))bad('Use links HTTPS válidos.');}catch{bad('URL inválida no campo '+k);}safe[k]=v;}
    if(whatsapp.length<10||whatsapp.length>15)bad('WhatsApp com DDI e DDD é obrigatório.');const discount=Number(b.discountPercent);if(!Number.isInteger(discount)||discount<0||discount>100)bad('Percentual inválido.');
    await env.DB.prepare('UPDATE doctor_public_info SET whatsapp=?,discount_percent=?,instagram=?,facebook=?,website=?,articles=?,enabled=?,updated_at=CURRENT_TIMESTAMP WHERE id=1').bind(whatsapp,discount,safe.instagram,safe.facebook,safe.website,safe.articles,b.enabled?1:0).run();return json({ok:true});
  }
  if(path==='/api/admin/settings'&&method==='GET')return json({settings:await getSettings(env)});
  if(path==='/api/admin/settings'&&method==='PUT'){
   const b=await data(request);await env.DB.prepare('UPDATE app_settings SET brand_name=?,hero_title=?,hero_subtitle=?,consultation_pix_key=?,consultation_pix_recipient=?,updated_at=CURRENT_TIMESTAMP WHERE id=1').bind(asText(b.brandName,90),asText(b.heroTitle,150),asText(b.heroSubtitle,420),asText(b.consultationPixKey,160),asText(b.consultationPixRecipient,150)).run();await writeAudit(env,user.id,'UPDATE_SETTINGS',1);return json({ok:true});
  }
  if(seg[0]==='api'&&seg[1]==='admin'&&seg[2]==='branding'&&seg[3]&&method==='POST'){
   const slot=seg[3];const columns:{[k:string]:string}={logo:'logo_url',hero:'hero_image_url',inside:'inside_image_url'};const col=columns[slot];if(!col)bad('Tipo de imagem inválido.');const fd=await request.formData();const file=fd.get('file');if(!(file instanceof File))bad('Selecione uma imagem.');let f;try{f=await storeFile(env,file,slot==='hero'?'public/brand/hero-v42':`public/brand/${slot}`,imageTypes,8*1024*1024)}catch(e:any){bad(e.message);}
   const imageUrl='/media/'+encodeURIComponent(f.key);await env.DB.prepare(`UPDATE app_settings SET ${col}=?,updated_at=CURRENT_TIMESTAMP WHERE id=1`).bind(imageUrl).run();await writeAudit(env,user.id,'UPDATE_BRAND_'+slot,1);return json({ok:true,url:imageUrl});
  }
  if(path==='/api/admin/account'&&method==='PUT'){
   const b=await data(request);const email=asText(b.email,180).toLowerCase(),name=asText(b.name,120);if(!email.includes('@')||!name)bad('Nome e e-mail inválidos.');const current=await env.DB.prepare('SELECT password_hash FROM users WHERE id=?').bind(user.id).first();if(!await verifyPassword(String(b.password||''),current.password_hash))bad('Informe sua senha atual para alterar os dados.',403);
   await env.DB.prepare('UPDATE users SET name=?,email=? WHERE id=?').bind(name,email,user.id).run();return json({ok:true});
  }
  if(path==='/api/admin/plans'&&method==='GET'){
   const rows=await env.DB.prepare('SELECT p.id,p.name,p.price,p.period,p.duration_days AS durationDays,p.description,p.active,COALESCE(x.pix_key,\'\') AS pixKey,COALESCE(x.pix_type,\'Aleatória\') AS pixType,COALESCE(x.recipient_name,\'\') AS recipientName,COALESCE(x.instructions,\'\') AS instructions FROM plans p LEFT JOIN plan_pix_config x ON x.plan_id=p.id ORDER BY p.id').all();return json({items:rows.results});
  }
  if(path==='/api/admin/plans'&&method==='POST'){
   const b=await data(request);const name=asText(b.name,100),price=Number(b.price),days=Number(b.durationDays);if(!name||!Number.isFinite(price)||price<0||!Number.isSafeInteger(days)||days<1||days>3660)bad('Preencha nome, preço e duração do plano.');
   const rr=await env.DB.prepare('INSERT INTO plans(name,price,period,duration_days,description,active) VALUES(?,?,?,?,?,1) RETURNING id').bind(name,price,asText(b.period,30),days,asText(b.description,500)).first();
   await env.DB.prepare('INSERT INTO plan_pix_config(plan_id,pix_key,pix_type,recipient_name,instructions) VALUES(?,?,?,?,?)').bind(rr.id,asText(b.pixKey,160),asText(b.pixType,25),asText(b.recipientName,140),asText(b.instructions,700)).run();await writeAudit(env,user.id,'CREATE_PLAN',rr.id);return json({ok:true,id:rr.id});
  }
  if(seg[0]==='api'&&seg[1]==='admin'&&seg[2]==='plans'&&seg[3]&&method==='PUT'){
   const id=sid(seg[3]);const b=await data(request);const name=asText(b.name,100),price=Number(b.price),days=Number(b.durationDays);if(!name||!Number.isFinite(price)||price<0||!Number.isSafeInteger(days)||days<1||days>3660)bad('Valores do plano inválidos.');
   await env.DB.batch([env.DB.prepare('UPDATE plans SET name=?,price=?,period=?,duration_days=?,description=?,active=? WHERE id=?').bind(name,price,asText(b.period,30),days,asText(b.description,500),b.active?1:0,id),
    env.DB.prepare('INSERT INTO plan_pix_config(plan_id,pix_key,pix_type,recipient_name,instructions,updated_at) VALUES(?,?,?,?,?,CURRENT_TIMESTAMP) ON CONFLICT(plan_id) DO UPDATE SET pix_key=excluded.pix_key,pix_type=excluded.pix_type,recipient_name=excluded.recipient_name,instructions=excluded.instructions,updated_at=CURRENT_TIMESTAMP').bind(id,asText(b.pixKey,160),asText(b.pixType,25),asText(b.recipientName,140),asText(b.instructions,700))]);await writeAudit(env,user.id,'UPDATE_PLAN',id);return json({ok:true});
  }
  if(path==='/api/admin/requests'&&method==='GET')return json({items:(await getRequests(env)).results});
  if(seg[0]==='api'&&seg[1]==='admin'&&seg[2]==='requests'&&seg[3]&&seg[4]==='proof'&&method==='GET'){
   const id=sid(seg[3]);const r=await env.DB.prepare('SELECT proof_key,proof_name,proof_mime FROM plan_requests WHERE id=?').bind(id).first();if(!r?.proof_key)bad('Comprovante não encontrado.',404);return sendPrivateFile(env,r.proof_key,r.proof_mime,r.proof_name);
  }
  if(seg[0]==='api'&&seg[1]==='admin'&&seg[2]==='requests'&&seg[3]&&seg[4]==='decision'&&method==='POST'){
   const id=sid(seg[3]);const b=await data(request);const r=await env.DB.prepare('SELECT * FROM plan_requests WHERE id=?').bind(id).first();if(!r)bad('Solicitação não encontrada.',404);
   const note=asText(b.note,500);
   if(b.action==='REJECT'){
    if(!['AWAITING_PROOF','PROOF_SENT'].includes(r.status))bad('Solicitação já finalizada.',409);
    await env.DB.prepare("UPDATE plan_requests SET status='REJECTED',decided_by=?,decided_at=CURRENT_TIMESTAMP,decision_note=? WHERE id=?").bind(user.id,note||'Comprovante rejeitado.',id).run();await writeAudit(env,user.id,'REJECT_PLAN_REQUEST',id,note);return json({ok:true});
   }
   if(b.action!=='APPROVE')bad('Ação inválida.');
   if(!['AWAITING_PROOF','PROOF_SENT'].includes(r.status))bad('Solicitação já finalizada.',409);
   if(Number(r.price)>0&&(r.status!=='PROOF_SENT'||!r.proof_key))bad('Antes de aprovar, aguarde e confira o comprovante do aluno.',409);
   const now=Date.now();const student=await env.DB.prepare('SELECT subscription_status,subscription_until FROM users WHERE id=?').bind(r.student_id).first();if(!student)bad('Aluno não encontrado.',404);
   const previous=student.subscription_status==='ACTIVE'&&student.subscription_until?Date.parse(student.subscription_until):0;const start=Math.max(now,Number.isFinite(previous)?previous:0);const end=new Date(start+Number(r.duration_days)*86400000).toISOString();
   // D1.batch executa a aprovação e a liberação na mesma transação.
   const result=await env.DB.batch([
    env.DB.prepare("UPDATE plan_requests SET status='APPROVED',decided_by=?,decided_at=CURRENT_TIMESTAMP,decision_note=?,activated_until=? WHERE id=? AND status IN ('AWAITING_PROOF','PROOF_SENT')").bind(user.id,note||'',end,id),
    env.DB.prepare("UPDATE users SET subscription_status='ACTIVE',subscription_until=? WHERE id=? AND EXISTS(SELECT 1 FROM plan_requests WHERE id=? AND status='APPROVED')").bind(end,r.student_id,id),
    env.DB.prepare("INSERT INTO student_plan_access(student_id,plan_id,request_id,activated_at,expires_at) SELECT ?,?,?,CURRENT_TIMESTAMP,? WHERE EXISTS(SELECT 1 FROM plan_requests WHERE id=? AND status='APPROVED') ON CONFLICT(student_id) DO UPDATE SET plan_id=excluded.plan_id,request_id=excluded.request_id,activated_at=CURRENT_TIMESTAMP,expires_at=excluded.expires_at").bind(r.student_id,r.plan_id,id,end,id)
   ]);if(!result[0]?.meta?.changes)bad('Este pedido já foi processado.',409);await writeAudit(env,user.id,'APPROVE_PLAN_REQUEST',id,`student=${r.student_id};plan=${r.plan_id};expires=${end}`);return json({ok:true,expiresAt:end});
  }
  if(path==='/api/admin/students'&&method==='GET'){
   const r=await env.DB.prepare("SELECT u.id,u.name,u.email,u.phone,u.cpf,u.subscription_status AS subscriptionStatus,u.subscription_until AS subscriptionUntil,u.created_at AS createdAt,a.plan_id AS planId,p.name AS planName FROM users u LEFT JOIN student_plan_access a ON a.student_id=u.id LEFT JOIN plans p ON p.id=a.plan_id WHERE u.role='student' ORDER BY u.id DESC").all();return json({items:r.results});
  }
  if(seg[0]==='api'&&seg[1]==='admin'&&seg[2]==='students'&&seg[3]&&method==='DELETE'){
   const id=sid(seg[3]);await env.DB.batch([
    env.DB.prepare('DELETE FROM medical_food_plans WHERE student_id=?').bind(id),env.DB.prepare('DELETE FROM doctor_patient_links WHERE student_id=?').bind(id),env.DB.prepare('DELETE FROM workout_completions WHERE user_id=?').bind(id),env.DB.prepare('DELETE FROM workout_assignments WHERE student_id=?').bind(id),env.DB.prepare('DELETE FROM diet_items WHERE user_id=?').bind(id),env.DB.prepare('DELETE FROM plan_requests WHERE student_id=?').bind(id),env.DB.prepare('DELETE FROM student_plan_access WHERE student_id=?').bind(id),env.DB.prepare('DELETE FROM consultation_manual_proofs WHERE request_id IN (SELECT id FROM consultation_requests WHERE student_id=?)').bind(id),env.DB.prepare('DELETE FROM consultation_slots WHERE request_id IN (SELECT id FROM consultation_requests WHERE student_id=?)').bind(id),env.DB.prepare('DELETE FROM consultation_requests WHERE student_id=?').bind(id),env.DB.prepare('DELETE FROM payments WHERE user_id=?').bind(id),env.DB.prepare("DELETE FROM users WHERE id=? AND role='student'").bind(id)
   ]);await writeAudit(env,user.id,'DELETE_STUDENT',id);return json({ok:true});
  }
  // Conteúdo administrativo e treinos (compatível com os cadastros versão anterior).
  const resources:{[key:string]:{table:string,columns:string[],select:string}}={
   exercises:{table:'exercises',columns:['name','training_category','muscle_group','level','execution_mode','description','objective','instructions','benefits','common_errors','equipment','sets','reps','duration','rest','tags','video_url','image_url','active'],select:'SELECT id,name,training_category AS trainingCategory,muscle_group AS muscleGroup,level,execution_mode AS executionMode,description,objective,instructions,benefits,common_errors AS commonErrors,equipment,sets,reps,duration,rest,tags,video_url AS videoUrl,image_url AS imageUrl,active FROM exercises ORDER BY id DESC'},
   tips:{table:'tips',columns:['title','description','category','video_url','image_url','active'],select:'SELECT id,title,description,category,video_url AS videoUrl,image_url AS imageUrl,active FROM tips ORDER BY id DESC'},
   diets:{table:'diet_items',columns:['user_id','time','title','description','sort_order'],select:'SELECT d.id,d.user_id AS studentId,d.time,d.title,d.description,d.sort_order AS sortOrder,u.name AS studentName,u.email AS studentEmail FROM diet_items d JOIN users u ON u.id=d.user_id ORDER BY d.id DESC'}
  };
  if(path==='/api/admin/upload'&&method==='POST'){
   const fd=await request.formData();const file=fd.get('file');if(!(file instanceof File))bad('Selecione um arquivo.');const types=[...imageTypes,'video/mp4','video/webm','video/quicktime'];let f;try{f=await storeFile(env,file,'public/content',types,95*1048576)}catch(e:any){bad(e.message);}return json({url:'/media/'+encodeURIComponent(f.key)});
  }
  if(seg[0]==='api'&&seg[1]==='admin'&&resources[seg[2]]&&seg.length<=4){
   const resource=resources[seg[2]],id=seg[3]?sid(seg[3]):null;
   if(method==='GET'&&!id)return json({items:(await env.DB.prepare(resource.select).all()).results});
   if(method==='DELETE'&&id){await env.DB.prepare(`DELETE FROM ${resource.table} WHERE id=?`).bind(id).run();await writeAudit(env,user.id,'DELETE_'+seg[2],id);return json({ok:true});}
   if(method==='POST'||method==='PUT'){
    const b=await data(request);let o:any={...b};if(seg[2]==='exercises'){o={name:b.name,training_category:b.trainingCategory||'Musculação',muscle_group:b.muscleGroup||null,level:b.level||'Iniciante',execution_mode:b.executionMode||'Repetições',description:b.description||null,objective:b.objective||null,instructions:b.instructions||null,benefits:b.benefits||null,common_errors:b.commonErrors||null,equipment:b.equipment||null,sets:Number(b.sets||0),reps:b.reps||null,duration:b.duration||null,rest:b.rest||null,tags:b.tags||null,video_url:b.videoUrl||null,image_url:b.imageUrl||null,active:b.active===false?0:1};}
    if(seg[2]==='tips')o={title:b.title,description:b.description||null,category:b.category||null,video_url:b.videoUrl||null,image_url:b.imageUrl||null,active:b.active===false?0:1};
    if(seg[2]==='diets'){const u=await env.DB.prepare("SELECT id FROM users WHERE email=? AND role='student'").bind(asText(b.studentEmail,180).toLowerCase()).first();if(!u)bad('Aluno não encontrado pelo e-mail informado.',404);o={user_id:u.id,time:b.time||null,title:b.title,description:b.description||null,sort_order:Number(b.sortOrder||0)};}
    if(!o.name&&!o.title)bad('Informe o título ou nome.');
    const cols=resource.columns,vals=cols.map(c=>o[c]??null);if(method==='POST'){
     const row=await env.DB.prepare(`INSERT INTO ${resource.table}(${cols.join(',')}) VALUES(${cols.map(()=>'?').join(',')}) RETURNING id`).bind(...vals).first();await writeAudit(env,user.id,'CREATE_'+seg[2],row.id);return json({ok:true,id:row.id});
    }if(!id)bad('Identificador obrigatório.');await env.DB.prepare(`UPDATE ${resource.table} SET ${cols.map(c=>c+'=?').join(',')} WHERE id=?`).bind(...vals,id).run();await writeAudit(env,user.id,'UPDATE_'+seg[2],id);return json({ok:true});
   }
  }
  if(path==='/api/admin/assignments'&&method==='GET'){
   const studentId=sid(url.searchParams.get('studentId')||'');const rows=await env.DB.prepare('SELECT id,student_id AS studentId,weekday,exercise_id AS exerciseId,sort_order AS sortOrder FROM workout_assignments WHERE student_id=? ORDER BY weekday,sort_order').bind(studentId).all();return json({items:rows.results});
  }
  if(path==='/api/admin/assignments'&&method==='POST'){
   const b=await data(request);const id=sid(String(b.studentId)),day=Number(b.weekday),ids=Array.isArray(b.exerciseIds)?b.exerciseIds.map((x:any)=>sid(String(x))):[];if(!Number.isInteger(day)||day<0||day>6||ids.length>70)bad('Dia ou lista inválidos.');
   const statements=[env.DB.prepare('DELETE FROM workout_assignments WHERE student_id=? AND weekday=?').bind(id,day),...ids.map((n:number,i:number)=>env.DB.prepare('INSERT INTO workout_assignments(student_id,weekday,exercise_id,sort_order) VALUES(?,?,?,?)').bind(id,day,n,i))];await env.DB.batch(statements);await writeAudit(env,user.id,'SAVE_ASSIGNMENTS',id,`weekday=${day}`);return json({ok:true});
  }
  if(path==='/api/admin/consultations'&&method==='GET'){
   const rows=await env.DB.prepare('SELECT c.id,c.student_id AS studentId,u.name AS studentName,u.email AS studentEmail,u.phone,c.status,c.price,c.meeting_url AS meetingUrl,c.requested_at AS requestedAt,s.starts_at AS selectedStartsAt,m.proof_name AS proofName,m.sent_at AS proofSentAt FROM consultation_requests c JOIN users u ON u.id=c.student_id LEFT JOIN consultation_slots s ON s.id=c.selected_slot_id LEFT JOIN consultation_manual_proofs m ON m.request_id=c.id ORDER BY c.id DESC').all();
   for(const r of rows.results as any[]){r.slots=(await env.DB.prepare('SELECT id,starts_at AS startsAt,status FROM consultation_slots WHERE request_id=? ORDER BY starts_at').bind(r.id).all()).results;}return json({items:rows.results});
  }
  if(path==='/api/admin/consultations/slots'&&method==='POST'){
   const b=await data(request);const id=sid(String(b.requestId));const cr=await env.DB.prepare('SELECT status FROM consultation_requests WHERE id=?').bind(id).first();if(!cr||!['REQUESTED','AVAILABILITY_SENT'].includes(cr.status))bad('Consultoria não pode receber horários.',409);
   const slots=Array.isArray(b.slots)?b.slots.map((x:string)=>asText(x,35)).filter(Boolean):[];if(!slots.length||slots.length>20||slots.some((x:string)=>!safeDate(x)))bad('Informe de 1 a 20 horários válidos.');
   const columns=await env.DB.prepare('PRAGMA table_info(consultation_slots)').all();const legacy=columns.results.some((x:any)=>x.name==='available_date')&&columns.results.some((x:any)=>x.name==='available_time');
   const queries=[env.DB.prepare("DELETE FROM consultation_slots WHERE request_id=? AND status='AVAILABLE'").bind(id),...slots.map((x:string)=>legacy?env.DB.prepare("INSERT INTO consultation_slots(request_id,available_date,available_time,starts_at,status) VALUES(?,?,?,?,'AVAILABLE')").bind(id,x.slice(0,10),x.slice(11,16),x):env.DB.prepare("INSERT INTO consultation_slots(request_id,starts_at,status) VALUES(?,?,'AVAILABLE')").bind(id,x)),env.DB.prepare("UPDATE consultation_requests SET status='AVAILABILITY_SENT' WHERE id=?").bind(id)];await env.DB.batch(queries);return json({ok:true});
  }
  if(seg[0]==='api'&&seg[1]==='admin'&&seg[2]==='consultations'&&seg[3]&&seg[4]==='proof'&&method==='GET'){
   const id=sid(seg[3]);const r=await env.DB.prepare('SELECT proof_key,proof_mime,proof_name FROM consultation_manual_proofs WHERE request_id=?').bind(id).first();if(!r?.proof_key)bad('Comprovante não enviado.',404);return sendPrivateFile(env,r.proof_key,r.proof_mime,r.proof_name);
  }
  if(seg[0]==='api'&&seg[1]==='admin'&&seg[2]==='consultations'&&seg[3]&&seg[4]==='decision'&&method==='POST'){
   const id=sid(seg[3]);const b=await data(request);const r=await env.DB.prepare('SELECT status FROM consultation_requests WHERE id=?').bind(id).first();if(!r)bad('Consultoria não encontrada.',404);
   if(b.action==='APPROVE'){
    if(r.status!=='AWAITING_PAYMENT')bad('Consultoria não está aguardando pagamento.',409);
    const proof=await env.DB.prepare('SELECT proof_key FROM consultation_manual_proofs WHERE request_id=?').bind(id).first();if(!proof?.proof_key)bad('Comprovante não foi enviado.',409);
    await env.DB.prepare("UPDATE consultation_requests SET status='CONFIRMED',payment_status='MANUAL_CONFIRMED',paid_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(id).run();
   }else if(b.action==='MEETING'){
    await env.DB.prepare('UPDATE consultation_requests SET meeting_url=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').bind(asText(b.meetingUrl,400),id).run();
   }else if(b.action==='COMPLETE'){
    if(r.status!=='CONFIRMED')bad('Consultoria não foi confirmada.',409);await env.DB.prepare("UPDATE consultation_requests SET status='COMPLETED' WHERE id=?").bind(id).run();
   }else if(b.action==='CANCEL'){
    if(r.status==='COMPLETED')bad('Atendimento já concluído.',409);await env.DB.prepare("UPDATE consultation_requests SET status='CANCELLED' WHERE id=?").bind(id).run();
   }else bad('Ação desconhecida.');await writeAudit(env,user.id,'CONSULTATION_'+b.action,id);return json({ok:true});
  }
  bad('Endereço não encontrado.',404);
 }catch(e:any){if(e instanceof HttpError)return fail(e.message,e.status);console.error('WN-API',path,e);return fail('Erro interno. Confirme as migrações e configurações do D1/R2.',500);}
};
