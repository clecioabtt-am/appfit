PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS consultation_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'REQUESTED' CHECK(status IN ('REQUESTED','AVAILABILITY_SENT','AWAITING_PAYMENT','CONFIRMED','COMPLETED','CANCELLED')),
  price REAL NOT NULL DEFAULT 300.00,
  selected_slot_id INTEGER,
  asaas_payment_id TEXT UNIQUE,
  payment_status TEXT,
  invoice_url TEXT,
  meeting_url TEXT,
  requested_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  paid_at TEXT,
  FOREIGN KEY(student_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS consultation_slots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  request_id INTEGER NOT NULL,
  starts_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'AVAILABLE' CHECK(status IN ('AVAILABLE','SELECTED','CANCELLED')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(request_id) REFERENCES consultation_requests(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_consultation_student ON consultation_requests(student_id,status);
CREATE INDEX IF NOT EXISTS idx_consultation_payment ON consultation_requests(asaas_payment_id);
CREATE INDEX IF NOT EXISTS idx_consultation_slots_request ON consultation_slots(request_id,starts_at);

UPDATE plans SET description='Treinos, conteúdo e acompanhamento pela plataforma.' WHERE id=1;
UPDATE plans SET description='Acompanhamento por três meses com desconto.' WHERE id=2;
