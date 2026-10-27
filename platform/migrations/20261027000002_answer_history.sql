-- F027 (firm decision 2026-10-27): full before/after values for every
-- working-paper answer change.
--
-- Answers live in form_response, one row per (engagement, code, field), and
-- some fifteen code paths write them — the working-paper editor, the forms,
-- the SCOT studio, the planning summary, the significance grid, the JE and SAD
-- tools. Rather than ask each of them to remember, a trigger on form_response
-- appends one activity_log row per changed field: entity_type 'form_response',
-- action 'answer_changed', meta {code, field}, before_value = the old value,
-- after_value = the new one (null when the answer was cleared). activity_log
-- is already append-only (20260820000005), carries the firm's whole trail and
-- feeds both the engagement timeline and the firm audit log, so the history
-- needs no table of its own.
--
-- The trigger is a DEFERRED constraint trigger: several writers replace an
-- answer by DELETE then INSERT in one transaction. Fired at commit, the DELETE
-- sees the re-inserted row and records the pair as one change (old → new, by
-- the writer of the new row); the INSERT then sees that its change is already
-- recorded in this transaction (created_at = now(), the transaction's start)
-- and adds nothing. A value carried forward from the prior year is not an
-- answer anybody gave on this file, and is not logged.
--
-- Reversible: the down migration drops the trigger, function and index. The
-- rows already written stay in activity_log (append-only by design).

-- Up Migration

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
    IF OLD.value IS NOT DISTINCT FROM cur.value THEN RETURN NULL; END IF;
    v_before := OLD.value; v_after := cur.value; v_user := cur.updated_by; v_entity := cur.id;
  ELSIF TG_OP = 'DELETE' THEN
    SELECT id, value, updated_by INTO cur FROM form_response
     WHERE engagement_id = k_engagement AND code = k_code AND field_key = k_field;
    v_before := OLD.value;
    IF FOUND THEN
      -- replaced in the same transaction: one change, by the new row's writer.
      -- Replaced by the same value: no change, and the INSERT that follows is
      -- told so (a transaction-local marker), so it does not log one either.
      IF OLD.value IS NOT DISTINCT FROM cur.value THEN
        PERFORM set_config('ea_answer.k' || md5(k_engagement::text || '|' || k_code || '|' || k_field), '1', true);
        RETURN NULL;
      END IF;
      v_after := cur.value; v_user := cur.updated_by; v_entity := cur.id;
    ELSE
      -- cleared: the writer is not on the deleted row; the trail says so
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

DROP TRIGGER IF EXISTS form_response_answer_history ON form_response;
CREATE CONSTRAINT TRIGGER form_response_answer_history
  AFTER INSERT OR UPDATE OR DELETE ON form_response
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION form_response_answer_history();

-- per-field history reads, and the firm log's filters
CREATE INDEX IF NOT EXISTS activity_log_answer_idx
  ON activity_log (engagement_id, (meta->>'code'), (meta->>'field'), created_at DESC)
  WHERE entity_type = 'form_response';
CREATE INDEX IF NOT EXISTS activity_log_tenant_time_idx
  ON activity_log (tenant_id, created_at DESC);

-- Down Migration

DROP TRIGGER IF EXISTS form_response_answer_history ON form_response;
DROP FUNCTION IF EXISTS form_response_answer_history();
DROP INDEX IF EXISTS activity_log_answer_idx;
DROP INDEX IF EXISTS activity_log_tenant_time_idx;
