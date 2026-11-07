-- Execute no D1 EXISTENTE. Não apaga usuários, pagamentos, dietas, treinos, consultorias ou exercícios.
PRAGMA foreign_keys=ON;
CREATE TABLE IF NOT EXISTS plan_pix_config (
 plan_id INTEGER PRIMARY KEY,
 pix_key TEXT NOT NULL DEFAULT '', pix_type TEXT NOT NULL DEFAULT 'Aleatória',recipient_name TEXT NOT NULL DEFAULT '',
 instructions TEXT NOT NULL DEFAULT 'Copie a chave Pix, efetue o pagamento e envie o comprovante nesta tela.',
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY(plan_id) REFERENCES plans(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS plan_requests (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 student_id INTEGER NOT NULL, plan_id INTEGER NOT NULL, plan_name TEXT NOT NULL, price REAL NOT NULL,
 duration_days INTEGER NOT NULL, pix_key_snapshot TEXT NOT NULL DEFAULT '',recipient_snapshot TEXT NOT NULL DEFAULT '',
 status TEXT NOT NULL DEFAULT 'AWAITING_PROOF' CHECK(status IN ('AWAITING_PROOF','PROOF_SENT','APPROVED','REJECTED','CANCELLED')),
 proof_key TEXT,proof_mime TEXT,proof_name TEXT, requested_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 proof_sent_at TEXT,decided_at TEXT,decided_by INTEGER,decision_note TEXT,activated_until TEXT,
 FOREIGN KEY(student_id) REFERENCES users(id) ON DELETE CASCADE,FOREIGN KEY(plan_id) REFERENCES plans(id)
);
CREATE INDEX IF NOT EXISTS idx_plan_requests_status ON plan_requests(status,requested_at);
CREATE INDEX IF NOT EXISTS idx_plan_requests_student ON plan_requests(student_id,id);
CREATE TABLE IF NOT EXISTS student_plan_access (
 student_id INTEGER PRIMARY KEY, plan_id INTEGER NOT NULL,request_id INTEGER NOT NULL,
 activated_at TEXT NOT NULL,expires_at TEXT NOT NULL,
 FOREIGN KEY(student_id) REFERENCES users(id) ON DELETE CASCADE,
 FOREIGN KEY(plan_id) REFERENCES plans(id),FOREIGN KEY(request_id) REFERENCES plan_requests(id)
);
CREATE TABLE IF NOT EXISTS app_settings (
 id INTEGER PRIMARY KEY CHECK(id=1), brand_name TEXT NOT NULL DEFAULT 'Wagner Noronha',
 logo_url TEXT NOT NULL DEFAULT '/brand/logo-wagner.png',
 hero_image_url TEXT NOT NULL DEFAULT '/brand/wagner-hero.jpg',
 inside_image_url TEXT NOT NULL DEFAULT '/brand/wagner-retrato.jpg',
 hero_title TEXT NOT NULL DEFAULT 'Seu potencial. Sua evolução.',
 hero_subtitle TEXT NOT NULL DEFAULT 'Treinos personalizados, acompanhamento de verdade e uma rotina feita para seus resultados.',
 consultation_pix_key TEXT NOT NULL DEFAULT '', consultation_pix_recipient TEXT NOT NULL DEFAULT '',
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT OR IGNORE INTO app_settings(id) VALUES(1);
CREATE TABLE IF NOT EXISTS consultation_manual_proofs (
 request_id INTEGER PRIMARY KEY,proof_key TEXT,proof_mime TEXT,proof_name TEXT,
 sent_at TEXT,reviewed_at TEXT,reviewed_by INTEGER,decision_note TEXT,
 FOREIGN KEY(request_id) REFERENCES consultation_requests(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS admin_audit (
 id INTEGER PRIMARY KEY AUTOINCREMENT,admin_id INTEGER,action TEXT NOT NULL,entity_id INTEGER,
 detail TEXT,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT OR IGNORE INTO plan_pix_config(plan_id)
 SELECT id FROM plans;
