-- 0009 | Wagner Noronha - chat de alunos pagos, fotos e presenca
-- Execute UMA VEZ no D1 depois de 0008. Nao elimina dados existentes.
PRAGMA foreign_keys=ON;
CREATE TABLE IF NOT EXISTS chat_messages (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 student_id INTEGER NOT NULL,
 sender_role TEXT NOT NULL CHECK(sender_role IN ('admin','student')),
 sender_id INTEGER NOT NULL,
 body TEXT NOT NULL CHECK(length(body) BETWEEN 1 AND 1500),
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 read_at TEXT,
 FOREIGN KEY(student_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_chat_student_id ON chat_messages(student_id,id);
CREATE INDEX IF NOT EXISTS idx_chat_unread ON chat_messages(student_id,sender_role,read_at);
CREATE TABLE IF NOT EXISTS chat_presence (
 user_role TEXT NOT NULL CHECK(user_role IN ('admin','student','doctor')),
 user_id INTEGER NOT NULL,
 session_id TEXT NOT NULL,
 state TEXT NOT NULL CHECK(state IN ('ONLINE','AWAY')),
 last_seen_ms INTEGER NOT NULL,
 session_expires_ms INTEGER NOT NULL,
 PRIMARY KEY(user_role,user_id,session_id)
);
CREATE INDEX IF NOT EXISTS idx_presence_read ON chat_presence(user_role,user_id,session_expires_ms);
