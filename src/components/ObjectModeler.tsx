"use client";
import { useState } from "react";
import type { ClassModel } from "@/lib/types";

const splitList = (s: string) =>
  s
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);

/**
 * Core-entities board: each entry becomes a UML-class-style visual card
 * (name · attributes · methods) you can see at a glance — and the flow
 * whiteboard seeds these same boxes so relationships get drawn, not listed.
 */
export default function ObjectModeler({
  value,
  onChange
}: {
  value: ClassModel[];
  onChange: (v: ClassModel[]) => void;
}) {
  const [name, setName] = useState("");
  const [attributes, setAttributes] = useState("");
  const [methods, setMethods] = useState("");

  const add = () => {
    if (!name.trim()) return;
    onChange([
      ...value,
      { name: name.trim(), attributes, methods, relationship: "" }
    ]);
    setName("");
    setAttributes("");
    setMethods("");
  };

  const inputCls =
    "rounded border bg-white px-2 py-1 text-sm text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100";

  return (
    <div>
      <div className="grid gap-2 rounded-md border bg-white p-3 dark:bg-zinc-900">
        <input
          className={inputCls}
          placeholder="Entity name e.g. Ticket"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
        />
        <input
          className={inputCls}
          placeholder="Properties (comma separated) e.g. entryTime, slot, vehicle"
          value={attributes}
          onChange={(e) => setAttributes(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
        />
        <input
          className={inputCls}
          placeholder="Behaviors e.g. calculateFee(), validate()"
          value={methods}
          onChange={(e) => setMethods(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
        />
        <div>
          <button
            onClick={add}
            className="rounded bg-zinc-900 px-3 py-1 text-sm text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
          >
            + Add entity card
          </button>
        </div>
      </div>

      {value.length === 0 ? (
        <p className="mt-3 text-sm text-zinc-500 dark:text-zinc-400">
          No entities yet — extract nouns from the requirements (aim for 5–8).
          Each becomes a card below, then boxes on your flow board.
        </p>
      ) : (
        <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {value.map((c, i) => {
            const attrs = splitList(c.attributes);
            const meths = splitList(c.methods);
            return (
              <div
                key={`${c.name}-${i}`}
                className="overflow-hidden rounded-md border-2 border-zinc-900 bg-white text-sm dark:border-zinc-100 dark:bg-zinc-900"
              >
                <div className="flex items-center justify-between border-b-2 border-zinc-900 bg-zinc-100 px-2 py-1 dark:border-zinc-100 dark:bg-zinc-800">
                  <strong className="truncate font-mono">{c.name}</strong>
                  <button
                    className="shrink-0 text-xs text-red-600 hover:underline dark:text-red-400"
                    onClick={() => onChange(value.filter((_, j) => j !== i))}
                    title={`Remove ${c.name}`}
                  >
                    ✕
                  </button>
                </div>
                <div className="border-b border-zinc-300 px-2 py-1 dark:border-zinc-700">
                  {attrs.length > 0 ? (
                    <ul>
                      {attrs.map((a) => (
                        <li key={a} className="truncate font-mono text-xs">
                          + {a}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-xs italic text-zinc-400">no properties yet</p>
                  )}
                </div>
                <div className="px-2 py-1">
                  {meths.length > 0 ? (
                    <ul>
                      {meths.map((m) => (
                        <li key={m} className="truncate font-mono text-xs">
                          + {m}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-xs italic text-zinc-400">no behaviors yet</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
