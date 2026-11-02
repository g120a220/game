import { randomUUID } from 'node:crypto';
import { db, transaction } from './db';
import { importInput, objectives } from './content';
export type Actor = { id:string; role:'student'|'parent'|'admin'|'reviewer'; family_id:string|null; name:string };
type Row=Record<string,any>;
export class DomainError extends Error { constructor(message:string,public status=400){super(message);} }
const now=()=>new Date().toISOString();
export const taipeiDay=(date=new Date())=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Taipei',year:'numeric',month:'2-digit',day:'2-digit'}).format(date);
function requireRole(a:Actor,...roles:Actor['role'][]){if(!roles.includes(a.role))throw new DomainError('此帳戶沒有操作權限',403);}
function audit(a:Actor,action:string,target:string){db().prepare('INSERT INTO audit_log VALUES(?,?,?,?,?)').run(randomUUID(),a.id,action,target,now());}
function studentFor(a:Actor,requested?:string):string {
 if(a.role==='student'){if(requested&&requested!==a.id)throw new DomainError('無法讀取其他學生資料',403);return a.id;}
 requireRole(a,'parent'); const student=db().prepare('SELECT id FROM accounts WHERE role=? AND family_id=? AND (? IS NULL OR id=?)').get('student',a.family_id,requested||null,requested||null) as Row|undefined;
 if(!student)throw new DomainError('無法讀取其他家庭資料',403);return student.id;
}
function sessionView(s:Row){const ids=JSON.parse(s.question_ids) as string[];const attempts=db().prepare('SELECT question_id,selected,correct FROM attempts WHERE session_id=? ORDER BY created_at').all(s.id) as Row[];
 const next=ids.find(id=>!attempts.some(a=>a.question_id===id));const q=next&&s.status==='active'?db().prepare('SELECT id,prompt,choices,hint FROM questions WHERE id=?').get(next) as Row:undefined;
 return {id:s.id,status:s.status,total:ids.length,answered:attempts.length,correct:attempts.filter(a=>a.correct).length,question:q?{id:q.id as string,prompt:q.prompt as string,hint:q.hint as string,choices:JSON.parse(q.choices) as string[]}:null,createdAt:s.created_at,mode:s.mode}; }
export function summary(a:Actor,requested?:string){const sid=studentFor(a,requested);const d=db();const ledger=d.prepare('SELECT COALESCE(SUM(amount),0) AS points FROM reward_ledger WHERE student_id=?').get(sid) as Row;
 const spent=d.prepare('SELECT COALESCE(SUM(cost),0) AS points FROM redemptions WHERE student_id=?').get(sid) as Row;
 const master=d.prepare('SELECT * FROM mastery WHERE student_id=?').all(sid) as Row[];
 const history=d.prepare('SELECT s.id,s.status,s.created_at,s.completed_at,COUNT(a.id) AS total,COALESCE(SUM(a.correct),0) AS correct FROM learning_sessions s LEFT JOIN attempts a ON a.session_id=s.id WHERE s.student_id=? GROUP BY s.id ORDER BY s.created_at DESC LIMIT 20').all(sid);
 const mistakes=d.prepare('SELECT q.id,q.prompt,q.explanation,q.objective_id,COUNT(*) AS times FROM attempts a JOIN questions q ON q.id=a.question_id WHERE a.student_id=? AND a.correct=0 GROUP BY q.id').all(sid);
 const active=d.prepare("SELECT * FROM learning_sessions WHERE student_id=? AND status='active'").get(sid) as Row|undefined;
 const today=d.prepare("SELECT COUNT(*) AS count FROM reward_ledger WHERE student_id=? AND kind='daily-learning' AND period=?").get(sid,taipeiDay()) as Row;
 const student=d.prepare('SELECT name,family_id FROM accounts WHERE id=?').get(sid) as Row;
 return {studentId:sid,name:student.name,points:ledger.points,balance:ledger.points-spent.points,todayComplete:today.count>0,consent:!!d.prepare('SELECT 1 FROM consent WHERE family_id=?').get(student.family_id),mastery:(d.prepare('SELECT id,title FROM objectives').all() as {id:string;title:string}[]).map(v=>({...objectives.find(o=>o.id===v.id),...v})).map(o=>({...o,correct:Number(master.find(m=>m.objective_id===o.id)?.correct||0),total:Number(master.find(m=>m.objective_id===o.id)?.total||0)})),history,mistakes,activeSession:active?sessionView(active):null,rewards:d.prepare('SELECT * FROM family_rewards WHERE family_id=? ORDER BY created_at DESC').all(student.family_id),redemptions:d.prepare('SELECT r.*,f.title FROM redemptions r JOIN family_rewards f ON f.id=r.reward_id WHERE student_id=? ORDER BY created_at DESC').all(sid)};
}
export function grantConsent(a:Actor){requireRole(a,'parent');db().prepare('INSERT OR IGNORE INTO consent VALUES(?,?)').run(a.family_id,now());audit(a,'consent.grant',a.family_id!);return {ok:true};}
export function startLearning(a:Actor){requireRole(a,'student');return transaction(()=>{
 if(!db().prepare('SELECT 1 FROM consent WHERE family_id=?').get(a.family_id))throw new DomainError('請先由家長在家長專區授權示範學習',403);
 const active=db().prepare("SELECT * FROM learning_sessions WHERE student_id=? AND status='active'").get(a.id) as Row|undefined;
 if(active&&Date.now()-Date.parse(active.created_at)<15*60_000)return sessionView(active);
 if(active)db().prepare("UPDATE learning_sessions SET status='expired',completed_at=? WHERE id=?").run(now(),active.id);
 const dayStart=new Date(taipeiDay()+'T00:00:00+08:00').toISOString();
 const count=db().prepare('SELECT COUNT(*) AS n FROM learning_sessions WHERE student_id=? AND created_at>=?').get(a.id,dayStart) as Row;
 if(count.n>=2)throw new DomainError('今天的探索已經足夠了，休息一下，明天再出發。',429);
 const ids=db().prepare("SELECT id FROM questions WHERE status='demo' ORDER BY id LIMIT 5").all().map(q=>q.id);
 const id=randomUUID();db().prepare('INSERT INTO learning_sessions(id,student_id,created_at,question_ids) VALUES(?,?,?,?)').run(id,a.id,now(),JSON.stringify(ids));return sessionView(db().prepare('SELECT * FROM learning_sessions WHERE id=?').get(id) as Row);
 });}
export function submitAnswer(a:Actor,sessionId:string,questionId:string,selected:number){requireRole(a,'student');return transaction(()=>{
 const s=db().prepare('SELECT * FROM learning_sessions WHERE id=? AND student_id=?').get(sessionId,a.id) as Row|undefined;
 if(!s)throw new DomainError('找不到此學習任務',404);
 const existing=db().prepare('SELECT * FROM attempts WHERE session_id=? AND question_id=?').get(s.id,questionId) as Row|undefined;
 if(existing){const q=db().prepare('SELECT explanation,answer FROM questions WHERE id=?').get(questionId) as Row;return {correct:!!existing.correct,explanation:q.explanation,answer:q.answer,replayed:true,session:sessionView(s)};}
 if(s.status!=='active')throw new DomainError('此任務已結束');
 if(Date.now()-Date.parse(s.created_at)>=15*60_000)throw new DomainError('這次已探索 15 分鐘，請先休息。');
 const view=sessionView(s);if(view.question?.id!==questionId)throw new DomainError('請依任務順序作答');
 const q=db().prepare('SELECT * FROM questions WHERE id=?').get(questionId) as Row;
 if(!Number.isInteger(selected)||selected<0||selected>=JSON.parse(q.choices).length)throw new DomainError('請選擇有效答案');
 const correct=q.answer===selected;db().prepare('INSERT INTO attempts VALUES(?,?,?,?,?,?,?)').run(randomUUID(),s.id,a.id,q.id,selected,correct?1:0,now());
 for(const {objective_id} of db().prepare('SELECT objective_id FROM question_objective_mappings WHERE question_id=?').all(q.id)){db().prepare('INSERT INTO mastery VALUES(?,?,?,1,?) ON CONFLICT(student_id,objective_id) DO UPDATE SET correct=mastery.correct+excluded.correct,total=mastery.total+1,updated_at=excluded.updated_at').run(a.id,objective_id,correct?1:0,now());}
 let awarded=0;
 if(view.answered+1===view.total){db().prepare("UPDATE learning_sessions SET status='completed',completed_at=? WHERE id=?").run(now(),s.id);
 const weekStart=new Date(Date.now()-7*86400_000).toISOString();const weekly=db().prepare('SELECT COALESCE(SUM(amount),0) AS n FROM reward_ledger WHERE student_id=? AND created_at>=?').get(a.id,weekStart) as Row;
 if(weekly.n<80){const amount=Math.min(10,80-weekly.n);const r=db().prepare("INSERT OR IGNORE INTO reward_ledger VALUES(?,?,?,'daily-learning',?,?,?)").run(randomUUID(),a.id,s.id,amount,taipeiDay(),now());if(r.changes)awarded=amount;}
 }
 return {correct,answer:q.answer,explanation:q.explanation,awarded,replayed:false,session:sessionView(db().prepare('SELECT * FROM learning_sessions WHERE id=?').get(s.id) as Row)};
 });}
export function createReward(a:Actor,title:string,cost:number){requireRole(a,'parent');if(title.trim().length<2||title.length>60||!Number.isInteger(cost)||cost<1||cost>80)throw new DomainError('獎勵名稱須為 2–60 字，點數須為 1–80');const id=randomUUID();db().prepare('INSERT INTO family_rewards VALUES(?,?,?,?,?)').run(id,a.family_id,title.trim(),cost,now());audit(a,'reward.create',id);return {id};}
export function redeem(a:Actor,rewardId:string,key:string){requireRole(a,'student');return transaction(()=>{const previous=db().prepare('SELECT * FROM redemptions WHERE request_key=?').get(key) as Row|undefined;if(previous){if(previous.student_id!==a.id||previous.reward_id!==rewardId)throw new DomainError('此請求代碼已被使用',409);return previous;}
 const r=db().prepare('SELECT * FROM family_rewards WHERE id=? AND family_id=?').get(rewardId,a.family_id) as Row|undefined;if(!r)throw new DomainError('找不到此家庭獎勵',404);
 const s=summary(a);if(s.balance<r.cost)throw new DomainError('目前星星還不夠，慢慢累積就好。');const id=randomUUID();db().prepare('INSERT INTO redemptions VALUES(?,?,?,?,?,?,?)').run(id,r.id,a.id,key,'pending',r.cost,now());return {id,status:'pending'};});}
export function fulfill(a:Actor,id:string){requireRole(a,'parent');const r=db().prepare('SELECT r.id FROM redemptions r JOIN family_rewards f ON f.id=r.reward_id WHERE r.id=? AND f.family_id=?').get(id,a.family_id);if(!r)throw new DomainError('找不到此兌換',404);db().prepare("UPDATE redemptions SET status='fulfilled' WHERE id=?").run(id);audit(a,'reward.fulfill',id);return {ok:true};}
export function adminContent(a:Actor){requireRole(a,'admin','reviewer');return {questions:db().prepare('SELECT q.*, (SELECT COUNT(*) FROM content_reviews r WHERE r.question_id=q.id) AS reviews FROM questions q ORDER BY created_at DESC').all().map(q=>({...q,choices:JSON.parse(q.choices as string)})),reviews:db().prepare('SELECT * FROM content_reviews ORDER BY created_at DESC LIMIT 30').all(),published:db().prepare('SELECT COUNT(*) AS n FROM publication_releases').get(),objectives:db().prepare('SELECT id,title FROM objectives').all()};}
export function importContent(a:Actor,input:unknown){requireRole(a,'admin');const parsed=importInput.safeParse(input);if(!parsed.success)throw new DomainError(parsed.error.issues.map(i=>i.message).join('；'));return transaction(()=>{const ids=parsed.data.questions.map(q=>{const mapped=[...new Set([q.objectiveId,...q.additionalObjectiveIds])];for(const oid of mapped)if(!db().prepare('SELECT 1 FROM objectives WHERE id=?').get(oid))throw new DomainError('找不到知識點，請先在教材架構建立');const id=randomUUID();db().prepare('INSERT INTO questions(id,prompt,choices,answer,hint,explanation,objective_id,source_url,source_title,author_id,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)').run(id,q.prompt,JSON.stringify(q.choices),q.answer,q.hint,q.explanation,q.objectiveId,q.sourceUrl,q.sourceTitle,a.id,now());for(const oid of mapped)db().prepare('INSERT INTO question_objective_mappings VALUES(?,?)').run(id,oid);db().prepare('INSERT INTO question_versions VALUES(?,?,?,?,?)').run(id+'-v1',id,1,JSON.stringify(q),now());audit(a,'content.import',id);return id;});return {ids};});}
export function reviewContent(a:Actor,id:string,note:string,verified:boolean){requireRole(a,'reviewer');if(!verified||note.trim().length<10)throw new DomainError('須查核來源並提供至少 10 字審查紀錄');return transaction(()=>{const q=db().prepare('SELECT * FROM questions WHERE id=?').get(id) as Row|undefined;if(!q||q.status!=='draft'||q.author_id===a.id||!q.source_url)throw new DomainError('僅可獨立審查附來源的草稿');db().prepare('INSERT INTO content_reviews VALUES(?,?,?,?,?,?)').run(randomUUID(),id,a.id,'approved',note.trim(),now());db().prepare("UPDATE questions SET status='approved',source_verified=1 WHERE id=?").run(id);audit(a,'content.approve',id);return {ok:true};});}
export function publishContent(a:Actor,id:string){requireRole(a,'admin');return transaction(()=>{const q=db().prepare('SELECT * FROM questions WHERE id=?').get(id) as Row|undefined;const r=db().prepare("SELECT 1 FROM content_reviews WHERE question_id=? AND reviewer_id!=? AND decision='approved'").get(id,a.id);if(!q||q.status!=='approved'||!q.source_verified||!r)throw new DomainError('教材尚未完成來源查核與獨立審核');db().prepare("UPDATE questions SET status='published' WHERE id=?").run(id);db().prepare('INSERT INTO publication_releases VALUES(?,?,?,?)').run(randomUUID(),id,a.id,now());audit(a,'content.publish',id);return {ok:true};});}
