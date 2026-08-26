import Link from "next/link";

export const metadata = {
  title: "Terms of Service · AuditISA",
  description: "The terms governing use of the AuditISA statutory-audit platform.",
  robots: { index: true, follow: true },
};

export default function TermsPage() {
  return (
    <main className="mx-auto min-h-screen w-full max-w-3xl px-6 py-12">
      <h1 className="text-[26px] font-extrabold tracking-[-0.02em] text-ink">Terms of Service / Conditions d&rsquo;utilisation</h1>
      <div className="mt-5 flex flex-col gap-3 text-[13.5px] leading-relaxed text-ink-soft">
        <p>AuditISA is provided to audit firms under their subscription agreement with the platform operator. Access is limited to authorised users of a subscribed firm; each firm&rsquo;s data is segregated and remains the property of that firm and, where applicable, of its clients.</p>
        <p>Users must keep their credentials confidential, use the platform only for legitimate engagement work, and comply with the professional standards applicable to their engagements (ISA, OHADA/SYSCOHADA, and local requirements).</p>
        <p>The platform operator may suspend access that threatens the security or integrity of the service. The full subscription agreement between the operator and the firm prevails over this summary.</p>
        <p>L&rsquo;acc&egrave;s &agrave; AuditISA est r&eacute;serv&eacute; aux utilisateurs autoris&eacute;s d&rsquo;un cabinet abonn&eacute;. Les donn&eacute;es de chaque cabinet sont cloisonn&eacute;es et demeurent sa propri&eacute;t&eacute;. Le contrat d&rsquo;abonnement entre l&rsquo;op&eacute;rateur et le cabinet pr&eacute;vaut sur ce r&eacute;sum&eacute;.</p>
      </div>
      <Link href="/login" className="mt-8 inline-block text-[13px] font-semibold text-emerald-700 hover:underline dark:text-emerald-400">← Sign in / Connexion</Link>
    </main>
  );
}
