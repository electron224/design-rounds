"use client";
import { useEffect, useRef } from "react";
import { useSystemTheme } from "@/lib/useSystemTheme";

export default function FlowEditor({
  value,
  onChange
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const dark = useSystemTheme();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const mermaid = (await import("mermaid")).default;
        mermaid.initialize({ startOnLoad: false, theme: dark ? "dark" : "neutral" });
        if (!cancelled && ref.current) {
          ref.current.innerHTML = "";
          const id = `mmd-${Date.now()}`;
          const { svg } = await mermaid.render(id, value || "sequenceDiagram\n  participant C as Client");
          if (!cancelled && ref.current) ref.current.innerHTML = svg;
        }
      } catch {
        if (ref.current) ref.current.innerHTML = "<p>Preview unavailable — check Mermaid syntax.</p>";
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [value, dark]);

  return (
    <div className="grid gap-3 md:grid-cols-2">
      <textarea
        className="h-[560px] rounded-md border bg-white p-2 font-mono text-xs text-zinc-900 dark:bg-zinc-900 dark:text-zinc-100"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        spellCheck={false}
      />
      <div className="h-[560px] overflow-auto rounded-md border bg-white p-2 dark:bg-zinc-900" ref={ref} />
    </div>
  );
}
