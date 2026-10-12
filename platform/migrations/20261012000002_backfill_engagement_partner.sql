-- Seat an engagement partner on existing engagements (sign-off governance F003).
--
-- From 20261012000001 a paper can only be signed by accepted team members and
-- the partner tier only by the one accepted engagement partner. Most existing
-- engagements were run without a staffed team, so without this backfill none
-- of them could be signed. Decision of the firm (2026-10-12): seat a partner.
--
-- For each open (non-archived) engagement with no accepted team_role='partner':
--   1. a member already invited as partner whose firm role is partner or
--      firm_admin is marked accepted (earliest invitation first);
--   2. otherwise, when the firm has exactly one membership with role
--      'partner', that person is seated as accepted engagement partner;
--   3. otherwise, when the firm has no partner and exactly one firm_admin,
--      that person is seated;
--   4. otherwise the engagement is left for manual staffing (reported below).
-- Every seat is written to the activity trail. Other signers (preparers,
-- reviewers) are not added: the team page is where they are staffed.

-- Up Migration

DO $$
DECLARE
  t record;
  e record;
  pick uuid;
  how text;
  seated int := 0;
  skipped int := 0;
BEGIN
  FOR t IN SELECT id FROM tenant LOOP
    PERFORM set_config('app.tenant_id', t.id::text, true);
    FOR e IN
      SELECT en.id
        FROM engagement en
       WHERE en.tenant_id = t.id
         AND en.archived_at IS NULL
         AND NOT EXISTS (SELECT 1 FROM team_member tm
                          WHERE tm.engagement_id = en.id
                            AND tm.team_role = 'partner' AND tm.status = 'accepted')
    LOOP
      pick := NULL; how := NULL;
      -- 1. an invited partner with partner rank
      SELECT tm.user_id INTO pick
        FROM team_member tm
        JOIN membership m ON m.user_id = tm.user_id AND m.tenant_id = t.id
       WHERE tm.engagement_id = e.id AND tm.team_role = 'partner'
         AND tm.status = 'invited' AND m.role IN ('partner', 'firm_admin')
       ORDER BY tm.invited_at NULLS LAST, tm.created_at
       LIMIT 1;
      IF pick IS NOT NULL THEN
        UPDATE team_member SET status = 'accepted', responded_at = now()
         WHERE engagement_id = e.id AND user_id = pick;
        how := 'invited partner marked accepted';
      ELSE
        -- 2. the firm's only partner, else 3. its only administrator
        IF (SELECT count(*) FROM membership WHERE tenant_id = t.id AND role = 'partner') = 1 THEN
          SELECT user_id INTO pick FROM membership WHERE tenant_id = t.id AND role = 'partner';
          how := 'firm''s sole partner seated';
        ELSIF (SELECT count(*) FROM membership WHERE tenant_id = t.id AND role = 'partner') = 0
          AND (SELECT count(*) FROM membership WHERE tenant_id = t.id AND role = 'firm_admin') = 1 THEN
          SELECT user_id INTO pick FROM membership WHERE tenant_id = t.id AND role = 'firm_admin';
          how := 'firm''s sole administrator seated (no partner in the firm)';
        END IF;
        IF pick IS NOT NULL THEN
          -- the person may already be on the team in another role: move them
          IF EXISTS (SELECT 1 FROM team_member WHERE engagement_id = e.id AND user_id = pick) THEN
            UPDATE team_member SET team_role = 'partner', status = 'accepted', responded_at = now()
             WHERE engagement_id = e.id AND user_id = pick;
          ELSE
            INSERT INTO team_member (tenant_id, engagement_id, user_id, team_role, status, invited_at, responded_at)
            VALUES (t.id, e.id, pick, 'partner', 'accepted', now(), now());
          END IF;
        END IF;
      END IF;

      IF pick IS NULL THEN
        skipped := skipped + 1;
      ELSE
        seated := seated + 1;
        INSERT INTO activity_log (tenant_id, engagement_id, user_id, entity_type, entity_id, action, summary, meta)
        VALUES (t.id, e.id, NULL, 'team_member', NULL, 'engagement_partner_backfilled',
                'Engagement partner designated by data migration: ' || how,
                jsonb_build_object('userId', pick, 'rule', how, 'migration', '20261012000002'));
      END IF;
    END LOOP;
  END LOOP;
  PERFORM set_config('app.tenant_id', '', true);
  RAISE NOTICE 'engagement partner backfill: % seated, % left for manual staffing', seated, skipped;
END
$$;

-- Down Migration

-- Intentionally empty: the seats are real team data once created; remove them
-- from the team page if needed (each one is listed in activity_log with
-- action 'engagement_partner_backfilled').
