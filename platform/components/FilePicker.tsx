"use client";

import { useState, type ChangeEvent, type Ref } from "react";

/**
 * A file input with a translated button (F087): the browser's own control shows
 * "Choose file / No file chosen" in the browser's language, whatever the UI's.
 * The real input stays in the form, visually hidden, so required and form
 * submission work as before.
 */
export function FilePicker({
  name,
  accept,
  required,
  multiple,
  disabled,
  locale,
  testId,
  inputRef,
  onChange,
  className,
}: {
  name?: string;
  accept?: string;
  required?: boolean;
  multiple?: boolean;
  disabled?: boolean;
  locale: "en" | "fr";
  testId?: string;
  inputRef?: Ref<HTMLInputElement>;
  onChange?: (event: ChangeEvent<HTMLInputElement>) => void;
  className?: string;
}) {
  const fr = locale === "fr";
  const [chosen, setChosen] = useState<string | null>(null);
  return (
    <label className={`inline-flex cursor-pointer items-center gap-2 text-sm text-ink-soft ${className ?? ""}`}>
      <span className="rounded-[var(--radius-atlas-sm)] border border-line-strong bg-surface px-2.5 py-1 text-[12.5px] font-medium hover:bg-surface-2">
        {multiple ? (fr ? "Choisir des fichiers" : "Choose files") : fr ? "Choisir un fichier" : "Choose a file"}
      </span>
      <span className="max-w-[260px] truncate text-[12px] text-muted" data-testid={testId ? `${testId}-name` : undefined}>
        {chosen ?? (fr ? "Aucun fichier choisi" : "No file chosen")}
      </span>
      <input
        ref={inputRef}
        type="file"
        name={name}
        accept={accept}
        required={required}
        multiple={multiple}
        disabled={disabled}
        data-testid={testId}
        className="sr-only"
        onChange={(event) => {
          const files = event.target.files;
          setChosen(files && files.length > 0 ? (files.length === 1 ? files[0].name : `${files.length} ${fr ? "fichiers" : "files"}`) : null);
          onChange?.(event);
        }}
      />
    </label>
  );
}
