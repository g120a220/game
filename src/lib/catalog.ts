import {randomUUID} from 'node:crypto';
import {z} from 'zod';
import {db,transaction} from './db';
import {DomainError,type Actor} from './academy';
import {catalogDefinitions,type CatalogTable} from './catalog-schema';
const input=z.object({records:z.array(z.object({table:z.string(),id:z.string().regex(/^[a-zA-Z0-9_-]{1,80}$/),values:z.record(z.string(),z.union([z.string().max(5000),z.number().int()]))})).min(1).max(100)});
function authorize(a:Actor,write=false){if(a.role!=='admin'&&(write||a.role!=='reviewer'))throw new DomainError('此帳戶沒有教材架構管理權限',403);}
export function catalog(a:Actor){authorize(a);return Object.entries(catalogDefinitions).map(([table,def])=>({table,...def,rows:db().prepare(`SELECT * FROM ${table} ORDER BY rowid DESC LIMIT 100`).all()}));}
export function importCatalog(a:Actor,raw:unknown){authorize(a,true);const parsed=input.safeParse(raw);if(!parsed.success)throw new DomainError('架構 JSON 格式錯誤：須提供 records，最多 100 筆');
 return transaction(()=>{for(const r of parsed.data.records){if(!Object.hasOwn(catalogDefinitions,r.table))throw new DomainError('不允許的架構資料表');const table=r.table as CatalogTable;const def=catalogDefinitions[table];const fields=Object.keys(r.values);if(fields.some(f=>!(def.fields as readonly string[]).includes(f))||def.required.some(f=>r.values[f]===undefined||String(r.values[f]).trim()===''))throw new DomainError(`${def.name}欄位不完整或含未知欄位`);
 for(const f of fields){if(f.endsWith('_url')||f==='url'){const parsed=z.url().safeParse(r.values[f]);if(!parsed.success||!String(r.values[f]).startsWith('https://'))throw new DomainError('來源網址須為 HTTPS');}}
 for(const f of ['grade_id','semester_id','sequence','roc_year'])if(r.values[f]!==undefined&&!Number.isInteger(r.values[f]))throw new DomainError(`${f} 必須為整數`);
 for(const f of ['starts_on','ends_on'])if(r.values[f]!==undefined&&!z.iso.date().safeParse(r.values[f]).success)throw new DomainError(`${f} 必須為有效日期 YYYY-MM-DD`);
 if(r.values.accessed_at!==undefined&&!z.iso.datetime({offset:true}).safeParse(r.values.accessed_at).success)throw new DomainError('查閱時間須為含時區的 ISO 日期時間');
 if(table==='textbook_editions'&&r.values.status!=='unverified'&&r.values.status!=='retired')throw new DomainError('匯入版本只能為待核驗或停用，不能自行宣告已核驗');
 if(table==='learning_materials'&&r.values.status!=='draft')throw new DomainError('素材只能匯入草稿');
 try{db().prepare(`INSERT INTO ${table}(id,${fields.join(',')}) VALUES(?,${fields.map(()=>'?').join(',')})`).run(r.id,...fields.map(f=>r.values[f]));}catch{throw new DomainError(`${def.name}無法匯入：請檢查重複代碼、參照順序或欄位限制`);}
 if(table==='objective_prerequisites'){const cycle=db().prepare('WITH RECURSIVE reachable(id) AS (SELECT prerequisite_id FROM objective_prerequisites WHERE objective_id=? UNION SELECT p.prerequisite_id FROM objective_prerequisites p JOIN reachable r ON p.objective_id=r.id) SELECT 1 FROM reachable WHERE id=?').get(String(r.values.objective_id),String(r.values.objective_id));if(cycle)throw new DomainError('前置知識點不可形成循環');}
 if(table==='learning_objectives')db().prepare('INSERT INTO objectives VALUES(?,?)').run(r.id,String(r.values.title));
 db().prepare('INSERT INTO audit_log VALUES(?,?,?,?,?)').run(randomUUID(),a.id,'catalog.import',r.id,new Date().toISOString());
 }return {count:parsed.data.records.length};});}
