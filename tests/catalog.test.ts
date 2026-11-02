import {beforeEach,afterEach,it,expect} from 'vitest';
import {db,closeDb} from '../src/lib/db';
import {catalog,importCatalog} from '../src/lib/catalog';
import {importContent,adminContent,type Actor} from '../src/lib/academy';
const admin:Actor={id:'admin-1',role:'admin',family_id:null,name:'Editor'};
beforeEach(()=>{process.env.ACADEMY_DB_PATH=':memory:';db();});afterEach(()=>closeDb());
it('builds subjects and objectives without model rewrites and accepts multiple objective mappings',()=>{
 importCatalog(admin,{records:[{table:'subjects',id:'language',values:{code:'language',name:'語文示範'}},{table:'learning_objectives',id:'reading-demo',values:{subject_id:'language',code:'reading-demo',title:'理解句意',description:'原創測試知識點'}}]});
 const q=importContent(admin,{questions:[{prompt:'測試用原創題目，這句話的意思為何？',choices:['甲','乙'],answer:0,hint:'重新讀一遍看看。',explanation:'測試說明，不是正式教材。',objectiveId:'reading-demo',additionalObjectiveIds:['count-10'],sourceUrl:'https://www.naer.edu.tw/',sourceTitle:'測試來源'}]});
 expect(db().prepare('SELECT * FROM question_objective_mappings WHERE question_id=?').all(q.ids[0])).toHaveLength(2);expect(db().prepare('SELECT * FROM question_versions WHERE question_id=?').all(q.ids[0])).toHaveLength(1);expect(catalog(admin).find(g=>g.table==='subjects')?.rows).toHaveLength(1);expect(adminContent(admin).questions).toHaveLength(6);
});
it('rolls back invalid imports and blocks arbitrary SQL identifiers and fabricated verification',()=>{
 expect(()=>importCatalog(admin,{records:[{table:'subjects',id:'good',values:{code:'math',name:'數學'}},{table:'subjects; DROP TABLE accounts;',id:'bad',values:{name:'壞'}}]})).toThrow('不允許');expect(catalog(admin).find(g=>g.table==='subjects')?.rows).toHaveLength(0);
 expect(()=>importCatalog(admin,{records:[{table:'textbook_editions',id:'fake',values:{publisher_id:'x',subject_id:'x',academic_year_id:'x',edition_label:'x',source_id:'x',status:'verified'}}]})).toThrow('不能自行宣告');
 expect(()=>importCatalog({...admin,role:'student'},{records:[]})).toThrow('權限');
 expect(()=>importContent(admin,{questions:[{prompt:'找不到知識點的原創測試',choices:['1','2'],answer:0,hint:'這是提示。',explanation:'這是解說。',objectiveId:'missing',sourceUrl:'https://www.naer.edu.tw/',sourceTitle:'測試來源'}]})).toThrow('找不到知識點');
});
it('rejects prerequisite cycles and malformed calendar data',()=>{
 importCatalog(admin,{records:[{table:'subjects',id:'m',values:{code:'m',name:'測試數學'}},{table:'learning_objectives',id:'a',values:{subject_id:'m',code:'a',title:'甲知識點',description:'測試知識點甲'}},{table:'learning_objectives',id:'b',values:{subject_id:'m',code:'b',title:'乙知識點',description:'測試知識點乙'}},{table:'objective_prerequisites',id:'a-to-b',values:{objective_id:'a',prerequisite_id:'b'}}]});
 expect(()=>importCatalog(admin,{records:[{table:'objective_prerequisites',id:'b-to-a',values:{objective_id:'b',prerequisite_id:'a'}}]})).toThrow('循環');
 expect(()=>importCatalog(admin,{records:[{table:'academic_years',id:'bad',values:{roc_year:'abc',starts_on:'yesterday',ends_on:'tomorrow'}}]})).toThrow('整數');
 expect(db().prepare('SELECT * FROM objective_prerequisites').all()).toHaveLength(1);
});
