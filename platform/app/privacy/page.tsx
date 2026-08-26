import Link from "next/link";

export const metadata = {
  title: "Privacy Policy · AuditISA",
  description: "How the AuditISA platform handles personal data.",
  robots: { index: true, follow: true },
};

export default function PrivacyPage() {
  return (
    <main className="mx-auto min-h-screen w-full max-w-3xl px-6 py-12">
      <h1 className="text-[26px] font-extrabold tracking-[-0.02em] text-ink">Privacy Policy / Politique de confidentialit&eacute;</h1>
      <div className="mt-5 flex flex-col gap-3 text-[13.5px] leading-relaxed text-ink-soft">
        <p>AuditISA processes the personal data strictly necessary to operate an audit file: user account details (name, professional email), engagement records entered by the firm, and technical logs kept for security. Each firm&rsquo;s data is isolated by database-enforced row-level security.</p>
        <p>Passwords are stored only as strong one-way hashes. Audit files carry retention obligations under professional standards; retention and legal-hold rules are enforced by the platform. Data is not sold or shared with third parties outside the operator&rsquo;s processors (hosting, email delivery).</p>
        <p>To exercise access or correction rights, contact your firm&rsquo;s administrator or the platform operator.</p>
        <p>AuditISA traite les seules donn&eacute;es n&eacute;cessaires &agrave; la tenue d&rsquo;un dossier d&rsquo;audit. Les donn&eacute;es de chaque cabinet sont isol&eacute;es par s&eacute;curit&eacute; au niveau des lignes. Les mots de passe ne sont conserv&eacute;s que sous forme de hachage. Pour exercer vos droits, contactez l&rsquo;administrateur de votre cabinet ou l&rsquo;op&eacute;rateur.</p>
      </div>
      <Link href="/login" className="mt-8 inline-block text-[13px] font-semibold text-emerald-700 hover:underline dark:text-emerald-400">← Sign in / Connexion</Link>
    </main>
  );
}
