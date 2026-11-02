import { NextResponse } from 'next/server';
import { z } from 'zod';
import * as academy from '@/lib/academy';
import {catalog,importCatalog} from '@/lib/catalog';
import { actor,login,logout,localMode,sameOrigin } from '@/lib/auth';
export const runtime='nodejs';export const dynamic='force-dynamic';
function output(value:unknown,status=200){return NextResponse.json(value,{status,headers:{'Cache-Control':'no-store'}});}
function failure(e:unknown){if(e instanceof academy.DomainError)return output({error:e.message},e.status);if(e instanceof z.ZodError)return output({error:'輸入格式不正確'},400);console.error(e instanceof Error?e.message:'Unknown API failure');return output({error:'系統暫時無法處理，請稍後重試'},500);}
export async function GET(req:Request){try{const a=actor(req);const url=new URL(req.url);return output({actor:a,localMode:localMode(),data:a.role==='admin'||a.role==='reviewer'?{...academy.adminContent(a),catalog:catalog(a)}:academy.summary(a,url.searchParams.get('studentId')||undefined)});}catch(e){return failure(e);}}
const command=z.object({action:z.string(),sessionId:z.string().max(100).optional(),questionId:z.string().max(100).optional(),selected:z.number().int().min(0).max(3).optional(),role:z.enum(['student','parent','admin','reviewer']).optional(),title:z.string().max(60).optional(),cost:z.number().int().optional(),rewardId:z.string().max(100).optional(),key:z.string().uuid().optional(),id:z.string().max(100).optional(),note:z.string().max(2000).optional(),verified:z.boolean().optional(),payload:z.unknown().optional()});
export async function POST(req:Request){try{sameOrigin(req);if(Number(req.headers.get('content-length')||0)>100_000)return output({error:'匯入檔案過大'},413);const raw=await req.text();if(Buffer.byteLength(raw)>100_000)return output({error:'匯入檔案過大'},413);let json;try{json=JSON.parse(raw);}catch{return output({error:'JSON 格式錯誤'},400);}const c=command.parse(json);
 if(c.action==='login'){const token=login(req,c.role||'student');const r=output({ok:true});r.cookies.set('academy_session',token,{httpOnly:true,sameSite:'strict',secure:new URL(req.url).protocol==='https:',path:'/',maxAge:28800});return r;}
 const a=actor(req);
 switch(c.action){
 case 'logout':{logout(req);const r=output({ok:true});r.cookies.set('academy_session','',{httpOnly:true,sameSite:'strict',path:'/',maxAge:0});return r;}
 case 'consent':return output(academy.grantConsent(a));
 case 'start':return output(academy.startLearning(a));
 case 'answer':if(!c.sessionId||!c.questionId||c.selected===undefined)throw new academy.DomainError('缺少作答資料');return output(academy.submitAnswer(a,c.sessionId,c.questionId,c.selected));
 case 'createReward':return output(academy.createReward(a,c.title||'',c.cost||0));
 case 'redeem':if(!c.rewardId||!c.key)throw new academy.DomainError('缺少兌換資料');return output(academy.redeem(a,c.rewardId,c.key));
 case 'fulfill':return output(academy.fulfill(a,c.id||''));
 case 'catalogImport':return output(importCatalog(a,c.payload));
 case 'import':return output(academy.importContent(a,c.payload));
 case 'review':return output(academy.reviewContent(a,c.id||'',c.note||'',c.verified||false));
 case 'publish':return output(academy.publishContent(a,c.id||''));
 default:throw new academy.DomainError('未知的操作');}
 }catch(e){return failure(e);}}
