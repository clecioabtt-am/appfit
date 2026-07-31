
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('admin','student')),
  cpf TEXT,
  phone TEXT,
  asaas_customer_id TEXT,
  subscription_status TEXT NOT NULL DEFAULT 'INACTIVE',
  subscription_until TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS plans (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  price REAL NOT NULL,
  period TEXT NOT NULL,
  duration_days INTEGER NOT NULL,
  description TEXT,
  active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  plan_id INTEGER NOT NULL,
  asaas_payment_id TEXT UNIQUE,
  status TEXT,
  value REAL,
  invoice_url TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(user_id) REFERENCES users(id),
  FOREIGN KEY(plan_id) REFERENCES plans(id)
);

CREATE TABLE IF NOT EXISTS exercises (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  training_category TEXT NOT NULL DEFAULT 'Musculação',
  muscle_group TEXT,
  level TEXT NOT NULL DEFAULT 'Iniciante',
  execution_mode TEXT NOT NULL DEFAULT 'Repetições',
  description TEXT,
  objective TEXT,
  instructions TEXT,
  benefits TEXT,
  common_errors TEXT,
  equipment TEXT,
  sets INTEGER,
  reps TEXT,
  duration TEXT,
  rest TEXT,
  tags TEXT,
  video_url TEXT,
  image_url TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tips (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT,
  video_url TEXT,
  image_url TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS diet_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  time TEXT,
  title TEXT NOT NULL,
  description TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_payments_asaas ON payments(asaas_payment_id);
CREATE INDEX IF NOT EXISTS idx_diet_user ON diet_items(user_id);
CREATE INDEX IF NOT EXISTS idx_exercises_category ON exercises(training_category);

INSERT OR IGNORE INTO plans(id,name,price,period,duration_days,description,active) VALUES
(1,'Plano Mensal',59.90,'mês',30,'Consultoria online, musculação, funcional e dieta personalizada.',1),
(2,'Plano Trimestral',161.70,'trimestre',90,'Acompanhamento completo por três meses com desconto.',1);

INSERT INTO exercises(
  name,training_category,muscle_group,level,execution_mode,description,objective,
  instructions,benefits,common_errors,equipment,sets,reps,duration,rest,tags,active
)
SELECT
  'Agachamento Livre','Musculação','Membros inferiores','Iniciante','Repetições',
  'Exercício composto para pernas, glúteos e core.',
  'Desenvolver força e massa muscular nos membros inferiores.',
  'Posicione os pés na largura dos ombros, mantenha a coluna neutra, desça com controle e retorne contraindo pernas e glúteos.',
  'Fortalece pernas e glúteos e melhora a estabilidade.',
  'Deixar os joelhos entrarem, arredondar a lombar ou retirar os calcanhares do chão.',
  'Barra ou peso corporal',4,'12',NULL,'60–90 seg','força, hipertrofia, pernas',1
WHERE NOT EXISTS(SELECT 1 FROM exercises WHERE name='Agachamento Livre');

INSERT INTO exercises(
  name,training_category,muscle_group,level,execution_mode,description,objective,
  instructions,benefits,common_errors,equipment,sets,reps,duration,rest,tags,active
)
SELECT
  'Burpee','Funcional','Corpo inteiro','Intermediário','Repetições',
  'Exercício funcional que combina agachamento, prancha e salto.',
  'Melhorar resistência cardiovascular, coordenação e potência.',
  'Agache, apoie as mãos, leve os pés para trás, mantenha o abdômen firme, retorne e finalize com salto controlado.',
  'Trabalha o corpo inteiro, eleva o condicionamento e aumenta o gasto energético.',
  'Curvar a lombar, aterrissar sem controle ou executar rápido demais.',
  'Peso corporal',4,'10',NULL,'45 seg','HIIT, resistência, emagrecimento',1
WHERE NOT EXISTS(SELECT 1 FROM exercises WHERE name='Burpee');

INSERT INTO tips(title,description,category,active)
SELECT 'Consistência vence intensidade',
'A evolução vem da execução correta e da frequência ao longo das semanas.',
'Treino',1
WHERE NOT EXISTS(SELECT 1 FROM tips WHERE title='Consistência vence intensidade');
