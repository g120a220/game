import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import {catalogSql} from './catalog-schema';
import { demoQuestions, objectives } from './content';
let instance: DatabaseSync | undefined;
export function db() {
 if (instance) return instance;
 const file = process.env.ACADEMY_DB_PATH || '.data/academy.sqlite';
 if(file!==':memory:') mkdirSync(dirname(resolve(file)), {recursive:true,mode:0o700});
 const d = new DatabaseSync(file); d.exec('PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;');
 d.exec(`
 CREATE TABLE IF NOT EXISTS accounts(id TEXT PRIMARY KEY,role TEXT NOT NULL CHECK(role IN ('student','parent','admin','reviewer')),family_id TEXT,name TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS consent(family_id TEXT PRIMARY KEY,granted_at TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS auth_sessions(token_hash TEXT PRIMARY KEY,account_id TEXT REFERENCES accounts(id),expires_at INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS objectives(id TEXT PRIMARY KEY,title TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS questions(id TEXT PRIMARY KEY,prompt TEXT NOT NULL,choices TEXT NOT NULL,answer INTEGER NOT NULL,hint TEXT NOT NULL,explanation TEXT NOT NULL,objective_id TEXT REFERENCES objectives(id),status TEXT NOT NULL DEFAULT 'draft',source_url TEXT,source_title TEXT,source_verified INTEGER NOT NULL DEFAULT 0,author_id TEXT NOT NULL,version INTEGER NOT NULL DEFAULT 1,created_at TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS content_reviews(id TEXT PRIMARY KEY,question_id TEXT NOT NULL REFERENCES questions(id),reviewer_id TEXT REFERENCES accounts(id),decision TEXT NOT NULL,note TEXT NOT NULL,created_at TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS publication_releases(id TEXT PRIMARY KEY,question_id TEXT UNIQUE REFERENCES questions(id),published_by TEXT NOT NULL,created_at TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS learning_sessions(id TEXT PRIMARY KEY,student_id TEXT REFERENCES accounts(id),status TEXT NOT NULL DEFAULT 'active',created_at TEXT NOT NULL,completed_at TEXT,question_ids TEXT NOT NULL,mode TEXT NOT NULL DEFAULT 'demo');
 CREATE UNIQUE INDEX IF NOT EXISTS active_student_session ON learning_sessions(student_id) WHERE status='active';
 CREATE TABLE IF NOT EXISTS attempts(id TEXT PRIMARY KEY,session_id TEXT REFERENCES learning_sessions(id),student_id TEXT REFERENCES accounts(id),question_id TEXT REFERENCES questions(id),selected INTEGER NOT NULL,correct INTEGER NOT NULL,created_at TEXT NOT NULL,UNIQUE(session_id,question_id));
 CREATE TABLE IF NOT EXISTS mastery(student_id TEXT REFERENCES accounts(id),objective_id TEXT REFERENCES objectives(id),correct INTEGER NOT NULL DEFAULT 0,total INTEGER NOT NULL DEFAULT 0,updated_at TEXT NOT NULL,PRIMARY KEY(student_id,objective_id));
 CREATE TABLE IF NOT EXISTS reward_ledger(id TEXT PRIMARY KEY,student_id TEXT REFERENCES accounts(id),session_id TEXT REFERENCES learning_sessions(id),kind TEXT NOT NULL,amount INTEGER NOT NULL CHECK(amount>=0),period TEXT NOT NULL,created_at TEXT NOT NULL,UNIQUE(student_id,kind,period));
 CREATE TABLE IF NOT EXISTS family_rewards(id TEXT PRIMARY KEY,family_id TEXT NOT NULL,title TEXT NOT NULL,cost INTEGER NOT NULL CHECK(cost BETWEEN 1 AND 80),created_at TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS redemptions(id TEXT PRIMARY KEY,reward_id TEXT REFERENCES family_rewards(id),student_id TEXT REFERENCES accounts(id),request_key TEXT UNIQUE NOT NULL,status TEXT NOT NULL DEFAULT 'pending',cost INTEGER NOT NULL,created_at TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS audit_log(id TEXT PRIMARY KEY,actor_id TEXT NOT NULL,action TEXT NOT NULL,target_id TEXT NOT NULL,created_at TEXT NOT NULL);
 `);
 d.exec(catalogSql);
 const now=new Date().toISOString();
 for(const [id,role,family,name] of [['student-1','student','family-1','小小探險家'],['parent-1','parent','family-1','示範家長'],['admin-1','admin',null,'教材編輯'],['reviewer-1','reviewer',null,'教材審查員'],['student-2','student','family-2','另一位探險家'],['parent-2','parent','family-2','另一位家長']]) d.prepare('INSERT OR IGNORE INTO accounts VALUES(?,?,?,?)').run(id,role,family,name);
 for(const o of objectives) d.prepare('INSERT OR IGNORE INTO objectives VALUES(?,?)').run(o.id,o.title);
 for(const q of demoQuestions) d.prepare('INSERT OR IGNORE INTO questions(id,prompt,choices,answer,hint,explanation,objective_id,status,author_id,created_at,source_title) VALUES(?,?,?,?,?,?,?,?,?,?,?)').run(q.id,q.prompt,JSON.stringify(q.choices),q.answer,q.hint,q.explanation,q.objectiveId,'demo','original-demo',now,'原創功能示範；未核驗教材對照');
 for(const q of demoQuestions){d.prepare('INSERT OR IGNORE INTO question_objective_mappings VALUES(?,?)').run(q.id,q.objectiveId);d.prepare('INSERT OR IGNORE INTO question_versions VALUES(?,?,?,?,?)').run(q.id+'-v1',q.id,1,JSON.stringify(q),now);}
 instance=d;return d;
}
export function transaction<T>(fn:()=>T):T { const d=db();d.exec('BEGIN IMMEDIATE');try{const value=fn();d.exec('COMMIT');return value;}catch(e){d.exec('ROLLBACK');throw e;} }
export function closeDb(){ instance?.close();instance=undefined; }
