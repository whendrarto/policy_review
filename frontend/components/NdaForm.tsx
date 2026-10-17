import { useId, useState, type ReactNode } from "react";
import { isValidYears, MAX_YEARS, MIN_YEARS } from "@/lib/nda/document";
import type { NdaForm as NdaFormValues, Party } from "@/lib/nda/types";

type Props = {
  form: NdaFormValues;
  onChange: (form: NdaFormValues) => void;
};

const baseInputClass =
  "rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-xs focus:border-sky-500 focus:ring-2 focus:ring-sky-200 focus:outline-none disabled:bg-zinc-100 disabled:text-zinc-400";
const inputClass = `w-full ${baseInputClass}`;

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-sm font-medium text-zinc-800">{label}</span>
      {children}
      {hint && <span className="block text-xs text-zinc-500">{hint}</span>}
    </label>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset className="space-y-4 border-t border-zinc-200 pt-5">
      <legend className="pr-2 text-xs font-semibold tracking-wider text-zinc-500 uppercase">{title}</legend>
      {children}
    </fieldset>
  );
}

type YearsInputProps = { value: number; disabled: boolean; onChange: (years: number) => void; label: string; errorId: string };

function YearsInput({ value, disabled, onChange, label, errorId }: YearsInputProps) {
  // The typed text is kept separately so in-progress input isn't reformatted from the number.
  const [text, setText] = useState(Number.isNaN(value) ? "" : String(value));
  const invalid = !disabled && !isValidYears(value);
  return (
    <input
      type="number"
      min={MIN_YEARS}
      max={MAX_YEARS}
      step={1}
      aria-label={label}
      aria-invalid={invalid}
      aria-describedby={invalid ? errorId : undefined}
      className={`${baseInputClass} w-20 py-1 ${invalid ? "border-red-500 focus:border-red-500 focus:ring-red-200" : ""}`}
      value={text}
      disabled={disabled}
      onChange={(e) => {
        setText(e.target.value);
        onChange(e.target.value === "" ? NaN : Number(e.target.value));
      }}
    />
  );
}

function YearsError({ id, show }: { id: string; show: boolean }) {
  if (!show) return null;
  return (
    <p id={id} className="pl-6 text-xs text-red-700">
      Enter a whole number of years from {MIN_YEARS} to {MAX_YEARS}.
    </p>
  );
}

export function NdaForm({ form, onChange }: Props) {
  const set = <K extends keyof NdaFormValues>(key: K, value: NdaFormValues[K]) => onChange({ ...form, [key]: value });
  const setParty = (key: "party1" | "party2", field: keyof Party, value: string) => set(key, { ...form[key], [field]: value });
  const mndaYearsErrorId = useId();
  const confidentialityYearsErrorId = useId();

  return (
    <form className="space-y-6" onSubmit={(e) => e.preventDefault()}>
      <Section title="Agreement">
        <Field label="Purpose" hint="How Confidential Information may be used">
          <textarea rows={3} className={inputClass} value={form.purpose} onChange={(e) => set("purpose", e.target.value)} />
        </Field>

        <Field label="Effective Date">
          <input type="date" className={inputClass} value={form.effectiveDate} onChange={(e) => set("effectiveDate", e.target.value)} />
        </Field>

        <div className="space-y-2">
          <span className="text-sm font-medium text-zinc-800">MNDA Term</span>
          <label className="flex items-center gap-2 text-sm">
            <input type="radio" name="mndaTerm" checked={form.mndaTerm === "expires"} onChange={() => set("mndaTerm", "expires")} />
            Expires
            <YearsInput
              label="MNDA term in years"
              value={form.mndaTermYears}
              disabled={form.mndaTerm !== "expires"}
              onChange={(years) => set("mndaTermYears", years)}
              errorId={mndaYearsErrorId}
            />
            year(s) from Effective Date
          </label>
          <YearsError id={mndaYearsErrorId} show={form.mndaTerm === "expires" && !isValidYears(form.mndaTermYears)} />
          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name="mndaTerm"
              checked={form.mndaTerm === "untilTerminated"}
              onChange={() => set("mndaTerm", "untilTerminated")}
            />
            Continues until terminated
          </label>
        </div>

        <div className="space-y-2">
          <span className="text-sm font-medium text-zinc-800">Term of Confidentiality</span>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name="confidentialityTerm"
              checked={form.confidentialityTerm === "years"}
              onChange={() => set("confidentialityTerm", "years")}
            />
            <YearsInput
              label="Term of confidentiality in years"
              value={form.confidentialityYears}
              disabled={form.confidentialityTerm !== "years"}
              onChange={(years) => set("confidentialityYears", years)}
              errorId={confidentialityYearsErrorId}
            />
            year(s) from Effective Date
          </label>
          <YearsError
            id={confidentialityYearsErrorId}
            show={form.confidentialityTerm === "years" && !isValidYears(form.confidentialityYears)}
          />
          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name="confidentialityTerm"
              checked={form.confidentialityTerm === "perpetual"}
              onChange={() => set("confidentialityTerm", "perpetual")}
            />
            In perpetuity
          </label>
        </div>
      </Section>

      <Section title="Governing Law & Jurisdiction">
        <Field label="Governing Law" hint="State whose laws govern the MNDA, e.g. Delaware">
          <input className={inputClass} value={form.governingLaw} onChange={(e) => set("governingLaw", e.target.value)} />
        </Field>
        <Field label="Jurisdiction" hint="e.g. courts located in New Castle, DE">
          <input className={inputClass} value={form.jurisdiction} onChange={(e) => set("jurisdiction", e.target.value)} />
        </Field>
      </Section>

      <Section title="Modifications">
        <Field label="MNDA Modifications" hint="Optional. Changes to the Standard Terms; these control over the Standard Terms.">
          <textarea rows={3} className={inputClass} value={form.modifications} onChange={(e) => set("modifications", e.target.value)} />
        </Field>
      </Section>

      {(["party1", "party2"] as const).map((key, i) => (
        <Section key={key} title={`Party ${i + 1}`}>
          <Field label="Company">
            <input className={inputClass} value={form[key].company} onChange={(e) => setParty(key, "company", e.target.value)} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Signer name">
              <input className={inputClass} value={form[key].name} onChange={(e) => setParty(key, "name", e.target.value)} />
            </Field>
            <Field label="Title">
              <input className={inputClass} value={form[key].title} onChange={(e) => setParty(key, "title", e.target.value)} />
            </Field>
          </div>
          <Field label="Notice Address" hint="Use either email or postal address">
            <textarea
              rows={2}
              className={inputClass}
              value={form[key].noticeAddress}
              onChange={(e) => setParty(key, "noticeAddress", e.target.value)}
            />
          </Field>
        </Section>
      ))}
    </form>
  );
}
