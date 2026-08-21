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
): string {
  return `
    SELECT '${kind}' AS kind,
           e.id AS engagement_id,
           coalesce(e.name, '') AS engagement_name,
           c.name AS client_name,
           ${codeExpr} AS code,
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
           coalesce(nullif(e.name, ''), c.name) AS title,
           ts_headline('audit_search', c.name || ' — ' || coalesce(e.name, ''), %%TSQ%%,
                       'MaxWords=22, MinWords=4, MaxFragments=1') AS snippet,
           ts_rank(to_tsvector('audit_search', c.name || ' ' || coalesce(e.name, '')), %%TSQ%%) AS rank
      FROM engagement e
      JOIN client c ON c.id = e.client_id
     WHERE to_tsvector('audit_search', c.name || ' ' || coalesce(e.name, '')) @@ %%TSQ%%%%VISIBILITY%%`;

const BRANCHES: string[] = [
  ENGAGEMENT_BRANCH,
  branch("task", "file_item", "fi2", "coalesce(fi2.title_en, fi2.code)", "coalesce(fi2.title_en, '') || ' ' || coalesce(fi2.title_fr, '')", "", "fi2.code", true),
  branch("risk", "risk", "r", "left(coalesce(r.description, ''), 90)", "coalesce(r.description, '') || ' ' || coalesce(r.fs_note, '')", "", "NULL", true),
  branch("finding", "finding", "f", "coalesce(f.title, '')", "coalesce(f.detail, '') || ' ' || coalesce(f.response, '')", "", "NULL", true),
  branch("misstatement", "misstatement", "m", "left(coalesce(m.description, ''), 90)", "coalesce(m.description, '') || ' ' || coalesce(m.accounts, '')", ITEM_JOIN.replace("%ALIAS%", "m"), "fi.code", true),
  branch("review note", "review_note", "rn", "left(coalesce(rn.body, ''), 90)", "coalesce(rn.body, '') || ' ' || coalesce(rn.response, '')", ITEM_JOIN.replace("%ALIAS%", "rn"), "fi.code", true),
  branch("conclusion", "section_conclusion", "sc", "left(coalesce(sc.conclusion, ''), 90)", "coalesce(sc.conclusion, '')", ITEM_JOIN.replace("%ALIAS%", "sc"), "fi.code", true),
  branch("procedure", "program_step", "ps", "left(coalesce(ps.description, ''), 90)", "coalesce(ps.description, '') || ' ' || coalesce(ps.conclusion, '')", ITEM_JOIN.replace("%ALIAS%", "ps"), "fi.code", true),
  branch("control test", "control_test", "ct", "left(coalesce(ct.description, ''), 90)", "coalesce(ct.description, '') || ' ' || coalesce(ct.note, '')", ITEM_JOIN.replace("%ALIAS%", "ct"), "fi.code", true),
  branch("SCOT", "scot", "s", "coalesce(s.name, '')", "coalesce(s.description, '') || ' ' || coalesce(s.strategy, '')", "", "NULL", true),
  branch("document", "document", "d", "coalesce(d.title, '')", "coalesce(d.title, '')", ITEM_JOIN.replace("%ALIAS%", "d"), "fi.code", true),
  branch("working paper", "form_response", "fr2", "fr2.code", "coalesce(fr2.value #>> '{}', '')", "", "fr2.code", true),
];

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
export async function search(rawQuery: string): Promise<SearchResults> {
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
    WITH q AS (SELECT websearch_to_tsquery('audit_search', $2) AS tsq, $1::uuid AS uid)
    ${BRANCHES.map((b) => b.replace("%%VISIBILITY%%", visibility)).join("\n    UNION ALL")}
    ORDER BY rank DESC, title
    LIMIT ${MAX_HITS + 1}`;

  type Row = {
    kind: string; engagement_id: string; engagement_name: string; client_name: string;
    code: string | null; title: string; snippet: string; rank: number;
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

  const truncated = rows.length > MAX_HITS;
  return {
    query,
    truncated,
    hits: rows.slice(0, MAX_HITS).map((r) => ({
      kind: r.kind,
      engagementId: r.engagement_id,
      engagementName: r.engagement_name || r.client_name,
      clientName: r.client_name,
      code: r.code,
      title: r.title.trim() || r.kind,
      snippet: r.snippet,
      href: r.code
        ? `/engagements/${r.engagement_id}/sections/${encodeURIComponent(r.code)}`
        : `/engagements/${r.engagement_id}/dashboard`,
      rank: Number(r.rank),
    })),
  };
}
