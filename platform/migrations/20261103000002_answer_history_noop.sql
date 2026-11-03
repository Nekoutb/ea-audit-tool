-- D1 (DEV test run 2026-11-03): the first save of a paper logged one
-- answer_changed row per untouched field — before '' (the prior-year or
-- default marker), after '""' (the empty JSON string the form writes) — on top
-- of the one real change. Thirteen rows of noise for a single answer.
--
-- The trigger of 20261027000002 compared values with IS DISTINCT FROM, which
-- tells NULL, '' and '""' apart. For an answer they are the same thing: nobody
-- said anything. This migration replaces the function so that the three are
-- equivalent and a change between equivalents is not recorded. The DELETE+
-- INSERT replace path, the per-transaction marker and the carried-forward
-- rule are unchanged. History already written stays (activity_log is
-- append-only).
--
-- Reversible: the down migration restores the previous function body.

-- Up Migration

-- '' , '""' (jsonb empty string) and NULL all mean "no answer"
CREATE OR REPLACE FUNCTION form_response_answer_blank(v jsonb) RETURNS boolean AS $$
  SELECT v IS NULL
      OR v = 'null'::jsonb
      OR (jsonb_typeof(v) = 'string' AND btrim(v #>> '{}') = '');
$$ LANGUAGE sql IMMUTABLE;

-- equal, or both blank
CREATE OR REPLACE FUNCTION form_response_answer_same(a jsonb, b jsonb) RETURNS boolean AS $$
  SELECT (form_response_answer_blank(a) AND form_response_answer_blank(b)) OR a IS NOT DISTINCT FROM b;
$$ LANGUAGE sql IMMUTABLE;

CREATE OR REPLACE FUNCTION form_response_answer_history() RETURNS trigger AS $$
DECLARE
  k_tenant uuid;
  k_engagement uuid;
  k_code text;
  k_field text;
  v_before jsonb;
  v_after jsonb;
  v_user uuid;
  v_entity uuid;
  cur record;
BEGIN
  IF TG_OP = 'DELETE' THEN
    k_tenant := OLD.tenant_id; k_engagement := OLD.engagement_id; k_code := OLD.code; k_field := OLD.field_key;
  ELSE
    k_tenant := NEW.tenant_id; k_engagement := NEW.engagement_id; k_code := NEW.code; k_field := NEW.field_key;
  END IF;

  -- the engagement is gone (tenant or file deleted): nothing to record against
  IF NOT EXISTS (SELECT 1 FROM engagement WHERE id = k_engagement) THEN
    RETURN NULL;
  END IF;

  -- one entry per field per transaction: a replace already recorded is done
  IF EXISTS (
    SELECT 1 FROM activity_log
     WHERE engagement_id = k_engagement AND entity_type = 'form_response'
       AND meta->>'code' = k_code AND meta->>'field' = k_field
       AND created_at = now()
  ) THEN
    RETURN NULL;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    -- the row as it stands at commit: several updates in one transaction are one change
    SELECT id, value, updated_by INTO cur FROM form_response WHERE id = NEW.id;
    IF NOT FOUND THEN RETURN NULL; END IF;  -- deleted later on: the DELETE records it
    IF form_response_answer_same(OLD.value, cur.value) THEN RETURN NULL; END IF;
    v_before := OLD.value; v_after := cur.value; v_user := cur.updated_by; v_entity := cur.id;
  ELSIF TG_OP = 'DELETE' THEN
    SELECT id, value, updated_by INTO cur FROM form_response
     WHERE engagement_id = k_engagement AND code = k_code AND field_key = k_field;
    v_before := OLD.value;
    IF FOUND THEN
      -- replaced in the same transaction: one change, by the new row's writer.
      -- Replaced by the same value (or blank by blank): no change, and the
      -- INSERT that follows is told so (a transaction-local marker).
      IF form_response_answer_same(OLD.value, cur.value) THEN
        PERFORM set_config('ea_answer.k' || md5(k_engagement::text || '|' || k_code || '|' || k_field), '1', true);
        RETURN NULL;
      END IF;
      v_after := cur.value; v_user := cur.updated_by; v_entity := cur.id;
    ELSE
      -- cleared: the writer is not on the deleted row; the trail says so.
      -- Clearing a blank is not a change.
      IF form_response_answer_blank(OLD.value) THEN RETURN NULL; END IF;
      v_after := NULL; v_user := NULL; v_entity := OLD.id;
    END IF;
  ELSE
    SELECT id, value, updated_by, carried_forward INTO cur FROM form_response WHERE id = NEW.id;
    IF NOT FOUND OR cur.carried_forward THEN RETURN NULL; END IF;
    IF current_setting('ea_answer.k' || md5(k_engagement::text || '|' || k_code || '|' || k_field), true) = '1' THEN
      RETURN NULL;
    END IF;
    -- an insert's previous value is the last one the trail recorded, if any
    SELECT after_value INTO v_before FROM activity_log
     WHERE engagement_id = k_engagement AND entity_type = 'form_response'
       AND meta->>'code' = k_code AND meta->>'field' = k_field
     ORDER BY created_at DESC LIMIT 1;
    IF form_response_answer_same(v_before, cur.value) THEN RETURN NULL; END IF;
    v_after := cur.value; v_user := cur.updated_by; v_entity := cur.id;
  END IF;

  INSERT INTO activity_log
    (tenant_id, engagement_id, user_id, acting_role, entity_type, entity_id,
     action, summary, meta, before_value, after_value, outcome)
  VALUES (
    k_tenant, k_engagement, v_user,
    (SELECT m.role::text FROM membership m WHERE m.user_id = v_user AND m.tenant_id = k_tenant),
    'form_response', v_entity, 'answer_changed',
    k_code || ' · ' || k_field || CASE WHEN v_after IS NULL THEN ' cleared' ELSE ' changed' END,
    jsonb_build_object('code', k_code, 'field', k_field),
    v_before, v_after, 'success'
  );
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Down Migration

-- the 20261027000002 body, verbatim
CREATE OR REPLACE FUNCTION form_response_answer_history() RETURNS trigger AS $$
DECLARE
  k_tenant uuid;
  k_engagement uuid;
  k_code text;
  k_field text;
  v_before jsonb;
  v_after jsonb;
  v_user uuid;
  v_entity uuid;
  cur record;
BEGIN
  IF TG_OP = 'DELETE' THEN
    k_tenant := OLD.tenant_id; k_engagement := OLD.engagement_id; k_code := OLD.code; k_field := OLD.field_key;
  ELSE
    k_tenant := NEW.tenant_id; k_engagement := NEW.engagement_id; k_code := NEW.code; k_field := NEW.field_key;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM engagement WHERE id = k_engagement) THEN
    RETURN NULL;
  END IF;

  IF EXISTS (
    SELECT 1 FROM activity_log
     WHERE engagement_id = k_engagement AND entity_type = 'form_response'
       AND meta->>'code' = k_code AND meta->>'field' = k_field
       AND created_at = now()
  ) THEN
    RETURN NULL;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    SELECT id, value, updated_by INTO cur FROM form_response WHERE id = NEW.id;
    IF NOT FOUND THEN RETURN NULL; END IF;
    IF OLD.value IS NOT DISTINCT FROM cur.value THEN RETURN NULL; END IF;
    v_before := OLD.value; v_after := cur.value; v_user := cur.updated_by; v_entity := cur.id;
  ELSIF TG_OP = 'DELETE' THEN
    SELECT id, value, updated_by INTO cur FROM form_response
     WHERE engagement_id = k_engagement AND code = k_code AND field_key = k_field;
    v_before := OLD.value;
    IF FOUND THEN
      IF OLD.value IS NOT DISTINCT FROM cur.value THEN
        PERFORM set_config('ea_answer.k' || md5(k_engagement::text || '|' || k_code || '|' || k_field), '1', true);
        RETURN NULL;
      END IF;
      v_after := cur.value; v_user := cur.updated_by; v_entity := cur.id;
    ELSE
      v_after := NULL; v_user := NULL; v_entity := OLD.id;
    END IF;
  ELSE
    SELECT id, value, updated_by, carried_forward INTO cur FROM form_response WHERE id = NEW.id;
    IF NOT FOUND OR cur.carried_forward THEN RETURN NULL; END IF;
    IF current_setting('ea_answer.k' || md5(k_engagement::text || '|' || k_code || '|' || k_field), true) = '1' THEN
      RETURN NULL;
    END IF;
    SELECT after_value INTO v_before FROM activity_log
     WHERE engagement_id = k_engagement AND entity_type = 'form_response'
       AND meta->>'code' = k_code AND meta->>'field' = k_field
     ORDER BY created_at DESC LIMIT 1;
    IF v_before IS NOT DISTINCT FROM cur.value THEN RETURN NULL; END IF;
    v_after := cur.value; v_user := cur.updated_by; v_entity := cur.id;
  END IF;

  INSERT INTO activity_log
    (tenant_id, engagement_id, user_id, acting_role, entity_type, entity_id,
     action, summary, meta, before_value, after_value, outcome)
  VALUES (
    k_tenant, k_engagement, v_user,
    (SELECT m.role::text FROM membership m WHERE m.user_id = v_user AND m.tenant_id = k_tenant),
    'form_response', v_entity, 'answer_changed',
    k_code || ' · ' || k_field || CASE WHEN v_after IS NULL THEN ' cleared' ELSE ' changed' END,
    jsonb_build_object('code', k_code, 'field', k_field),
    v_before, v_after, 'success'
  );
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP FUNCTION IF EXISTS form_response_answer_same(jsonb, jsonb);
DROP FUNCTION IF EXISTS form_response_answer_blank(jsonb);
