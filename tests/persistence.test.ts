import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {it,expect} from 'vitest';
import {db,closeDb} from '../src/lib/db';
import {grantConsent,startLearning,submitAnswer,summary,type Actor} from '../src/lib/academy';
it('restores committed attempts and consent after closing and reopening the real SQLite file',()=>{
 const directory=mkdtempSync(join(tmpdir(),'academy-persistence-'));process.env.ACADEMY_DB_PATH=join(directory,'test.sqlite');
 const parent:Actor={id:'parent-1',family_id:'family-1',role:'parent',name:'P'};const student:Actor={id:'student-1',family_id:'family-1',role:'student',name:'S'};
 try{db();grantConsent(parent);const s=startLearning(student);submitAnswer(student,s.id,s.question!.id,0);closeDb();db();const restored=summary(student);expect(restored.consent).toBe(true);expect(restored.activeSession?.id).toBe(s.id);expect(restored.activeSession?.answered).toBe(1);expect(restored.activeSession?.question?.id).toBe('demo-2');expect(restored.mistakes).toHaveLength(1);}finally{closeDb();rmSync(directory,{recursive:true,force:true});}
});
