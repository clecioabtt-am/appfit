-- 0008 | Wagner Noronha - Foto de perfil do Dr. Alison
PRAGMA foreign_keys=OFF;
ALTER TABLE doctor_accounts ADD COLUMN profile_image_url TEXT;
PRAGMA foreign_keys=ON;
