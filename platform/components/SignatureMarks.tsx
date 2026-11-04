import { signatureMarks } from "@/lib/signature-marks";

/** The "A" (Associé) and "EQR" markers beside a task's P and R chips (F007). */
export function SignatureMarks({ code, fr }: { code: string; fr: boolean }) {
  const marks = signatureMarks(code);
  if (!marks.partner && !marks.eqr) return null;
  const chip = "inline-flex h-5 min-w-5 flex-shrink-0 items-center justify-center rounded-md border border-line-strong px-1 text-[10px] font-extrabold text-ink-soft";
  return (
    <span className="inline-flex items-center gap-1">
      {marks.partner ? (
        <span
          className={chip}
          title={fr ? "Associé : l'associé de la mission signe cette feuille" : "Associé: the engagement partner signs this paper"}
          data-testid={`mark-partner-${code}`}
        >
          A
        </span>
      ) : null}
      {marks.eqr ? (
        <span
          className={chip}
          title={fr ? "Revue de contrôle qualité de la mission : signée par le réviseur EQR" : "Engagement quality review: signed by the EQR"}
          data-testid={`mark-eqr-${code}`}
        >
          EQR
        </span>
      ) : null}
    </span>
  );
}
