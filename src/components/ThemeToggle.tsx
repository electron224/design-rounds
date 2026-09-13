"use client";
import { useSyncExternalStore } from "react";
import {
  THEME_EVENT,
  loadThemeChoice,
  saveThemeChoice,
  type ThemeChoice
} from "@/lib/theme";

const OPTIONS: { value: ThemeChoice; label: string; title: string }[] = [
  { value: "light", label: "Light", title: "Force light theme" },
  { value: "system", label: "System", title: "Follow the OS theme" },
  { value: "dark", label: "Dark", title: "Force dark theme" }
];

function subscribeTheme(cb: () => void): () => void {
  window.addEventListener(THEME_EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(THEME_EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}

/** Candidate-facing Light / System / Dark switch (header). */
export default function ThemeToggle() {
  // Hydration-safe: server and first client paint both see "system";
  // the stored choice resolves silently right after hydration.
  const choice = useSyncExternalStore(
    subscribeTheme,
    () => loadThemeChoice(),
    () => "system" as ThemeChoice
  );

  const pick = (c: ThemeChoice) => {
    saveThemeChoice(c);
  };

  return (
    <div
      role="group"
      aria-label="Color theme"
      className="flex overflow-hidden rounded-md border border-zinc-300 text-xs dark:border-zinc-700"
    >
      {OPTIONS.map((o) => (
        <button
          key={o.value}
          onClick={() => pick(o.value)}
          title={o.title}
          aria-pressed={choice === o.value}
          className={`px-2 py-1 ${
            choice === o.value
              ? "bg-zinc-900 font-semibold text-white dark:bg-zinc-100 dark:text-zinc-900"
              : "bg-white text-zinc-600 hover:bg-zinc-100 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
