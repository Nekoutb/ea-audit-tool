-- F061 (firm decision 2026-10-27): tests-of-controls samples are drawn on the
-- server from a stored seed, and every draw is kept.
--
-- The sampling tool used to draw in the browser with Math.random and save
-- whatever the page sent, "a fresh draw every time": nothing showed that the
-- items tested were the items drawn, nor how many draws came before them.
-- Now the server picks a random seed, derives the items from it (the same
-- seededRandom the other engines use, so a draw is reproducible from its
-- seed), and appends the draw here. scot_control.toc_sample_items keeps the
-- CURRENT draw for the E1.2 board and the Excel extract; this table is the
-- history: seed, items, who, when and why.
--
-- Append-only: a trigger refuses UPDATE and DELETE, except the cascade from
-- the removal of the control (or the engagement / firm) that owns the draw.
-- A redraw needs a written reason; once testing of the sample has started it
-- is open to the team's manager rank and above only (enforced in lib/scots.ts).

-- Up Migration

CREATE TABLE IF NOT EXISTS toc_sample_draw (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL REFERENCES tenant (id) ON DELETE CASCADE,
  engagement_id uuid NOT NULL REFERENCES engagement (id) ON DELETE CASCADE,
  control_id    uuid NOT NULL REFERENCES scot_control (id) ON DELETE CASCADE,
  draw_no       integer NOT NULL CHECK (draw_no >= 1),
  seed          text NOT NULL,
  population    integer NOT NULL CHECK (population >= 0),
  sample_size   integer NOT NULL CHECK (sample_size >= 0),
  items         integer[] NOT NULL,
  rule          text,
  reason        text,
  drawn_by      uuid REFERENCES app_user (id) ON DELETE SET NULL,
  drawn_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (control_id, draw_no)
);
CREATE INDEX IF NOT EXISTS toc_sample_draw_control_idx ON toc_sample_draw (tenant_id, control_id, draw_no DESC);

ALTER TABLE toc_sample_draw ENABLE ROW LEVEL SECURITY;
ALTER TABLE toc_sample_draw FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON toc_sample_draw;
CREATE POLICY tenant_isolation ON toc_sample_draw
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
GRANT SELECT, INSERT ON toc_sample_draw TO ea_app;
REVOKE UPDATE, DELETE, TRUNCATE ON toc_sample_draw FROM ea_app;

CREATE OR REPLACE FUNCTION toc_sample_draw_append_only() RETURNS trigger AS $$
BEGIN
  -- the cascade from the removal of an owner (control, engagement or firm) is
  -- the one way out: by then the owning row is already gone
  IF TG_OP = 'DELETE' AND (
       NOT EXISTS (SELECT 1 FROM scot_control WHERE id = OLD.control_id)
    OR NOT EXISTS (SELECT 1 FROM engagement WHERE id = OLD.engagement_id)
    OR NOT EXISTS (SELECT 1 FROM tenant WHERE id = OLD.tenant_id)
  ) THEN
    RETURN OLD;
  END IF;
  RAISE EXCEPTION 'toc_sample_draw is append-only: % is not permitted', TG_OP
    USING ERRCODE = 'insufficient_privilege';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS toc_sample_draw_append_only ON toc_sample_draw;
CREATE TRIGGER toc_sample_draw_append_only
  BEFORE UPDATE OR DELETE ON toc_sample_draw
  FOR EACH ROW EXECUTE FUNCTION toc_sample_draw_append_only();

-- Down Migration

DROP TRIGGER IF EXISTS toc_sample_draw_append_only ON toc_sample_draw;
DROP FUNCTION IF EXISTS toc_sample_draw_append_only();
DROP TABLE IF EXISTS toc_sample_draw;
