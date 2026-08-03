ALTER TABLE users ADD COLUMN profile_image_url TEXT;

CREATE TABLE IF NOT EXISTS workout_assignments (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 student_id INTEGER NOT NULL,
 weekday INTEGER NOT NULL CHECK(weekday BETWEEN 0 AND 6),
 exercise_id INTEGER NOT NULL,
 sort_order INTEGER NOT NULL DEFAULT 0,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY(student_id) REFERENCES users(id) ON DELETE CASCADE,
 FOREIGN KEY(exercise_id) REFERENCES exercises(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_workout_student_day ON workout_assignments(student_id,weekday,sort_order);

CREATE TABLE IF NOT EXISTS workout_completions (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 user_id INTEGER NOT NULL,
 exercise_id INTEGER NOT NULL,
 completed_date TEXT NOT NULL,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE(user_id,exercise_id,completed_date),
 FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
 FOREIGN KEY(exercise_id) REFERENCES exercises(id) ON DELETE CASCADE
);
