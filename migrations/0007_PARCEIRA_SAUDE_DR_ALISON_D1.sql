-- 0007 | Wagner Noronha - Integracao Dr. Alison | Execute UMA VEZ no D1 EXISTENTE, depois do 0005.
-- Mantem usuarios, treinos, pagamentos e pedidos existentes. Nao altera a tabela users (CHECK de papeis antigos).
PRAGMA foreign_keys=ON;
CREATE TABLE IF NOT EXISTS doctor_accounts (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 name TEXT NOT NULL, email TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL,
 crm TEXT NOT NULL DEFAULT 'CRM-AM 6678', active INTEGER NOT NULL DEFAULT 1,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS doctor_public_info (
 id INTEGER PRIMARY KEY CHECK(id=1),
 name TEXT NOT NULL DEFAULT 'Dr. Alison Martins', crm TEXT NOT NULL DEFAULT 'CRM-AM 6678',
 title TEXT NOT NULL DEFAULT 'Tratamento médico da obesidade e emagrecimento',
 whatsapp TEXT NOT NULL DEFAULT '5592991177221', discount_percent INTEGER NOT NULL DEFAULT 10,
 instagram TEXT NOT NULL DEFAULT 'https://www.instagram.com/dr.alison_martins?obrf=NDU5ODZnbmVkcXBk',
 facebook TEXT NOT NULL DEFAULT 'https://www.facebook.com/share/19rAPEqTnw/?mibextid=wwXIfr',
 website TEXT NOT NULL DEFAULT 'https://dr-alisonmartins.com.br',
 articles TEXT NOT NULL DEFAULT 'https://dr-alisonmartins.com.br/artigos/index.html',
 enabled INTEGER NOT NULL DEFAULT 1,updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT OR IGNORE INTO doctor_public_info(id) VALUES(1);
CREATE TABLE IF NOT EXISTS doctor_patient_links (
 id INTEGER PRIMARY KEY AUTOINCREMENT, doctor_id INTEGER NOT NULL, student_id INTEGER NOT NULL,
 status TEXT NOT NULL CHECK(status IN ('ACTIVE','REVOKED')) DEFAULT 'ACTIVE',
 consented_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, revoked_at TEXT,
 UNIQUE(doctor_id,student_id),
 FOREIGN KEY(doctor_id) REFERENCES doctor_accounts(id),
 FOREIGN KEY(student_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_doctor_links_doctor ON doctor_patient_links(doctor_id,status);
CREATE TABLE IF NOT EXISTS medical_food_plans (
 id INTEGER PRIMARY KEY AUTOINCREMENT, doctor_id INTEGER NOT NULL, student_id INTEGER NOT NULL,
 title TEXT NOT NULL, overview TEXT NOT NULL DEFAULT '', meals_json TEXT NOT NULL DEFAULT '[]',
 status TEXT NOT NULL DEFAULT 'DRAFT' CHECK(status IN ('DRAFT','PUBLISHED')),
 version INTEGER NOT NULL DEFAULT 1,
 pdf_key TEXT,pdf_name TEXT,pdf_mime TEXT,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 published_at TEXT,
 FOREIGN KEY(doctor_id) REFERENCES doctor_accounts(id),
 FOREIGN KEY(student_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_medical_plans_student ON medical_food_plans(student_id,status,published_at);
CREATE INDEX IF NOT EXISTS idx_medical_plans_doctor ON medical_food_plans(doctor_id,student_id);
-- Criacao inicial sem sobrescrever futuras trocas de senha ao reaplicar o script.
INSERT OR IGNORE INTO doctor_accounts(name,email,password_hash,crm,active)
 VALUES('Dr. Alison Martins','alisonmartins@gmail.com','39affce6-1dd6-443c-b3e0-b783edc57137.fIj8bUNHI46H3DSliMOMPV4b5YwZogZ9uc5n9MJBj0M','CRM-AM 6678',1);
