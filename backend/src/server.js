import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { Pool } from 'pg';
import crypto from 'crypto';

dotenv.config();
const app = express();
const port = Number(process.env.PORT || 5000);
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const allowedOrigins = (process.env.CLIENT_ORIGIN || 'http://localhost:5173').split(',').map(s=>s.trim());
app.use(cors({ origin(origin, cb){ if(!origin || allowedOrigins.includes(origin)) return cb(null,true); cb(new Error('CORS origin not allowed')); } }));
app.use(express.json({ limit:'1mb' }));

const signToken = (user) => jwt.sign({ sub:user.id, role:user.role }, process.env.JWT_SECRET, { expiresIn:'7d' });
function auth(req,res,next){
  const token=(req.headers.authorization||'').replace(/^Bearer\s+/,'');
  if(!token) return res.status(401).json({error:'Authentication required'});
  try { req.auth=jwt.verify(token, process.env.JWT_SECRET); next(); }
  catch { return res.status(401).json({error:'Invalid or expired token'}); }
}
function roles(...allowed){ return (req,res,next)=> allowed.includes(req.auth.role) ? next() : res.status(403).json({error:'Forbidden'}); }
function safeUser(r){ return {id:r.id,name:r.name,email:r.email,role:r.role,age:r.age,language:r.language}; }

app.get('/api/health', async (_req,res)=>{
  try { await pool.query('SELECT 1'); res.json({ok:true, database:'connected'}); }
  catch { res.status(503).json({ok:false,database:'unavailable'}); }
});

app.post('/api/auth/register', async (req,res)=>{
  try {
    const {name,email,password,role='elderly',age,language='en'}=req.body;
    if(!name||!email||!password) return res.status(400).json({error:'Name, email and password are required'});
    if(password.length<8) return res.status(400).json({error:'Password must be at least 8 characters'});
    if(!['elderly','caregiver'].includes(role)) return res.status(400).json({error:'Invalid role'});
    const exists=await pool.query('SELECT id FROM users WHERE lower(email)=lower($1)',[email.trim()]);
    if(exists.rowCount) return res.status(409).json({error:'An account with this email already exists'});
    const hash=await bcrypt.hash(password,12);
    const {rows}=await pool.query('INSERT INTO users(name,email,password_hash,role,age,language) VALUES($1,$2,$3,$4,$5,$6) RETURNING id,name,email,role,age,language',[name.trim(),email.trim().toLowerCase(),hash,role,age||null,language]);
    res.status(201).json({user:safeUser(rows[0]),token:signToken(rows[0])});
  } catch(e){ console.error(e); res.status(500).json({error:'Registration failed'}); }
});

app.post('/api/auth/login', async (req,res)=>{
  try {
    const {email,password}=req.body;
    const {rows}=await pool.query('SELECT * FROM users WHERE lower(email)=lower($1)',[email?.trim()||'']);
    if(!rows.length || !(await bcrypt.compare(password||'',rows[0].password_hash))) return res.status(401).json({error:'Invalid email or password'});
    res.json({user:safeUser(rows[0]),token:signToken(rows[0])});
  } catch(e){ console.error(e); res.status(500).json({error:'Login failed'}); }
});

app.get('/api/auth/me',auth,async(req,res)=>{
  const {rows}=await pool.query('SELECT id,name,email,role,age,language FROM users WHERE id=$1',[req.auth.sub]);
  if(!rows.length) return res.status(404).json({error:'User not found'});
  res.json({user:safeUser(rows[0])});
});

app.get('/api/games',auth,(_req,res)=>res.json({games:[
  {key:'memory',label:'Memory Match'},
  {key:'objectRecall',label:'Object Recall'},
  {key:'pattern',label:'Pattern Recognition'},
  {key:'attention',label:'Attention Game'}
]}));

app.post('/api/game-sessions',auth,async(req,res)=>{
  try {
    const b=req.body;
    if(!b.id||!b.gameKey) return res.status(400).json({error:'Session id and game key are required'});
    const q=`INSERT INTO game_sessions(id,user_id,game_key,score,accuracy,response_time,difficulty_before,difficulty_after,total_questions,correct_answers,client_created_at)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) ON CONFLICT(id) DO NOTHING RETURNING *`;
    const {rows}=await pool.query(q,[b.id,req.auth.sub,b.gameKey,b.score,b.accuracy,b.responseTime||0,b.difficultyBefore,b.difficultyAfter,b.totalQuestions||1,b.correctAnswers||0,b.clientCreatedAt||new Date().toISOString()]);
    res.status(rows.length?201:200).json({session:rows[0]||null,duplicate:!rows.length});
  } catch(e){ console.error(e); res.status(500).json({error:'Could not save game session'}); }
});

app.post('/api/game-sessions/sync',auth,async(req,res)=>{
  const sessions=Array.isArray(req.body.sessions)?req.body.sessions:[];
  const results=[];
  const client=await pool.connect();
  try {
    await client.query('BEGIN');
    for(const b of sessions){
      const q=`INSERT INTO game_sessions(id,user_id,game_key,score,accuracy,response_time,difficulty_before,difficulty_after,total_questions,correct_answers,client_created_at)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) ON CONFLICT(id) DO NOTHING RETURNING id`;
      const r=await client.query(q,[b.id,req.auth.sub,b.gameKey,b.score,b.accuracy,b.responseTime||0,b.difficultyBefore,b.difficultyAfter,b.totalQuestions||1,b.correctAnswers||0,b.clientCreatedAt||new Date().toISOString()]);
      results.push({id:b.id,status:r.rowCount?'synced':'already_synced'});
    }
    await client.query('COMMIT'); res.json({results});
  } catch(e){ await client.query('ROLLBACK'); console.error(e); res.status(500).json({error:'Sync failed'}); }
  finally{client.release();}
});

app.get('/api/me/performance',auth,async(req,res)=>{
  const {rows}=await pool.query(`SELECT id,game_key,score,accuracy,response_time,difficulty_before,difficulty_after,total_questions,correct_answers,client_created_at,created_at FROM game_sessions WHERE user_id=$1 ORDER BY created_at ASC`,[req.auth.sub]);
  res.json({sessions:rows});
});

app.post('/api/reminders',auth,async(req,res)=>{
  const {title,reminderTime,note=''}=req.body;
  if(!title||!reminderTime) return res.status(400).json({error:'Title and time are required'});
  const {rows}=await pool.query('INSERT INTO reminders(user_id,title,reminder_time,note) VALUES($1,$2,$3,$4) RETURNING *',[req.auth.sub,title,reminderTime,note]);
  res.status(201).json({reminder:rows[0]});
});
app.get('/api/reminders',auth,async(req,res)=>{ const {rows}=await pool.query('SELECT * FROM reminders WHERE user_id=$1 ORDER BY created_at DESC',[req.auth.sub]); res.json({reminders:rows}); });

app.get('/api/caregiver/users',auth,roles('caregiver','admin'),async(req,res)=>{
  const sql=req.auth.role==='admin'
    ? `SELECT u.id,u.name,u.email,u.age,u.language,u.role,COALESCE(ROUND(AVG(g.score)),0)::int AS training_score,COALESCE(ROUND(AVG(g.accuracy)),0)::int AS accuracy,COALESCE(MAX(GREATEST(g.difficulty_before,g.difficulty_after)),1)::int AS level,COUNT(g.id)::int AS sessions,MAX(g.created_at) AS last_activity FROM users u LEFT JOIN game_sessions g ON g.user_id=u.id WHERE u.role='elderly' GROUP BY u.id ORDER BY u.name`
    : `SELECT u.id,u.name,u.email,u.age,u.language,u.role,COALESCE(ROUND(AVG(g.score)),0)::int AS training_score,COALESCE(ROUND(AVG(g.accuracy)),0)::int AS accuracy,COALESCE(MAX(GREATEST(g.difficulty_before,g.difficulty_after)),1)::int AS level,COUNT(g.id)::int AS sessions,MAX(g.created_at) AS last_activity FROM users u JOIN caregiver_links l ON l.elderly_id=u.id AND l.caregiver_id=$1 LEFT JOIN game_sessions g ON g.user_id=u.id WHERE u.role='elderly' GROUP BY u.id ORDER BY u.name`;
  const {rows}=await pool.query(sql,req.auth.role==='admin'?[]:[req.auth.sub]); res.json({users:rows});
});

app.get('/api/caregiver/users/:id/performance',auth,roles('caregiver','admin'),async(req,res)=>{
  if(req.auth.role==='caregiver'){
    const link=await pool.query('SELECT 1 FROM caregiver_links WHERE caregiver_id=$1 AND elderly_id=$2',[req.auth.sub,req.params.id]);
    if(!link.rowCount) return res.status(403).json({error:'Not authorized for this user'});
  }
  const {rows}=await pool.query('SELECT id,name,age,language FROM users WHERE id=$1 AND role=\'elderly\'',[req.params.id]);
  if(!rows.length) return res.status(404).json({error:'User not found'});
  const sessions=await pool.query('SELECT * FROM game_sessions WHERE user_id=$1 ORDER BY created_at ASC',[req.params.id]);
  res.json({user:safeUser(rows[0]),sessions:sessions.rows});
});

app.use((err,_req,res,_next)=>{console.error(err);res.status(500).json({error:'Unexpected server error'});});
app.listen(port,()=>console.log(`MindMate API running on http://localhost:${port}`));
