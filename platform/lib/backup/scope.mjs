// What belongs to a firm, and what belongs to one engagement.
//
// Two rules govern this file.
//
// 1. NOTHING IS HARD-CODED THAT THE CATALOG CAN ANSWER. db/rls.sql carries a
//    literal list of table names with a comment asking future phases to keep it
//    current (db/rls.sql:17-18); it drifted, and the drift was only caught by
//    measuring the live database. So membership of a scope is derived from
//    pg_attribute and pg_trigger at run time. The only hard-coded thing is the
//    handful of tables the catalog genuinely cannot classify — and a table in
//    none of those lists is a hard error, asserted by a test, so adding one
//    without deciding its fate fails CI rather than silently vanishing from
//    every backup.
//
// 2. SCOPING IS BY EXPLICIT PREDICATE, NEVER BY ROW-LEVEL SECURITY. The
//    extractor connects as `postgres`, which bypasses RLS regardless. But even
//    if it did not: RLS is a *deny* mechanism, and using a deny mechanism for
//    *selection* means an unprotected table fails towards including every
//    firm's rows. `WHERE tenant_id = …` fails the other way — a table that
//    cannot be scoped is simply absent, and rule 1 catches it.

/** Tables with no `tenant_id`, each with a decided fate. */

/** Reachable only through membership; `credentials` decides how much is taken. */
export const BY_MEMBERSHIP = {
  app_user: {
    predicate: (tenant) => (a) =>
      `${a}."id" IN (SELECT user_id FROM membership WHERE tenant_id = ${tenant})`,
    // A person may work for two firms. Their row therefore leaves this firm's
    // extract carrying another firm's employee: fine for an operator restore,
    // a disclosure incident in anything a firm could download.
    redactColumns: ["password_hash", "totp_secret"],
  },
  mfa_recovery_code: {
    predicate: (tenant) => (a) =>
      `${a}."user_id" IN (SELECT user_id FROM membership WHERE tenant_id = ${tenant})`,
    credentialsOnly: true,
  },
};

/** The firm itself. */
export const TENANT_ROW = { tenant: { predicate: (tenant) => (a) => `${a}."id" = ${tenant}` } };

/** Global reference data with no owner. Small, and a restore into a fresh cluster needs it. */
export const REFERENCE = ["syscohada_grouping_rule"];

/** Deliberately not backed up, with the reason. */
export const NOT_BACKED_UP = {
  pgmigrations: "schema version — recorded in the manifest as metadata, not as rows",
  login_attempt: "transient sign-in throttle state; carries no tenant and no audit value",
  rls_probe:
    "the RLS self-test fixture; it holds no real data and its rows are meaningless outside a test run",
  backup_job: "this system's own bookkeeping; restoring it would replay old queue state",
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * The only place a caller-supplied id becomes SQL text. `COPY … TO STDOUT`
 * takes no bind parameters, so the id is interpolated — which is safe only
 * because nothing but a uuid can survive this function.
 */
export function uuidLiteral(id) {
  if (typeof id !== "string" || !UUID.test(id)) {
    throw new Error(`not a uuid: ${JSON.stringify(id)}`);
  }
  return `'${id}'::uuid`;
}

function quoteIdent(name) {
  if (!/^[a-z_][a-z0-9_]*$/.test(name)) throw new Error(`unexpected identifier: ${name}`);
  return `"${name}"`;
}

async function tablesWithColumn(client, column) {
  const { rows } = await client.query(
    `SELECT c.relname AS table_name
       FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relkind = 'r'
        AND EXISTS (SELECT 1 FROM pg_attribute a
                     WHERE a.attrelid = c.oid AND a.attname = $1 AND a.attnum > 0 AND NOT a.attisdropped)
      ORDER BY c.relname`,
    [column],
  );
  return rows.map((r) => r.table_name);
}

async function allTables(client) {
  const { rows } = await client.query(
    `SELECT c.relname AS table_name
       FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relkind = 'r'
      ORDER BY c.relname`,
  );
  return rows.map((r) => r.table_name);
}

/**
 * Tables that reach an engagement through a parent, read from the archive-lock
 * triggers themselves rather than restated here.
 *
 * migrations/20260820000002_archive_immutability.sql attaches
 * reject_archived_child_write(fk_column, lookup_sql) to every such table, and
 * that list is maintained by the people who care whether a row belongs to an
 * archived file. Reading it from pg_trigger makes "reachable from an
 * engagement" mean exactly the same thing to the backup as it does to the
 * immutability guard, permanently — the two cannot drift apart.
 */
export async function childSpecs(client) {
  const { rows } = await client.query(
    `SELECT c.relname AS table_name, t.tgargs
       FROM pg_trigger t
       JOIN pg_class c ON c.oid = t.tgrelid
       JOIN pg_proc p ON p.oid = t.tgfoid
      WHERE NOT t.tgisinternal AND p.proname = 'reject_archived_child_write'`,
  );
  // tgargs is a bytea of NUL-terminated C strings.
  return rows.map(({ table_name, tgargs }) => {
    const parts = Buffer.from(tgargs).toString("utf8").split("\0").filter(Boolean);
    if (parts.length < 2) throw new Error(`unreadable trigger args on ${table_name}`);
    return { table: table_name, column: parts[0], lookup: parts[1] };
  });
}

/**
 * Sort every table in `public` into exactly one bucket, or report it as
 * unclassified. `unclassified` being non-empty is a bug, not a state to handle.
 */
export async function classify(client) {
  // Sequential, not Promise.all: these often run on a single pg.Client inside a
  // transaction, where overlapping queries are deprecated and the interleaving
  // is not something a catalog read should depend on.
  const tables = await allTables(client);
  const withTenant = await tablesWithColumn(client, "tenant_id");
  const withEngagement = await tablesWithColumn(client, "engagement_id");
  const children = await childSpecs(client);
  const tenantScoped = new Set(withTenant);
  const named = new Set([
    ...Object.keys(BY_MEMBERSHIP),
    ...Object.keys(TENANT_ROW),
    ...REFERENCE,
    ...Object.keys(NOT_BACKED_UP),
  ]);
  return {
    tables,
    tenantScoped: withTenant,
    engagementScoped: withEngagement,
    children: children.filter((c) => !Object.hasOwn(NOT_BACKED_UP, c.table)),
    byMembership: Object.keys(BY_MEMBERSHIP).filter((t) => tables.includes(t)),
    reference: REFERENCE.filter((t) => tables.includes(t)),
    notBackedUp: Object.keys(NOT_BACKED_UP).filter((t) => tables.includes(t)),
    unclassified: tables.filter((t) => !tenantScoped.has(t) && !named.has(t)),
  };
}

/** Throw if any table has no decided fate. Called by the extractor and by CI. */
export async function assertClassified(client) {
  const { unclassified } = await classify(client);
  if (unclassified.length > 0) {
    throw new Error(
      `backup scope undecided for: ${unclassified.join(", ")}. ` +
        `Add a tenant_id column, or name the table in BY_MEMBERSHIP / REFERENCE / NOT_BACKED_UP ` +
        `in lib/backup/scope.mjs with the reason.`,
    );
  }
}

/**
 * The tables one firm's extract contains. Each entry's `where` is a FUNCTION of
 * the table alias, not a string: the same predicate has to be rendered against
 * `t` in the COPY and against `t2` inside a referential-gap subquery, and
 * rewriting alias prefixes with string replacement is how that quietly breaks.
 * `credentials` is mandatory and has no default: "include" keeps password
 * hashes and TOTP secrets so a restore can let people sign in; "redact" nulls
 * them and drops recovery codes entirely.
 */
export async function tenantPlan(client, tenantId, { credentials }) {
  if (credentials !== "include" && credentials !== "redact") {
    throw new Error(
      `credentials must be "include" or "redact", got ${JSON.stringify(credentials)}`,
    );
  }
  await assertClassified(client);
  const t = uuidLiteral(tenantId);
  const { tenantScoped, byMembership, reference } = await classify(client);
  const plan = [];

  for (const [table, spec] of Object.entries(TENANT_ROW)) {
    plan.push({ table, where: spec.predicate(t), redact: [] });
  }
  for (const table of byMembership) {
    const spec = BY_MEMBERSHIP[table];
    if (spec.credentialsOnly && credentials === "redact") continue;
    plan.push({
      table,
      where: spec.predicate(t),
      redact: credentials === "redact" ? (spec.redactColumns ?? []) : [],
    });
  }
  for (const table of tenantScoped) {
    if (Object.hasOwn(NOT_BACKED_UP, table)) continue;
    plan.push({ table, where: (a) => `${a}."tenant_id" = ${t}`, redact: [] });
  }
  for (const table of reference) {
    plan.push({ table, where: () => "true", redact: [] });
  }
  return plan;
}

/**
 * The tables one engagement's extract contains. Child tables are scoped by
 * substituting the row's own foreign key into the archive guard's own lookup,
 * so the two agree by construction.
 */
export async function engagementPlan(client, engagementId) {
  await assertClassified(client);
  const e = uuidLiteral(engagementId);
  const { engagementScoped, children } = await classify(client);
  const plan = engagementScoped
    .filter((table) => !Object.hasOwn(NOT_BACKED_UP, table))
    .map((table) => ({ table, where: (a) => `${a}."engagement_id" = ${e}`, redact: [] }));

  for (const { table, column, lookup } of children) {
    if (engagementScoped.includes(table)) continue; // already scoped directly
    // The guard's own lookup, with the row's foreign key substituted for its
    // parameter — so "reachable from this engagement" is the same expression
    // the archive lock evaluates.
    plan.push({
      table,
      where: (a) => `(${lookup.replaceAll("$1", `${a}.${quoteIdent(column)}`)}) = ${e}`,
      redact: [],
      viaParent: { column, lookup },
    });
  }
  return plan;
}

/** The four columns that hold uploaded file bytes. Derived, not remembered. */
export async function byteaColumns(client) {
  const { rows } = await client.query(
    `SELECT c.relname AS table_name, a.attname AS column_name
       FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
       JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped
       JOIN pg_type ty ON ty.oid = a.atttypid
      WHERE n.nspname = 'public' AND c.relkind = 'r' AND ty.typname = 'bytea'
      ORDER BY c.relname, a.attname`,
  );
  return rows.map((r) => ({ table: r.table_name, column: r.column_name }));
}
