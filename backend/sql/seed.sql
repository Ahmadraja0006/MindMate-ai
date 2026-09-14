-- Demo accounts. Run after schema.sql.
-- Password for all three: Demo@12345
INSERT INTO users(name,email,password_hash,role,age,language)
VALUES
('Ramesh Baruah','ramesh.demo@mindmate.local',crypt('Demo@12345', gen_salt('bf')),'elderly',68,'en'),
('Sonam Wangdi','caregiver.demo@mindmate.local',crypt('Demo@12345', gen_salt('bf')),'caregiver',38,'en'),
('MindMate Admin','admin.demo@mindmate.local',crypt('Demo@12345', gen_salt('bf')),'admin',30,'en')
ON CONFLICT (email) DO NOTHING;

INSERT INTO caregiver_links(caregiver_id, elderly_id)
SELECT c.id, e.id FROM users c, users e
WHERE c.email='caregiver.demo@mindmate.local' AND e.email='ramesh.demo@mindmate.local'
ON CONFLICT DO NOTHING;
