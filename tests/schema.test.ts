import {PGlite} from '@electric-sql/pglite';
import {readFileSync} from 'node:fs';
import {expect,it} from 'vitest';
it('applies PostgreSQL foundation and enforces household RLS and write restrictions',async()=>{
 const pg=new PGlite();try{
 await pg.exec(`CREATE ROLE anon;CREATE ROLE authenticated;CREATE SCHEMA auth;CREATE TABLE auth.users(id uuid PRIMARY KEY);CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;GRANT USAGE ON SCHEMA auth TO authenticated;GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated;`);
 await pg.exec(readFileSync('supabase/migrations/202611020001_foundation.sql','utf8'));
 const tables=await pg.query<{tablename:string;rowsecurity:boolean}>("SELECT tablename,rowsecurity FROM pg_tables WHERE schemaname='public'");expect(tables.rows.length).toBeGreaterThanOrEqual(40);expect(tables.rows.every(t=>t.rowsecurity)).toBe(true);
 const s1='00000000-0000-4000-8000-000000000001',p1='00000000-0000-4000-8000-000000000002',s2='00000000-0000-4000-8000-000000000003',f1='10000000-0000-4000-8000-000000000001',f2='10000000-0000-4000-8000-000000000002';
 await pg.exec(`INSERT INTO auth.users VALUES('${s1}'),('${p1}'),('${s2}');INSERT INTO public.families(id) VALUES('${f1}'),('${f2}');INSERT INTO public.profiles VALUES('${s1}','${f1}','A','student'),('${p1}','${f1}','Parent','parent'),('${s2}','${f2}','B','student');INSERT INTO public.student_objective_mastery SELECT '${s1}',id,0,0,now() FROM public.learning_objectives;SET ROLE authenticated;SET request.jwt.claim.sub='${p1}';`);
 await pg.exec(`RESET ROLE;INSERT INTO public.content_sources(id,title,url,source_kind,license_note) VALUES('20000000-0000-4000-8000-000000000001','Test','https://www.naer.edu.tw/','original','Test only');INSERT INTO public.questions(id,author_id) VALUES('30000000-0000-4000-8000-000000000001','${p1}');INSERT INTO public.question_versions(id,question_id,version,prompt,choices,answer_index,hint,explanation,difficulty,source_id) VALUES('40000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001',1,'Test question','["a","b"]',0,'Hint','Explanation',1,'20000000-0000-4000-8000-000000000001');`);
 await expect(pg.exec(`INSERT INTO public.content_reviews(question_version_id,reviewer_id,decision,note) VALUES('40000000-0000-4000-8000-000000000001','${p1}','approved','This is a test review note')`)).rejects.toThrow('independent');
 await expect(pg.exec(`INSERT INTO public.publication_releases(question_version_id,published_by) VALUES('40000000-0000-4000-8000-000000000001','${p1}')`)).rejects.toThrow('verified provenance');
 await pg.exec('SET ROLE authenticated');
 expect((await pg.query('SELECT * FROM public.profiles')).rows).toHaveLength(2);
 await pg.exec(`SET request.jwt.claim.sub='${s1}'`);expect((await pg.query('SELECT * FROM public.profiles')).rows).toHaveLength(1);
 await expect(pg.exec(`UPDATE public.profiles SET role='admin'`)).rejects.toThrow('permission denied');
 await expect(pg.query('SELECT * FROM public.question_versions')).rejects.toThrow('permission denied');
 }finally{await pg.close();}
},30000);
