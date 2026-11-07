-- APENAS PARA BANCOS D1 NOVOS E VAZIOS. NUNCA execute este arquivo se já usa um D1 antigo.
PRAGMA foreign_keys=ON;
CREATE TABLE IF NOT EXISTS users (
 id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE,
 password_hash TEXT NOT NULL,role TEXT NOT NULL CHECK(role IN ('admin','student')),cpf TEXT,phone TEXT,
 asaas_customer_id TEXT, subscription_status TEXT NOT NULL DEFAULT 'INACTIVE',subscription_until TEXT,
 profile_image_url TEXT,trial_used INTEGER DEFAULT 0, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS plans (
 id INTEGER PRIMARY KEY AUTOINCREMENT,name TEXT NOT NULL,price REAL NOT NULL,period TEXT NOT NULL,
 duration_days INTEGER NOT NULL, description TEXT,active INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS payments (
 id INTEGER PRIMARY KEY AUTOINCREMENT,user_id INTEGER NOT NULL,plan_id INTEGER NOT NULL,asaas_payment_id TEXT UNIQUE,
 status TEXT,value REAL,invoice_url TEXT,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY(user_id) REFERENCES users(id),FOREIGN KEY(plan_id) REFERENCES plans(id)
);
CREATE TABLE IF NOT EXISTS exercises (
 id INTEGER PRIMARY KEY AUTOINCREMENT,name TEXT NOT NULL,training_category TEXT NOT NULL DEFAULT 'Musculação',
 muscle_group TEXT,level TEXT NOT NULL DEFAULT 'Iniciante',execution_mode TEXT NOT NULL DEFAULT 'Repetições',
 description TEXT,objective TEXT,instructions TEXT,benefits TEXT,common_errors TEXT,equipment TEXT,
 sets INTEGER,reps TEXT,duration TEXT,rest TEXT,tags TEXT,video_url TEXT,image_url TEXT,
 active INTEGER NOT NULL DEFAULT 1,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS tips (
 id INTEGER PRIMARY KEY AUTOINCREMENT,title TEXT NOT NULL,description TEXT,category TEXT,
 video_url TEXT,image_url TEXT,active INTEGER NOT NULL DEFAULT 1,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS diet_items (
 id INTEGER PRIMARY KEY AUTOINCREMENT,user_id INTEGER NOT NULL,time TEXT,title TEXT NOT NULL,description TEXT,
 sort_order INTEGER NOT NULL DEFAULT 0,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY(user_id) REFERENCES users(id)
);
CREATE TABLE IF NOT EXISTS workout_assignments (
 id INTEGER PRIMARY KEY AUTOINCREMENT,student_id INTEGER NOT NULL,weekday INTEGER NOT NULL CHECK(weekday BETWEEN 0 AND 6),
 exercise_id INTEGER NOT NULL,sort_order INTEGER NOT NULL DEFAULT 0,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY(student_id) REFERENCES users(id) ON DELETE CASCADE,
 FOREIGN KEY(exercise_id) REFERENCES exercises(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS workout_completions (
 id INTEGER PRIMARY KEY AUTOINCREMENT,user_id INTEGER NOT NULL,exercise_id INTEGER NOT NULL,
 completed_date TEXT NOT NULL,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE(user_id,exercise_id,completed_date),FOREIGN KEY(user_id) REFERENCES users(id),
 FOREIGN KEY(exercise_id) REFERENCES exercises(id)
);
CREATE TABLE IF NOT EXISTS consultation_requests (
 id INTEGER PRIMARY KEY AUTOINCREMENT,student_id INTEGER NOT NULL,status TEXT NOT NULL DEFAULT 'REQUESTED'
 CHECK(status IN ('REQUESTED','AVAILABILITY_SENT','AWAITING_PAYMENT','CONFIRMED','COMPLETED','CANCELLED')),
 price REAL NOT NULL DEFAULT 300.00,selected_slot_id INTEGER,asaas_payment_id TEXT UNIQUE,payment_status TEXT,
 invoice_url TEXT,meeting_url TEXT,requested_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,paid_at TEXT,
 FOREIGN KEY(student_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS consultation_slots (
 id INTEGER PRIMARY KEY AUTOINCREMENT,request_id INTEGER NOT NULL,starts_at TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'AVAILABLE' CHECK(status IN ('AVAILABLE','SELECTED','CANCELLED')),
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,FOREIGN KEY(request_id) REFERENCES consultation_requests(id) ON DELETE CASCADE
);
INSERT OR IGNORE INTO plans(id,name,price,period,duration_days,description,active) VALUES
 (1,'Plano Mensal',59.90,'mês',30,'Treinos personalizados e conteúdos exclusivos.',1),
 (2,'Plano Trimestral',161.70,'trimestre',90,'Treinamento e acompanhamento por três meses.',1),
 (3,'Plano Teste',0,'teste',20,'Acesso de teste mediante aprovação do personal.',1);
INSERT INTO exercises(name,training_category,muscle_group,level,execution_mode,description,objective,instructions,benefits,common_errors,equipment,sets,reps,rest,active)
 SELECT 'Agachamento livre','Musculação','Pernas e glúteos','Iniciante','Repetições','Movimento composto com foco em membros inferiores.','Melhorar força.','Mantenha o tronco estável e execute com controle.','Força e condicionamento.','Evite curvar excessivamente a lombar.','Peso corporal ou barra',4,'12','60 s',1
 WHERE NOT EXISTS(SELECT 1 FROM exercises);
