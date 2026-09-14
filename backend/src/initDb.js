import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Pool } from 'pg';

dotenv.config();
const __dirname=path.dirname(fileURLToPath(import.meta.url));
const pool=new Pool({connectionString:process.env.DATABASE_URL});
const schema=fs.readFileSync(path.join(__dirname,'../sql/schema.sql'),'utf8');
const seed=process.argv.includes('--seed') ? fs.readFileSync(path.join(__dirname,'../sql/seed.sql'),'utf8') : '';
try { await pool.query(schema); if(seed) await pool.query(seed); console.log(seed?'Database initialized + demo accounts seeded.':'Database initialized.'); }
catch(e){ console.error(e); process.exitCode=1; }
finally{ await pool.end(); }
