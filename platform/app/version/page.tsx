import Link from "next/link";
import { Chip, Panel, StatCell } from "@/components/ui/atlas";
import { getLocale } from "@/lib/locale";
import { releaseInfo, SOURCE_REPOSITORY } from "@/lib/release-info";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "What is running · AuditISA",
  robots: { index: false, follow: false },
};

/** "2 hours ago" / "il y a 2 heures", from an ISO timestamp. */
function ago(iso: string | null, fr: boolean, now = Date.now()): string | null {
  if (!iso) return null;
  const ms = now - Date.parse(iso);
  if (!Number.isFinite(ms) || ms < 0) return null;
  const minutes = Math.round(ms / 60_000);
  if (minutes < 1) return fr ? "à l'instant" : "just now";
  if (minutes < 60) return fr ? `il y a ${minutes} min` : `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return fr ? `il y a ${hours} h` : `${hours} h ago`;
  const days = Math.round(hours / 24);
  return fr ? `il y a ${days} jours` : `${days} days ago`;
}

function stamp(iso: string | null, locale: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(d) + " UTC";
}

/**
 * The human face of /api/version: which build this site is serving, in words
 * a partner or a client can read. Public, like the JSON — it is the page a
 * person is sent to when they open the API URL in a browser.
 */
export default async function VersionPage() {
  const locale = await getLocale();
  const fr = locale === "fr";
  const info = await releaseInfo();

  const environment =
    info.target === "prod"
      ? { label: fr ? "Production" : "Production", tone: "good" as const, host: "www.auditisa.com" }
      : info.target === "dev"
        ? { label: fr ? "Site de test (staging)" : "Staging (test site)", tone: "warn" as const, host: "dev.auditisa.com" }
        : { label: fr ? "Serveur de développement" : "Development server", tone: "muted" as const, host: null };

  const shortSha = info.commit;
  const commitUrl = info.sha ? `${SOURCE_REPOSITORY}/commit/${info.sha}` : null;
  const builtAgo = ago(info.built, fr);
  const startedAgo = ago(info.startedAt, fr);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col px-6 py-12">
      <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-500">AuditISA</p>
      <h1 className="mt-1 text-[26px] font-extrabold tracking-[-0.02em] text-ink">
        {fr ? "Quelle version tourne ici ?" : "What is this site running?"}
      </h1>
      <p className="mt-2 max-w-[60ch] text-[13.5px] leading-relaxed text-ink-soft">
        {fr
          ? "Chaque mise en ligne est construite à partir d'un commit précis du code source. Cette page indique lequel, quand il a été construit et depuis quand il tourne — de quoi vérifier qu'un changement est bien arrivé jusqu'ici."
          : "Every deployment is built from one exact commit of the source code. This page says which one, when it was built, and how long it has been running — enough to check that a change really reached this site."}
      </p>

      <Panel className="mt-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[10.5px] font-bold uppercase tracking-[0.07em] text-muted">
              {fr ? "Environnement" : "Environment"}
            </p>
            <p className="mt-1 text-[18px] font-semibold tracking-[-0.015em] text-ink">{environment.label}</p>
            {environment.host ? <p className="text-xs text-muted">{environment.host}</p> : null}
          </div>
          <Chip tone={environment.tone} pulse>
            {fr ? "En ligne" : "Live"}
          </Chip>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-5 border-t border-line pt-5 sm:grid-cols-2">
          <StatCell
            label={fr ? "Commit déployé" : "Commit deployed"}
            value={
              shortSha && commitUrl ? (
                <a
                  href={commitUrl}
                  className="font-mono text-emerald-700 hover:underline dark:text-emerald-400"
                  data-testid="version-sha"
                >
                  {shortSha}
                </a>
              ) : (
                <span className="text-muted" data-testid="version-sha">
                  {fr ? "non déployé (serveur local)" : "not a deployment (local server)"}
                </span>
              )
            }
            sub={
              info.sha ? (
                <span className="font-mono break-all" title={fr ? "identifiant complet" : "full id"}>
                  {info.sha}
                </span>
              ) : null
            }
          />
          <StatCell
            label={fr ? "Construit" : "Built"}
            value={builtAgo ?? "—"}
            sub={stamp(info.built, locale)}
          />
          <StatCell
            label={fr ? "En service depuis" : "Running since"}
            value={startedAgo ?? "—"}
            sub={stamp(info.startedAt, locale)}
          />
          <StatCell
            label={fr ? "Identifiant de build" : "Build id"}
            value={<span className="font-mono text-[13px]">{info.buildId ?? "—"}</span>}
            sub={fr ? "change à chaque construction" : "changes with every build"}
          />
        </div>
      </Panel>

      <Panel className="mt-4">
        <h2 className="text-sm font-semibold tracking-[-0.01em] text-ink">
          {fr ? "Comment vérifier qu'un changement est arrivé" : "How to check that a change has arrived"}
        </h2>
        <ol className="mt-2 flex list-decimal flex-col gap-1.5 pl-5 text-[13px] leading-relaxed text-ink-soft">
          <li>
            {fr
              ? "Notez les 7 premiers caractères du commit que vous attendez (dans la demande de fusion GitHub, ou avec "
              : "Note the first 7 characters of the commit you expect (from the GitHub pull request, or with "}
            <code className="rounded bg-surface-2 px-1 font-mono text-[12px]">git rev-parse origin/{info.target === "prod" ? "main" : "dev"}</code>
            {")."}
          </li>
          <li>
            {fr
              ? "Rechargez cette page. Si « Commit déployé » affiche les mêmes caractères, le changement est en ligne ici."
              : "Reload this page. If “Commit deployed” shows the same characters, the change is live here."}
          </li>
          <li>
            {fr
              ? "Sinon, la mise en ligne n'a pas encore eu lieu ou a échoué : regardez l'onglet Actions › Deploy sur GitHub."
              : "If not, the deployment has not happened yet or failed: look at Actions › Deploy on GitHub."}
          </li>
        </ol>
      </Panel>

      <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-[13px]">
        <Link href="/login" className="font-semibold text-emerald-700 hover:underline dark:text-emerald-400">
          ← {fr ? "Connexion" : "Sign in"}
        </Link>
        <a href="/api/version" className="text-muted hover:underline" data-testid="version-json">
          {fr ? "Version brute (JSON, pour les machines)" : "Raw version (JSON, for machines)"}
        </a>
      </div>
    </main>
  );
}
