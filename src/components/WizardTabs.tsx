"use client";

export interface WizardTabDef {
  id: string;
  index: number;
  label: string;
  done: boolean;
}

/** Stage tabs + optional next-stage CTA. Purely presentational. */
export default function WizardTabs({
  tabs,
  active,
  onSelect,
  next,
}: {
  tabs: WizardTabDef[];
  active: string;
  onSelect: (id: string) => void;
  next: { label: string; onNext: () => void } | null;
}) {
  return (
    <div className="flex items-center gap-2 overflow-x-auto">
      <div className="flex gap-2">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => onSelect(t.id)}
            aria-current={t.id === active ? "step" : undefined}
            className={`shrink-0 rounded-md px-3 py-1.5 text-sm font-semibold ${t.id === active ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900" : "border bg-white hover:bg-zinc-100 dark:bg-zinc-900 dark:hover:bg-zinc-800"}`}
          >
            {t.index}. {t.label}
            {t.done ? " ✓" : ""}
          </button>
        ))}
      </div>
      {next && (
        <button
          onClick={next.onNext}
          className="shrink-0 rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-indigo-500"
        >
          Next: {next.label} →
        </button>
      )}
    </div>
  );
}
