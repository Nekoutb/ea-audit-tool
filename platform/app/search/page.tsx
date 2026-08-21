import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AppNav } from "@/components/AppNav";
import { Panel } from "@/components/ui/atlas";
import { getLocale } from "@/lib/locale";
import { search } from "@/lib/search";

export const metadata = { title: "Search · AuditISA" };

/**
 * Search results.
 *
 * Snippets come from ts_headline, which wraps matches in <b>. That is generated
 * from the stored text, not from anything a user supplies directly, but it is
 * still rendered as markup — so the surrounding text is escaped and only the
 * emphasis tags are honoured. See `highlight` below.
 */
export default async function SearchPage(props: { searchParams: Promise<{ q?: string }> }) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const { q } = await props.searchParams;
  const locale = await getLocale();
  const fr = locale === "fr";
  const results = q ? await search(q) : { query: "", hits: [], truncated: false };

  const input =
    "w-full rounded-[var(--radius-atlas-sm)] border border-line-strong bg-surface px-3 py-2 text-[14px] text-ink outline-none focus:border-emerald-600";

  return (
    <main className="min-h-screen w-full px-6 py-6">
      <AppNav locale={locale} />

      <h1 className="mt-5 text-[22px] font-semibold tracking-[-0.02em] text-ink">
        {fr ? "Recherche" : "Search"}
      </h1>

      <form action="/search" method="get" className="mt-3 flex max-w-[620px] gap-2">
        <input
          name="q"
          defaultValue={q ?? ""}
          autoFocus
          placeholder={fr ? "Un mot du dossier — conclusion, risque, note de revue…" : "A word from the file — conclusion, risk, review note…"}
          className={input}
          data-testid="search-input"
        />
        <button
          type="submit"
          className="rounded-[var(--radius-atlas-sm)] bg-emerald-700 px-4 py-2 text-[13px] font-semibold text-white transition hover:bg-emerald-800"
          data-testid="search-submit"
        >
          {fr ? "Chercher" : "Search"}
        </button>
      </form>

      <p className="mt-2 max-w-[620px] text-[11.5px] text-muted">
        {fr
          ? "Les accents sont ignorés. Utilisez des guillemets pour une expression exacte, OR pour l'un ou l'autre, et - pour exclure."
          : "Accents are ignored. Use quotes for an exact phrase, OR for either, and - to exclude."}
      </p>

      {q ? (
        <>
          <p className="mt-4 text-[12.5px] text-muted" data-testid="search-count">
            {results.hits.length === 0
              ? fr ? "Aucun résultat." : "Nothing found."
              : fr
                ? `${results.hits.length}${results.truncated ? "+" : ""} résultat${results.hits.length > 1 ? "s" : ""}`
                : `${results.hits.length}${results.truncated ? "+" : ""} result${results.hits.length > 1 ? "s" : ""}`}
          </p>

          <div className="mt-3 flex max-w-[860px] flex-col gap-1.5">
            {results.hits.map((hit, i) => (
              <Link
                key={`${hit.kind}-${hit.engagementId}-${i}`}
                href={hit.href}
                className="block"
                data-testid="search-hit"
              >
                <Panel className="p-3 transition hover:border-emerald-600">
                  <div className="flex flex-wrap items-baseline gap-2">
                    <span className="rounded-[var(--radius-atlas-xs)] bg-surface-2 px-1.5 py-0.5 text-[10px] font-extrabold uppercase tracking-[0.07em] text-muted">
                      {hit.kind}
                    </span>
                    {hit.code ? (
                      <span className="font-mono text-[11.5px] text-emerald-700 dark:text-emerald-400">{hit.code}</span>
                    ) : null}
                    <span className="text-[13.5px] font-semibold text-ink">{hit.title}</span>
                    <span className="ml-auto text-[11px] text-muted">{hit.clientName}</span>
                  </div>
                  <p
                    className="mt-1 text-[12.5px] leading-snug text-ink-soft"
                    // ts_headline emphasis only; everything else is escaped below.
                    dangerouslySetInnerHTML={{ __html: highlight(hit.snippet) }}
                  />
                </Panel>
              </Link>
            ))}
          </div>
        </>
      ) : null}
    </main>
  );
}

/**
 * Escape the snippet, then re-admit only the <b> tags ts_headline added.
 *
 * The text being highlighted is whatever an auditor typed into a working paper.
 * Rendering that as raw HTML would make every free-text field in the product a
 * stored-XSS vector, reachable by anyone who can search.
 */
function highlight(snippet: string): string {
  return snippet
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/&lt;b&gt;/g, '<b class="font-semibold text-ink">')
    .replace(/&lt;\/b&gt;/g, "</b>");
}
