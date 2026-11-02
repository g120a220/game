import {beforeEach,afterEach,describe,it,expect} from 'vitest';
import {db,closeDb} from '../src/lib/db';
import {grantConsent,startLearning,submitAnswer,summary,createReward,redeem,fulfill,importContent,reviewContent,publishContent,adminContent,taipeiDay,type Actor} from '../src/lib/academy';
import {actor,login,sameOrigin} from '../src/lib/auth';
const student:Actor={id:'student-1',role:'student',family_id:'family-1',name:'Demo'};
const parent:Actor={id:'parent-1',role:'parent',family_id:'family-1',name:'Parent'};
const otherParent:Actor={id:'parent-2',role:'parent',family_id:'family-2',name:'Other'};
const admin:Actor={id:'admin-1',role:'admin',family_id:null,name:'Editor'};
const reviewer:Actor={id:'reviewer-1',role:'reviewer',family_id:null,name:'Reviewer'};
const answers=[1,1,2,0,1];
function complete(){grantConsent(parent);let s=startLearning(student);let last;for(let i=0;i<5;i++){last=submitAnswer(student,s.id,s.question!.id,answers[i]);s=last.session;}return last!;}
beforeEach(()=>{process.env.ACADEMY_DB_PATH=':memory:';process.env.LOCAL_DEMO_MODE='true';db();});afterEach(()=>closeDb());
describe('learning and persistence',()=>{
 it('requires parental consent and never returns the answer before submission',()=>{expect(()=>startLearning(student)).toThrow('家長');grantConsent(parent);const s=startLearning(student);expect(s.question).not.toHaveProperty('answer');expect(s.question).not.toHaveProperty('explanation');expect(startLearning(student).id).toBe(s.id);});
 it('grades on the server, persists mastery and completes the full five-question task',()=>{const result=complete();expect(result.session.status).toBe('completed');expect(result.session.correct).toBe(5);const data=summary(student);expect(data.points).toBe(10);expect(data.mastery.reduce((n,m)=>n+m.total,0)).toBe(5);expect(data.todayComplete).toBe(true);expect(data.history).toHaveLength(1);});
 it('rejects out-of-order answers, foreign sessions and invalid choices',()=>{grantConsent(parent);const s=startLearning(student);expect(()=>submitAnswer(student,s.id,'demo-4',0)).toThrow('順序');expect(()=>submitAnswer(student,s.id,'demo-1',3)).toThrow('有效');expect(()=>submitAnswer({...student,id:'student-2',family_id:'family-2'},s.id,'demo-1',1)).toThrow('找不到');});
 it('does not award duplicate points or change the first answer on retries',()=>{grantConsent(parent);const s=startLearning(student);const first=submitAnswer(student,s.id,'demo-1',0);expect(first.correct).toBe(false);const replay=submitAnswer(student,s.id,'demo-1',1);expect(replay.replayed).toBe(true);expect(replay.correct).toBe(false);expect(summary(student).mistakes).toHaveLength(1);expect(summary(student).mastery[0].total).toBe(1);});
 it('awards once per Taipei day and limits sessions without requiring streaks',()=>{complete();complete();expect(summary(student).points).toBe(10);expect(()=>startLearning(student)).toThrow('休息');});
 it('rejects expired tasks and enforces a rolling seven-day reward cap',()=>{grantConsent(parent);const s=startLearning(student);db().prepare('UPDATE learning_sessions SET created_at=? WHERE id=?').run(new Date(Date.now()-901000).toISOString(),s.id);expect(()=>submitAnswer(student,s.id,'demo-1',1)).toThrow('15 分鐘');db().prepare("UPDATE learning_sessions SET status='expired' WHERE id=?").run(s.id);db().prepare("INSERT INTO reward_ledger VALUES('old',?,?,'fixture',80,'earlier',?)").run(student.id,s.id,new Date().toISOString());complete();expect(summary(student).points).toBe(80);});
 it('uses Taiwan day boundaries',()=>{expect(taipeiDay(new Date('2026-11-01T16:01:00Z'))).toBe('2026-11-02');});
});
describe('family security and reward transactions',()=>{
 it('isolates households and blocks student mutation of parent resources',()=>{expect(()=>summary(otherParent,'student-1')).toThrow('其他家庭');expect(()=>summary(student,'student-2')).toThrow('其他學生');expect(()=>createReward(student,'一起閱讀',10)).toThrow('權限');expect(()=>grantConsent(student)).toThrow('權限');});
 it('deducts balance once for idempotent redemptions and prevents overspend',()=>{complete();const r=createReward(parent,'一起讀故事',10);const first=redeem(student,r.id,'request-one');const second=redeem(student,r.id,'request-one');expect(first.id).toBe(second.id);expect(summary(student).balance).toBe(0);expect(()=>redeem(student,r.id,'request-two')).toThrow('不夠');expect(()=>fulfill(otherParent,first.id)).toThrow('找不到');fulfill(parent,first.id);expect(summary(parent).redemptions[0].status).toBe('fulfilled');});
 it('does not allow another household reward or key reuse',()=>{complete();const other=createReward(otherParent,'其他家庭的書',1);expect(()=>redeem(student,other.id,'foreign')).toThrow('找不到');const own=createReward(parent,'自己的書',1);redeem(student,own.id,'key');expect(()=>redeem(student,other.id,'key')).toThrow('已被使用');});
});
describe('content provenance and separation of duties',()=>{
 const input={questions:[{prompt:'原創測試：1 加 1 是多少？',choices:['1','2'],answer:1,hint:'把兩個物件放在一起。',explanation:'1 加 1 等於 2。',objectiveId:'add-10',sourceUrl:'https://www.naer.edu.tw/',sourceTitle:'測試資料，並非已核驗課程'}]};
 it('validates imports atomically',()=>{expect(()=>importContent(admin,{questions:[input.questions[0],{...input.questions[0],choices:['1','1']}]})).toThrow('重複');expect(adminContent(admin).questions).toHaveLength(5);expect(()=>importContent(student,input)).toThrow('權限');});
 it('rejects unverifiable or unreviewed publication and requires independent review',()=>{expect(()=>publishContent(admin,'demo-1')).toThrow('來源查核');const {ids}=importContent(admin,input);expect(()=>publishContent(admin,ids[0])).toThrow('審核');expect(()=>reviewContent(admin,ids[0],'這是人工查核來源的詳細說明。',true)).toThrow('權限');expect(()=>reviewContent(reviewer,ids[0],'短',true)).toThrow('10 字');expect(()=>reviewContent(reviewer,ids[0],'這是人工查核來源的詳細說明。',false)).toThrow('查核');reviewContent(reviewer,ids[0],'測試流程：已由測試人員核對來源與適齡性。',true);publishContent(admin,ids[0]);expect(adminContent(admin).published).toEqual({n:1});expect(()=>publishContent(admin,ids[0])).toThrow();});
});
describe('local authentication boundary',()=>{
 it('uses opaque hashed sessions and rejects remote demo login',()=>{expect(()=>login(new Request('https://example.com/api/academy'),'admin')).toThrow('localhost');const req=new Request('http://localhost:3000/api/academy');const token=login(req,'parent');expect(actor(new Request(req,{headers:{cookie:`academy_session=${token}`}})).role).toBe('parent');expect(db().prepare('SELECT token_hash FROM auth_sessions').get()?.token_hash).not.toBe(token);});
 it('fails closed without local mode and enforces origin checks',()=>{process.env.LOCAL_DEMO_MODE='false';expect(()=>login(new Request('http://localhost:3000/api/academy'),'student')).toThrow('雲端登入');expect(()=>sameOrigin(new Request('http://localhost:3000/api/academy',{headers:{origin:'https://evil.test'}}))).toThrow('來源');});
});
