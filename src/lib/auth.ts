import { createHash, randomBytes } from 'node:crypto';
import { db } from './db';
import { Actor, DomainError } from './academy';
const hash=(v:string)=>createHash('sha256').update(v).digest('hex');
export function localMode(){return process.env.LOCAL_DEMO_MODE==='true';}
export function requireLocal(req:Request){
 const hostname=(req.headers.get('host')?new URL(new URL(req.url).protocol+'//'+req.headers.get('host')):new URL(req.url)).hostname;
 if(!localMode()||!['localhost','127.0.0.1','[::1]'].includes(hostname))throw new DomainError('本地示範模式僅限 localhost。雲端登入尚未啟用。',503);
}
export function sameOrigin(req:Request){const origin=req.headers.get('origin');if(!origin||origin!==(req.headers.get('host')?new URL(req.url).protocol+'//'+req.headers.get('host'):new URL(req.url).origin))throw new DomainError('請求來源不符',403);}
export function login(req:Request,role:string){requireLocal(req);const ids:Record<string,string>={student:'student-1',parent:'parent-1',admin:'admin-1',reviewer:'reviewer-1'};if(!ids[role])throw new DomainError('未知的示範角色');
 const token=randomBytes(32).toString('hex');db().prepare('DELETE FROM auth_sessions WHERE expires_at<?').run(Date.now());db().prepare('INSERT INTO auth_sessions VALUES(?,?,?)').run(hash(token),ids[role],Date.now()+8*3600_000);return token;}
export function actor(req:Request):Actor {requireLocal(req);const token=req.headers.get('cookie')?.split(';').map(x=>x.trim()).find(x=>x.startsWith('academy_session='))?.slice('academy_session='.length);if(!token)throw new DomainError('請先選擇本地示範角色',401);const a=db().prepare('SELECT a.* FROM auth_sessions s JOIN accounts a ON a.id=s.account_id WHERE s.token_hash=? AND s.expires_at>?').get(hash(token),Date.now()) as Actor|undefined;if(!a)throw new DomainError('登入已到期，請重新選擇角色',401);return a;}
export function logout(req:Request){const token=req.headers.get('cookie')?.split(';').map(x=>x.trim()).find(x=>x.startsWith('academy_session='))?.slice(16);if(token)db().prepare('DELETE FROM auth_sessions WHERE token_hash=?').run(hash(token));}
