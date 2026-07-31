ALTER TABLE exercises ADD COLUMN training_category TEXT NOT NULL DEFAULT 'Musculação';
ALTER TABLE exercises ADD COLUMN level TEXT NOT NULL DEFAULT 'Iniciante';
ALTER TABLE exercises ADD COLUMN execution_mode TEXT NOT NULL DEFAULT 'Repetições';
ALTER TABLE exercises ADD COLUMN duration TEXT;
ALTER TABLE exercises ADD COLUMN benefits TEXT;
ALTER TABLE exercises ADD COLUMN common_errors TEXT;
ALTER TABLE exercises ADD COLUMN equipment TEXT;
ALTER TABLE exercises ADD COLUMN tags TEXT;

CREATE INDEX IF NOT EXISTS idx_exercises_category ON exercises(training_category);
CREATE INDEX IF NOT EXISTS idx_exercises_active ON exercises(active);

INSERT INTO exercises(
  name, training_category, muscle_group, level, execution_mode,
  description, objective, instructions, benefits, common_errors,
  equipment, sets, reps, duration, rest, tags, active
)
SELECT
  'Burpee', 'Funcional', 'Corpo inteiro', 'Intermediário', 'Repetições',
  'Exercício funcional dinâmico que combina agachamento, prancha e salto.',
  'Melhorar o condicionamento cardiovascular, a coordenação e a resistência muscular.',
  'Agache e apoie as mãos no chão; leve os pés para trás; mantenha o tronco firme; retorne os pés; finalize com um salto controlado.',
  'Aumenta o gasto energético; melhora a resistência; trabalha vários grupos musculares.',
  'Curvar excessivamente a lombar; aterrissar sem controle; perder o alinhamento dos joelhos.',
  'Peso corporal', 4, '10', NULL, '45 seg', 'HIIT, resistência, emagrecimento', 1
WHERE NOT EXISTS(
  SELECT 1 FROM exercises WHERE name='Burpee' AND training_category='Funcional'
);
