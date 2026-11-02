// Local metadata mirrors the curriculum concepts in the PostgreSQL migration.
// Identifiers below are a closed allowlist; caller input is never interpolated into SQL.
export const catalogDefinitions={
 curriculum_frameworks:{name:'課綱',fields:['name','version','source_id'],required:['name','version','source_id']},
 curriculum_standards:{name:'學習內容／表現',fields:['framework_id','code','kind','description'],required:['framework_id','code','kind','description']},
 competency_indicators:{name:'核心素養',fields:['framework_id','code','description'],required:['framework_id','code','description']},
 academic_years:{name:'學年度',fields:['roc_year','starts_on','ends_on'],required:['roc_year','starts_on','ends_on']},
 subjects:{name:'科目',fields:['code','name','language_code'],required:['code','name']},
 publishers:{name:'出版社',fields:['name','official_url'],required:['name']},
 content_sources:{name:'教材來源',fields:['title','url','license_note','accessed_at'],required:['title','url','license_note','accessed_at']},
 textbook_editions:{name:'教科書版本',fields:['publisher_id','subject_id','academic_year_id','edition_label','source_id','status'],required:['publisher_id','subject_id','academic_year_id','edition_label','source_id','status']},
 textbook_volumes:{name:'冊次',fields:['edition_id','grade_id','semester_id','volume_label'],required:['edition_id','grade_id','semester_id','volume_label']},
 textbook_units:{name:'單元',fields:['volume_id','title','sequence','source_id'],required:['volume_id','title','sequence','source_id']},
 textbook_sections:{name:'小節',fields:['unit_id','title','sequence','source_id'],required:['unit_id','title','sequence','source_id']},
 learning_objectives:{name:'知識點',fields:['subject_id','code','title','description'],required:['subject_id','code','title','description']},
 grade_subject_availability:{name:'年級適用科目',fields:['grade_id','subject_id','framework_id','source_id'],required:['grade_id','subject_id','framework_id','source_id']},
 section_objective_mappings:{name:'小節對應知識點',fields:['section_id','objective_id'],required:['section_id','objective_id']},
 objective_standard_mappings:{name:'知識點對應課綱',fields:['objective_id','standard_id'],required:['objective_id','standard_id']},
 objective_competency_mappings:{name:'知識點對應素養',fields:['objective_id','indicator_id'],required:['objective_id','indicator_id']},
 objective_prerequisites:{name:'前置知識點',fields:['objective_id','prerequisite_id'],required:['objective_id','prerequisite_id']},
 learning_materials:{name:'學習素材',fields:['objective_id','title','body','source_id','status'],required:['objective_id','title','body','source_id','status']},
} as const;
export type CatalogTable=keyof typeof catalogDefinitions;
export const catalogSql=`
CREATE TABLE IF NOT EXISTS content_sources(id TEXT PRIMARY KEY,title TEXT NOT NULL,url TEXT NOT NULL,license_note TEXT NOT NULL,accessed_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS curriculum_frameworks(id TEXT PRIMARY KEY,name TEXT NOT NULL,version TEXT NOT NULL,source_id TEXT NOT NULL REFERENCES content_sources(id));
CREATE TABLE IF NOT EXISTS curriculum_standards(id TEXT PRIMARY KEY,framework_id TEXT NOT NULL REFERENCES curriculum_frameworks(id),code TEXT NOT NULL,kind TEXT NOT NULL CHECK(kind IN ('content','performance')),description TEXT NOT NULL,UNIQUE(framework_id,code,kind));
CREATE TABLE IF NOT EXISTS competency_indicators(id TEXT PRIMARY KEY,framework_id TEXT NOT NULL REFERENCES curriculum_frameworks(id),code TEXT NOT NULL,description TEXT NOT NULL,UNIQUE(framework_id,code));
CREATE TABLE IF NOT EXISTS academic_years(id TEXT PRIMARY KEY,roc_year INTEGER UNIQUE NOT NULL CHECK(roc_year>100),starts_on TEXT NOT NULL,ends_on TEXT NOT NULL,CHECK(ends_on>starts_on));
CREATE TABLE IF NOT EXISTS grades(id INTEGER PRIMARY KEY CHECK(id BETWEEN 1 AND 6),name TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS semesters(id INTEGER PRIMARY KEY CHECK(id IN(1,2)),name TEXT NOT NULL);
INSERT OR IGNORE INTO grades VALUES(1,'一年級'),(2,'二年級'),(3,'三年級'),(4,'四年級'),(5,'五年級'),(6,'六年級');
INSERT OR IGNORE INTO semesters VALUES(1,'上學期'),(2,'下學期');
CREATE TABLE IF NOT EXISTS subjects(id TEXT PRIMARY KEY,code TEXT UNIQUE NOT NULL,name TEXT NOT NULL,language_code TEXT DEFAULT 'zh-TW');
CREATE TABLE IF NOT EXISTS publishers(id TEXT PRIMARY KEY,name TEXT UNIQUE NOT NULL,official_url TEXT);
CREATE TABLE IF NOT EXISTS textbook_editions(id TEXT PRIMARY KEY,publisher_id TEXT NOT NULL REFERENCES publishers(id),subject_id TEXT NOT NULL REFERENCES subjects(id),academic_year_id TEXT NOT NULL REFERENCES academic_years(id),edition_label TEXT NOT NULL,source_id TEXT NOT NULL REFERENCES content_sources(id),status TEXT NOT NULL CHECK(status IN('unverified','retired')),UNIQUE(publisher_id,subject_id,academic_year_id,edition_label));
CREATE TABLE IF NOT EXISTS textbook_volumes(id TEXT PRIMARY KEY,edition_id TEXT NOT NULL REFERENCES textbook_editions(id),grade_id INTEGER NOT NULL REFERENCES grades(id),semester_id INTEGER NOT NULL REFERENCES semesters(id),volume_label TEXT NOT NULL,UNIQUE(edition_id,grade_id,semester_id));
CREATE TABLE IF NOT EXISTS textbook_units(id TEXT PRIMARY KEY,volume_id TEXT NOT NULL REFERENCES textbook_volumes(id),title TEXT NOT NULL,sequence INTEGER NOT NULL CHECK(sequence>0),source_id TEXT NOT NULL REFERENCES content_sources(id),UNIQUE(volume_id,sequence));
CREATE TABLE IF NOT EXISTS textbook_sections(id TEXT PRIMARY KEY,unit_id TEXT NOT NULL REFERENCES textbook_units(id),title TEXT NOT NULL,sequence INTEGER NOT NULL CHECK(sequence>0),source_id TEXT NOT NULL REFERENCES content_sources(id),UNIQUE(unit_id,sequence));
CREATE TABLE IF NOT EXISTS learning_objectives(id TEXT PRIMARY KEY,subject_id TEXT NOT NULL REFERENCES subjects(id),code TEXT UNIQUE NOT NULL,title TEXT NOT NULL,description TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS grade_subject_availability(id TEXT PRIMARY KEY,grade_id INTEGER NOT NULL REFERENCES grades(id),subject_id TEXT NOT NULL REFERENCES subjects(id),framework_id TEXT NOT NULL REFERENCES curriculum_frameworks(id),source_id TEXT NOT NULL REFERENCES content_sources(id),UNIQUE(grade_id,subject_id,framework_id));
CREATE TABLE IF NOT EXISTS section_objective_mappings(id TEXT PRIMARY KEY,section_id TEXT NOT NULL REFERENCES textbook_sections(id),objective_id TEXT NOT NULL REFERENCES learning_objectives(id),UNIQUE(section_id,objective_id));
CREATE TABLE IF NOT EXISTS objective_standard_mappings(id TEXT PRIMARY KEY,objective_id TEXT NOT NULL REFERENCES learning_objectives(id),standard_id TEXT NOT NULL REFERENCES curriculum_standards(id),UNIQUE(objective_id,standard_id));
CREATE TABLE IF NOT EXISTS objective_competency_mappings(id TEXT PRIMARY KEY,objective_id TEXT NOT NULL REFERENCES learning_objectives(id),indicator_id TEXT NOT NULL REFERENCES competency_indicators(id),UNIQUE(objective_id,indicator_id));
CREATE TABLE IF NOT EXISTS objective_prerequisites(id TEXT PRIMARY KEY,objective_id TEXT NOT NULL REFERENCES learning_objectives(id),prerequisite_id TEXT NOT NULL REFERENCES learning_objectives(id),CHECK(objective_id<>prerequisite_id),UNIQUE(objective_id,prerequisite_id));
CREATE TABLE IF NOT EXISTS learning_materials(id TEXT PRIMARY KEY,objective_id TEXT NOT NULL REFERENCES learning_objectives(id),title TEXT NOT NULL,body TEXT NOT NULL,source_id TEXT NOT NULL REFERENCES content_sources(id),status TEXT NOT NULL CHECK(status='draft'));
CREATE TABLE IF NOT EXISTS question_objective_mappings(question_id TEXT REFERENCES questions(id),objective_id TEXT REFERENCES objectives(id),PRIMARY KEY(question_id,objective_id));
CREATE TABLE IF NOT EXISTS question_versions(id TEXT PRIMARY KEY,question_id TEXT REFERENCES questions(id),version INTEGER NOT NULL,payload TEXT NOT NULL,created_at TEXT NOT NULL,UNIQUE(question_id,version));
CREATE TABLE IF NOT EXISTS question_assets(id TEXT PRIMARY KEY,question_id TEXT NOT NULL REFERENCES questions(id),storage_path TEXT NOT NULL,alt_text TEXT NOT NULL,license_note TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS student_subject_preferences(student_id TEXT REFERENCES accounts(id),subject_id TEXT REFERENCES subjects(id),academic_year_id TEXT REFERENCES academic_years(id),volume_id TEXT NOT NULL REFERENCES textbook_volumes(id),PRIMARY KEY(student_id,subject_id,academic_year_id));
`;
