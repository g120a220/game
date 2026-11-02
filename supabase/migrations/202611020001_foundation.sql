-- Phase 1 cloud foundation. Apply with Supabase migrations, not to the local SQLite file.
-- No textbook tables are seeded with unverified publisher chapter names.
BEGIN;
CREATE TABLE public.curriculum_frameworks(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),name text NOT NULL,version text NOT NULL,source_url text NOT NULL,effective_from date,UNIQUE(name,version));
CREATE TABLE public.curriculum_standards(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),framework_id uuid NOT NULL REFERENCES public.curriculum_frameworks(id),code text NOT NULL,kind text NOT NULL CHECK(kind IN ('content','performance')),description text NOT NULL,UNIQUE(framework_id,code,kind));
CREATE TABLE public.competency_indicators(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),framework_id uuid NOT NULL REFERENCES public.curriculum_frameworks(id),code text NOT NULL,description text NOT NULL,UNIQUE(framework_id,code));
CREATE TABLE public.academic_years(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),roc_year int UNIQUE NOT NULL CHECK(roc_year>100),starts_on date NOT NULL,ends_on date NOT NULL,CHECK(ends_on>starts_on));
CREATE TABLE public.grades(id smallint PRIMARY KEY CHECK(id BETWEEN 1 AND 6),name text NOT NULL);
INSERT INTO public.grades VALUES(1,'一年級'),(2,'二年級'),(3,'三年級'),(4,'四年級'),(5,'五年級'),(6,'六年級');
CREATE TABLE public.semesters(id smallint PRIMARY KEY CHECK(id IN(1,2)),name text NOT NULL);
INSERT INTO public.semesters VALUES(1,'上學期'),(2,'下學期');
CREATE TABLE public.subjects(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),code text UNIQUE NOT NULL,name text NOT NULL,language_code text NOT NULL DEFAULT 'zh-TW');
CREATE TABLE public.grade_subject_availability(grade_id smallint REFERENCES public.grades(id),subject_id uuid REFERENCES public.subjects(id),framework_id uuid REFERENCES public.curriculum_frameworks(id),verified_source_url text NOT NULL,PRIMARY KEY(grade_id,subject_id,framework_id));
CREATE TABLE public.publishers(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),name text UNIQUE NOT NULL,official_url text);
CREATE TABLE public.content_sources(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),title text NOT NULL,url text NOT NULL,source_kind text NOT NULL CHECK(source_kind IN('curriculum','approval','publisher','school','licensed','original')),license_note text NOT NULL,accessed_at timestamptz NOT NULL DEFAULT now(),verified_at timestamptz,verified_by uuid REFERENCES auth.users(id));
CREATE TABLE public.textbook_editions(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),publisher_id uuid NOT NULL REFERENCES public.publishers(id),subject_id uuid NOT NULL REFERENCES public.subjects(id),academic_year_id uuid NOT NULL REFERENCES public.academic_years(id),edition_label text NOT NULL,approval_code text,source_id uuid REFERENCES public.content_sources(id),status text NOT NULL DEFAULT 'unverified' CHECK(status IN('unverified','verified','retired')),UNIQUE(publisher_id,subject_id,academic_year_id,edition_label));
CREATE TABLE public.textbook_volumes(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),edition_id uuid NOT NULL REFERENCES public.textbook_editions(id),grade_id smallint NOT NULL REFERENCES public.grades(id),semester_id smallint NOT NULL REFERENCES public.semesters(id),volume_label text NOT NULL,UNIQUE(edition_id,grade_id,semester_id));
CREATE TABLE public.textbook_units(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),volume_id uuid NOT NULL REFERENCES public.textbook_volumes(id),title text NOT NULL,sequence int NOT NULL CHECK(sequence>0),source_id uuid NOT NULL REFERENCES public.content_sources(id),UNIQUE(volume_id,sequence));
CREATE TABLE public.textbook_sections(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),unit_id uuid NOT NULL REFERENCES public.textbook_units(id),title text NOT NULL,sequence int NOT NULL CHECK(sequence>0),source_id uuid NOT NULL REFERENCES public.content_sources(id),UNIQUE(unit_id,sequence));
CREATE TABLE public.learning_objectives(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),subject_id uuid NOT NULL REFERENCES public.subjects(id),code text UNIQUE NOT NULL,title text NOT NULL,description text NOT NULL,minimum_grade smallint REFERENCES public.grades(id));
CREATE TABLE public.objective_standard_mappings(objective_id uuid REFERENCES public.learning_objectives(id),standard_id uuid REFERENCES public.curriculum_standards(id),PRIMARY KEY(objective_id,standard_id));
CREATE TABLE public.objective_competency_mappings(objective_id uuid REFERENCES public.learning_objectives(id),indicator_id uuid REFERENCES public.competency_indicators(id),PRIMARY KEY(objective_id,indicator_id));
CREATE TABLE public.objective_prerequisites(objective_id uuid REFERENCES public.learning_objectives(id),prerequisite_id uuid REFERENCES public.learning_objectives(id),PRIMARY KEY(objective_id,prerequisite_id),CHECK(objective_id<>prerequisite_id));
CREATE TABLE public.section_objective_mappings(section_id uuid REFERENCES public.textbook_sections(id),objective_id uuid REFERENCES public.learning_objectives(id),PRIMARY KEY(section_id,objective_id));
CREATE TABLE public.learning_materials(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),objective_id uuid REFERENCES public.learning_objectives(id),title text NOT NULL,body jsonb NOT NULL,source_id uuid NOT NULL REFERENCES public.content_sources(id),status text NOT NULL DEFAULT 'draft' CHECK(status IN('draft','approved','published','retired')));
CREATE TABLE public.questions(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),author_id uuid NOT NULL REFERENCES auth.users(id),created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.question_versions(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),question_id uuid NOT NULL REFERENCES public.questions(id),version int NOT NULL CHECK(version>0),prompt text NOT NULL,choices jsonb NOT NULL CHECK(jsonb_typeof(choices)='array' AND jsonb_array_length(choices) BETWEEN 2 AND 4),answer_index smallint NOT NULL,hint text NOT NULL,explanation text NOT NULL,difficulty smallint NOT NULL CHECK(difficulty BETWEEN 1 AND 5),source_id uuid NOT NULL REFERENCES public.content_sources(id),status text NOT NULL DEFAULT 'draft' CHECK(status IN('draft','approved','published','retired')),created_at timestamptz NOT NULL DEFAULT now(),CHECK(answer_index>=0 AND answer_index<jsonb_array_length(choices)),UNIQUE(question_id,version));
CREATE TABLE public.question_objective_mappings(question_version_id uuid REFERENCES public.question_versions(id),objective_id uuid REFERENCES public.learning_objectives(id),PRIMARY KEY(question_version_id,objective_id));
CREATE TABLE public.question_assets(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),question_version_id uuid NOT NULL REFERENCES public.question_versions(id),storage_path text UNIQUE NOT NULL,alt_text text NOT NULL,license_note text NOT NULL);
CREATE TABLE public.content_reviews(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),question_version_id uuid NOT NULL REFERENCES public.question_versions(id),reviewer_id uuid NOT NULL REFERENCES auth.users(id),decision text NOT NULL CHECK(decision IN('approved','rejected')),note text NOT NULL CHECK(length(note)>=10),created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.publication_releases(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),volume_id uuid REFERENCES public.textbook_volumes(id),question_version_id uuid REFERENCES public.question_versions(id),published_by uuid NOT NULL REFERENCES auth.users(id),published_at timestamptz NOT NULL DEFAULT now(),CHECK((volume_id IS NULL)<>(question_version_id IS NULL)));
CREATE TABLE public.families(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.profiles(id uuid PRIMARY KEY REFERENCES auth.users(id),family_id uuid REFERENCES public.families(id),nickname text NOT NULL,role text NOT NULL CHECK(role IN('student','parent','editor','reviewer','admin')));
CREATE TABLE public.parent_consents(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),family_id uuid NOT NULL REFERENCES public.families(id),parent_id uuid NOT NULL REFERENCES public.profiles(id),policy_version text NOT NULL,granted_at timestamptz NOT NULL DEFAULT now(),revoked_at timestamptz);
CREATE TABLE public.student_subject_preferences(student_id uuid REFERENCES public.profiles(id),subject_id uuid REFERENCES public.subjects(id),academic_year_id uuid REFERENCES public.academic_years(id),volume_id uuid NOT NULL REFERENCES public.textbook_volumes(id),PRIMARY KEY(student_id,subject_id,academic_year_id));
CREATE TABLE public.learning_sessions(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),student_id uuid NOT NULL REFERENCES public.profiles(id),mode text NOT NULL CHECK(mode IN('school','remediation','advance','demo')),question_versions uuid[] NOT NULL,status text NOT NULL DEFAULT 'active' CHECK(status IN('active','completed','expired')),started_at timestamptz NOT NULL DEFAULT now(),finished_at timestamptz);
CREATE UNIQUE INDEX active_learning_session ON public.learning_sessions(student_id) WHERE status='active';
CREATE TABLE public.attempts(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),session_id uuid NOT NULL REFERENCES public.learning_sessions(id),student_id uuid NOT NULL REFERENCES public.profiles(id),question_version_id uuid NOT NULL REFERENCES public.question_versions(id),selected_index smallint NOT NULL,correct boolean NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(session_id,question_version_id));
CREATE TABLE public.student_objective_mastery(student_id uuid REFERENCES public.profiles(id),objective_id uuid REFERENCES public.learning_objectives(id),correct int NOT NULL DEFAULT 0,total int NOT NULL DEFAULT 0,updated_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(student_id,objective_id),CHECK(correct>=0 AND correct<=total));
CREATE TABLE public.reward_ledger(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),student_id uuid NOT NULL REFERENCES public.profiles(id),session_id uuid NOT NULL REFERENCES public.learning_sessions(id),kind text NOT NULL,period date NOT NULL,amount int NOT NULL CHECK(amount BETWEEN 0 AND 10),created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(student_id,kind,period));
CREATE TABLE public.family_rewards(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),family_id uuid NOT NULL REFERENCES public.families(id),title text NOT NULL,cost int NOT NULL CHECK(cost BETWEEN 1 AND 80),active boolean NOT NULL DEFAULT true);
CREATE TABLE public.redemptions(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),reward_id uuid NOT NULL REFERENCES public.family_rewards(id),student_id uuid NOT NULL REFERENCES public.profiles(id),request_key uuid UNIQUE NOT NULL,cost int NOT NULL CHECK(cost BETWEEN 1 AND 80),status text NOT NULL DEFAULT 'pending' CHECK(status IN('pending','fulfilled')),created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.pets(student_id uuid PRIMARY KEY REFERENCES public.profiles(id),species text NOT NULL DEFAULT 'fox',nickname text NOT NULL DEFAULT '小栗');
CREATE TABLE public.membership_plans(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),code text UNIQUE NOT NULL,name text NOT NULL,features jsonb NOT NULL);
CREATE TABLE public.subscriptions(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),parent_id uuid NOT NULL REFERENCES public.profiles(id),plan_id uuid NOT NULL REFERENCES public.membership_plans(id),provider_reference text UNIQUE,status text NOT NULL CHECK(status IN('pending','active','cancelled','expired')));
CREATE TABLE public.sponsorship_campaigns(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),sponsor_name text NOT NULL,asset_path text NOT NULL,review_status text NOT NULL DEFAULT 'draft' CHECK(review_status IN('draft','approved','rejected')),child_safe_review_note text,starts_at timestamptz,ends_at timestamptz);
CREATE TABLE public.audit_logs(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),actor_id uuid REFERENCES auth.users(id),action text NOT NULL,target_id uuid,created_at timestamptz NOT NULL DEFAULT now());
-- Database-level provenance gates remain in effect for server/service-role writes.
CREATE FUNCTION public.check_independent_review() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
DECLARE author uuid; state text;
BEGIN
 SELECT q.author_id,v.status INTO author,state FROM public.question_versions v JOIN public.questions q ON q.id=v.question_id WHERE v.id=NEW.question_version_id;
 IF author=NEW.reviewer_id OR state<>'draft' THEN RAISE EXCEPTION 'Review must be independent and target a draft version';END IF;
 RETURN NEW;
END$$;
CREATE TRIGGER independent_review BEFORE INSERT ON public.content_reviews FOR EACH ROW EXECUTE FUNCTION public.check_independent_review();
CREATE FUNCTION public.check_publication() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
DECLARE approved boolean;
BEGIN
 IF NEW.question_version_id IS NOT NULL THEN
 SELECT v.status='approved' AND src.verified_at IS NOT NULL AND EXISTS(SELECT 1 FROM public.content_reviews r WHERE r.question_version_id=v.id AND r.decision='approved' AND r.reviewer_id<>q.author_id) INTO approved
 FROM public.question_versions v JOIN public.questions q ON q.id=v.question_id JOIN public.content_sources src ON src.id=v.source_id WHERE v.id=NEW.question_version_id;
 ELSE
 SELECT e.status='verified' AND src.verified_at IS NOT NULL INTO approved FROM public.textbook_volumes v JOIN public.textbook_editions e ON e.id=v.edition_id JOIN public.content_sources src ON src.id=e.source_id WHERE v.id=NEW.volume_id;
 END IF;
 IF approved IS DISTINCT FROM true THEN RAISE EXCEPTION 'Publication requires verified provenance and independent approval'; END IF;
 RETURN NEW;
END$$;
CREATE TRIGGER publication_gate BEFORE INSERT ON public.publication_releases FOR EACH ROW EXECUTE FUNCTION public.check_publication();
-- These helpers are stable, explicit-search-path and security-definer to avoid RLS recursion.
CREATE FUNCTION public.current_family() RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$SELECT family_id FROM public.profiles WHERE id=auth.uid()$$;
CREATE FUNCTION public.owns_student(student uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$SELECT EXISTS(SELECT 1 FROM public.profiles me JOIN public.profiles child ON child.family_id=me.family_id WHERE me.id=auth.uid() AND child.id=student AND (me.id=child.id OR me.role='parent'))$$;
-- Enable RLS and deny direct writes on EVERY table. Mutations must use audited server transactions.
DO $$DECLARE t record;BEGIN FOR t IN SELECT tablename FROM pg_tables WHERE schemaname='public' LOOP EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t.tablename);EXECUTE format('REVOKE ALL ON public.%I FROM anon,authenticated',t.tablename);END LOOP;END$$;
GRANT USAGE ON SCHEMA public TO anon,authenticated;
GRANT SELECT ON public.grades,public.semesters TO anon,authenticated;
CREATE POLICY public_grades ON public.grades FOR SELECT USING(true);
CREATE POLICY public_semesters ON public.semesters FOR SELECT USING(true);
GRANT SELECT ON public.profiles,public.families,public.parent_consents,public.student_subject_preferences,public.learning_sessions,public.attempts,public.student_objective_mastery,public.reward_ledger,public.family_rewards,public.redemptions,public.pets TO authenticated;
CREATE POLICY profile_household ON public.profiles FOR SELECT TO authenticated USING(id=auth.uid() OR (family_id=public.current_family() AND EXISTS(SELECT 1 FROM public.profiles p WHERE p.id=auth.uid() AND p.role='parent')));
-- Avoid profile-policy self recursion via the existing security definer helper.
DROP POLICY profile_household ON public.profiles;
CREATE POLICY profile_household ON public.profiles FOR SELECT TO authenticated USING(public.owns_student(id));
CREATE POLICY family_read ON public.families FOR SELECT TO authenticated USING(id=public.current_family());
CREATE POLICY consent_read ON public.parent_consents FOR SELECT TO authenticated USING(family_id=public.current_family());
CREATE POLICY preferences_read ON public.student_subject_preferences FOR SELECT TO authenticated USING(public.owns_student(student_id));
CREATE POLICY sessions_read ON public.learning_sessions FOR SELECT TO authenticated USING(public.owns_student(student_id));
CREATE POLICY attempts_read ON public.attempts FOR SELECT TO authenticated USING(public.owns_student(student_id));
CREATE POLICY mastery_read ON public.student_objective_mastery FOR SELECT TO authenticated USING(public.owns_student(student_id));
CREATE POLICY ledger_read ON public.reward_ledger FOR SELECT TO authenticated USING(public.owns_student(student_id));
CREATE POLICY rewards_read ON public.family_rewards FOR SELECT TO authenticated USING(family_id=public.current_family());
CREATE POLICY redemptions_read ON public.redemptions FOR SELECT TO authenticated USING(public.owns_student(student_id));
CREATE POLICY pets_read ON public.pets FOR SELECT TO authenticated USING(public.owns_student(student_id));
-- question_versions (including answers) and content drafts are intentionally not client-readable.
REVOKE ALL ON FUNCTION public.current_family() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.owns_student(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_family(),public.owns_student(uuid) TO authenticated;
COMMIT;
