import { withTenant } from "@/lib/db";
import { visibilityClause } from "@/lib/engagement-access";
import { requireTenant } from "@/lib/tenant";

/**
 * Search across the audit file.
 *
 * There was none anywhere in the product: an auditor looking for the paper
 * where a matter was discussed had to remember which task it was.
 *
 * Two isolation rules apply, not one. Tenant isolation comes free from
 * withTenant and forced row-level security. Engagement visibility does NOT —
 * search is precisely the surface where a person could otherwise discover the
 * existence and contents of a client file they are not on, so every branch of
 * the union carries the same predicate the register and the API use.
 */

export interface SearchHit {
  kind: string;
  /** empty for a client (entity) record, which belongs to no engagement */
  engagementId: string;
  engagementName: string;
  clientName: string;
  /** file item code where the hit lives, when it belongs to one */
  code: string | null;
  title: string;
  snippet: string;
  href: string;
  rank: number;
}

export interface SearchResults {
  query: string;
  hits: SearchHit[];
  /** true when the list was cut short */
  truncated: boolean;
}

const MAX_HITS = 60;

/**
 * Each branch yields the same shape. The tsquery is spliced in as a subquery
 * rather than a placeholder — it appears three times per branch across eleven
 * branches, and renumbering $-parameters through that is how the wrong value
 * ends up in the wrong slot. $1 is the user id the visibility predicate needs;
 * $2 is the raw query text, bound once in the CTE.
 *
 * headline() gives the matched words in context rather than the first hundred
 * characters — which for a working-paper answer is usually boilerplate.
 */
function branch(
  kind: string,
  table: string,
  alias: string,
  titleExpr: string,
  snippetExpr: string,
  codeJoin: string,
  codeExpr: string,
  hasVisibility: boolean,
  itemIdExpr = "NULL::uuid",
): string {
  return `
    SELECT '${kind}' AS kind,
           e.id AS engagement_id,
           coalesce(e.name, '') AS engagement_name,
           c.name AS client_name,
           ${codeExpr} AS code,
           ${itemIdExpr} AS item_id,
           ${titleExpr} AS title,
           ts_headline('audit_search', ${snippetExpr}, %%TSQ%%,
                       'MaxWords=22, MinWords=8, ShortWord=2, MaxFragments=1, FragmentDelimiter=" … "') AS snippet,
           ts_rank(${alias}.search_vector, %%TSQ%%) AS rank
      FROM ${table} ${alias}
      JOIN engagement e ON e.id = ${alias}.engagement_id
      JOIN client c ON c.id = e.client_id
      ${codeJoin}
     WHERE ${alias}.search_vector @@ %%TSQ%%${hasVisibility ? "%%VISIBILITY%%" : ""}`;
}

const ITEM_JOIN = "LEFT JOIN file_item fi ON fi.id = %ALIAS%.file_item_id";
/** A working-paper answer is keyed by code ('wp:E4.1' or 'P1.1'); resolve it to the task. */
const WP_ITEM_JOIN =
  "LEFT JOIN file_item fi ON fi.engagement_id = fr2.engagement_id AND fi.code = regexp_replace(fr2.code, '^wp:', '')";

/**
 * The engagement itself, by its own name or its client's.
 *
 * Not one of the indexed tables: engagement and client are small — hundreds of
 * rows for a firm, not millions — so a sequential scan costs nothing, and
 * carrying two more generated columns for them would be maintenance without
 * benefit. Typing a client's name is the first thing anyone tries, so it has to
 * work.
 */
const ENGAGEMENT_BRANCH = `
    SELECT 'engagement' AS kind,
           e.id AS engagement_id,
           coalesce(e.name, '') AS engagement_name,
           c.name AS client_name,
           NULL AS code,
           NULL::uuid AS item_id,
           coalesce(nullif(e.name, ''), c.name) AS title,
           ts_headline('audit_search', c.name || ' — ' || coalesce(e.name, ''), %%TSQ%%,
                       'MaxWords=22, MinWords=4, MaxFragments=1') AS snippet,
           ts_rank(to_tsvector('audit_search', c.name || ' ' || coalesce(e.name, '')), %%TSQ%%) AS rank
      FROM engagement e
      JOIN client c ON c.id = e.client_id
     WHERE to_tsvector('audit_search', c.name || ' ' || coalesce(e.name, '')) @@ %%TSQ%%%%VISIBILITY%%`;

/**
 * The client (entity) record itself, by name, RCCM registration number or NIU
 * (UAT run 2 B88: a client with no engagement could not be found at all, and a
 * hit never opened the entity record). The registration number is matched as
 * typed too — "RC/YAO/2019/B/999" is not a phrase a text search tokenises
 * usefully. Client records are firm-wide (the /clients register lists them for
 * every role), so no engagement-visibility predicate applies; archived clients
 * are left out as on the register.
 */
const CLIENT_BRANCH = `
    SELECT 'client' AS kind,
           NULL::uuid AS engagement_id,
           '' AS engagement_name,
           c.name AS client_name,
           NULL AS code,
           c.id AS item_id,
           c.name AS title,
           ts_headline('audit_search',
                       c.name || ' — ' || coalesce(c.registration_number, '') || ' ' || coalesce(c.niu, ''), %%TSQ%%,
                       'MaxWords=22, MinWords=4, MaxFragments=1') AS snippet,
           greatest(
             ts_rank(to_tsvector('audit_search', c.name || ' ' || coalesce(c.registration_number, '') || ' ' || coalesce(c.niu, '')), %%TSQ%%),
             CASE WHEN c.registration_number ILIKE '%' || (SELECT raw FROM q) || '%'
                    OR c.niu ILIKE '%' || (SELECT raw FROM q) || '%' THEN 1 ELSE 0 END
           )::real AS rank
      FROM client c
     WHERE c.archived_at IS NULL
       AND (to_tsvector('audit_search', c.name || ' ' || coalesce(c.registration_number, '') || ' ' || coalesce(c.niu, '')) @@ %%TSQ%%
            OR c.registration_number ILIKE '%' || (SELECT raw FROM q) || '%'
            OR c.niu ILIKE '%' || (SELECT raw FROM q) || '%')`;

/**
 * The branches for a UI language. Task and working-paper hits are named by the
 * task's title in that language (UAT run2-B103: the French UI showed English
 * titles, and working-paper answers were titled by their raw 'wp:' key).
 */
function branchesFor(fr: boolean): string[] {
  const taskTitle = fr
    ? "coalesce(nullif(fi2.title_fr, ''), nullif(fi2.title_en, ''), fi2.code)"
    : "coalesce(nullif(fi2.title_en, ''), nullif(fi2.title_fr, ''), fi2.code)";
  const wpTitle = fr
    ? "coalesce(nullif(fi.title_fr, ''), nullif(fi.title_en, ''), regexp_replace(fr2.code, '^wp:', ''))"
    : "coalesce(nullif(fi.title_en, ''), nullif(fi.title_fr, ''), regexp_replace(fr2.code, '^wp:', ''))";
  return [
  CLIENT_BRANCH,
  ENGAGEMENT_BRANCH,
  branch("task", "file_item", "fi2", taskTitle, "coalesce(fi2.title_en, '') || ' ' || coalesce(fi2.title_fr, '')", "", "fi2.code", true, "fi2.id"),
  branch("risk", "risk", "r", "left(coalesce(r.description, ''), 90)", "coalesce(r.description, '') || ' ' || coalesce(r.fs_note, '')", "", "NULL", true),
  branch("finding", "finding", "f", "coalesce(f.title, '')", "coalesce(f.detail, '') || ' ' || coalesce(f.response, '')", "", "NULL", true),
  branch("misstatement", "misstatement", "m", "left(coalesce(m.description, ''), 90)", "coalesce(m.description, '') || ' ' || coalesce(m.accounts, '')", ITEM_JOIN.replace("%ALIAS%", "m"), "fi.code", true, "fi.id"),
  branch("review note", "review_note", "rn", "left(coalesce(rn.body, ''), 90)", "coalesce(rn.body, '') || ' ' || coalesce(rn.response, '')", ITEM_JOIN.replace("%ALIAS%", "rn"), "fi.code", true, "fi.id"),
  branch("conclusion", "section_conclusion", "sc", "left(coalesce(sc.conclusion, ''), 90)", "coalesce(sc.conclusion, '')", ITEM_JOIN.replace("%ALIAS%", "sc"), "fi.code", true, "fi.id"),
  branch("procedure", "program_step", "ps", "left(coalesce(ps.description, ''), 90)", "coalesce(ps.description, '') || ' ' || coalesce(ps.conclusion, '')", ITEM_JOIN.replace("%ALIAS%", "ps"), "fi.code", true, "fi.id"),
  branch("control test", "control_test", "ct", "left(coalesce(ct.description, ''), 90)", "coalesce(ct.description, '') || ' ' || coalesce(ct.note, '')", ITEM_JOIN.replace("%ALIAS%", "ct"), "fi.code", true, "fi.id"),
  branch("SCOT", "scot", "s", "coalesce(s.name, '')", "coalesce(s.description, '') || ' ' || coalesce(s.strategy, '')", "", "NULL", true),
  branch("document", "document", "d", "coalesce(d.title, '')", "coalesce(d.title, '')", ITEM_JOIN.replace("%ALIAS%", "d"), "fi.code", true, "fi.id"),
  branch("working paper", "form_response", "fr2", wpTitle, "coalesce(fr2.value #>> '{}', '')", WP_ITEM_JOIN, "regexp_replace(fr2.code, '^wp:', '')", true, "fi.id"),
  ];
}

/**
 * A prefix form of the query, for the second attempt.
 *
 * The configuration does no stemming, deliberately — audit text is full of
 * codes and names a stemmer damages. The cost is that "receivable" does not
 * match "receivables", which is exactly what someone types into a search box.
 * So an exact search that finds nothing is retried with each term as a prefix.
 * Precision first, then reach.
 *
 * Terms are reduced to letters and digits before being handed to to_tsquery,
 * which — unlike websearch_to_tsquery — throws on stray operators.
 */
function prefixQuery(raw: string): string | null {
  const terms = raw
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((t) => t.length >= 2)
    .slice(0, 8);
  return terms.length ? terms.map((t) => `${t}:*`).join(" & ") : null;
}

/**
 * Run a search. An empty or punctuation-only query returns nothing rather than
 * everything — a blank box should not page through the whole firm.
 */
export async function search(rawQuery: string, locale: "en" | "fr" = "en"): Promise<SearchResults> {
  const { tenantId, userId, role } = await requireTenant();
  const query = rawQuery.trim();
  if (query.length < 2) return { query, hits: [], truncated: false };

  // websearch_to_tsquery understands quoted phrases, OR and -exclusions, and
  // never throws on punctuation the way to_tsquery does.
  const visibility = visibilityClause(role, "e", 1);
  const sql = `
    -- $1 is cast here so it always has a known type: a partner needs no
    -- visibility predicate, and an unreferenced parameter leaves Postgres
    -- unable to infer one.
    WITH q AS (SELECT websearch_to_tsquery('audit_search', $2) AS tsq, $1::uuid AS uid, $2::text AS raw)
    ${branchesFor(locale === "fr").map((b) => b.replace("%%VISIBILITY%%", visibility)).join("\n    UNION ALL")}
    ORDER BY rank DESC, title
    LIMIT ${MAX_HITS + 1}`;

  type Row = {
    kind: string; engagement_id: string; engagement_name: string; client_name: string;
    code: string | null; item_id: string | null; title: string; snippet: string; rank: number;
  };
  const prepared = sql.replaceAll("%%TSQ%%", "(SELECT tsq FROM q)");

  let rows = await withTenant(tenantId, (tx) =>
    tx.query<Row>(prepared, [userId, query]).then((r) => r.rows),
  );

  // Nothing matched exactly — try the same search with each term as a prefix.
  if (rows.length === 0) {
    const prefix = prefixQuery(query);
    if (prefix) {
      const prefixSql = prepared.replace(
        "websearch_to_tsquery('audit_search', $2)",
        "to_tsquery('audit_search', $2)",
      );
      rows = await withTenant(tenantId, (tx) =>
        tx.query<Row>(prefixSql, [userId, prefix]).then((r) => r.rows),
      ).catch(() => []);
    }
  }

  // One working paper holds many answers; show it once per task, at its best
  // rank (rows arrive rank-ordered), not once per matching answer box.
  const seenWp = new Set<string>();
  rows = rows.filter((r) => {
    if (r.kind !== "working paper") return true;
    const key = `${r.engagement_id}|${r.code ?? ""}`;
    if (seenWp.has(key)) return false;
    seenWp.add(key);
    return true;
  });

  const truncated = rows.length > MAX_HITS;
  return {
    query,
    truncated,
    hits: rows.slice(0, MAX_HITS).map((r) => ({
      kind: r.kind,
      engagementId: r.engagement_id ?? "",
      engagementName: r.engagement_name || r.client_name,
      clientName: r.client_name,
      code: r.code,
      title: r.title.trim() || r.kind,
      snippet: r.snippet,
      // The task page is keyed by the file item's id, never its code (UAT B26:
      // /sections/C2.1 was a 500). A working-paper answer whose task no longer
      // exists falls back to the legacy form page for its code.
      href: r.kind === "client"
        ? `/clients/${r.item_id}`
        : r.item_id
        ? `/engagements/${r.engagement_id}/sections/${r.item_id}`
        : r.code
          ? `/engagements/${r.engagement_id}/forms/${encodeURIComponent(r.code.replace(/^wp:/, ""))}`
          : `/engagements/${r.engagement_id}/dashboard`,
      rank: Number(r.rank),
    })),
  };
}
