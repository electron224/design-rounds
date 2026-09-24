"use client";

import { useState } from "react";
import Link from "next/link";
import AiSettings, { loadAiConfig } from "./AiSettings";
import FeedbackPanel from "./FeedbackPanel";
import type { StageFeedback } from "@/lib/types";
import type { HLDProblem } from "@/lib/hld";

const STAGES = ["requirements", "capacity", "api", "diagram", "deepdive"] as const;
type Stage = (typeof STAGES)[number];

/** Staged interactive solver: local drafts + per-stage server review. */
export default function HldSolver({ problem }: { problem: HLDProblem }) {
  const key = `hld-draft-${problem.slug}`;
  const [stage, setStage] = useState<Stage>("requirements");
  const [checked, setChecked] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(key + ":req") ?? "[]");
    } catch {
      return [];
    }
  });
  const [rpsGuess, setRpsGuess] = useState("");
  const [capNote, setCapNote] = useState(() => {
    try {
      return localStorage.getItem(key + ":capnote") ?? "";
    } catch {
      return "";
    }
  });
  const [apiText, setApiText] = useState(() => {
    try {
      return localStorage.getItem(key + ":api") ?? "";
    } catch {
      return "";
    }
  });
  const [edges, setEdges] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(key + ":edges") ?? "[]");
    } catch {
      return [];
    }
  });
  const [answers, setAnswers] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(key + ":answers") ?? "[]");
    } catch {
      return [];
    }
  });
  const [sel, setSel] = useState<string | null>(null);
  const [done, setDone] = useState<string[]>([]);
  const [feedbacks, setFeedbacks] = useState<Partial<Record<Stage, StageFeedback>>>({});
  const [submitting, setSubmitting] = useState<Stage | null>(null);
  const [attempt, setAttempt] = useState<string | null>(() => {
    try {
      return localStorage.getItem(key + ":attempt");
    } catch {
      return null;
    }
  });

  const save = (k: string, v: string) => {
    try {
      localStorage.setItem(k, v);
    } catch {
      /* private mode — drafts just don't persist */
    }
  };
  const markDone = (s: Stage) => setDone((d) => (d.includes(s) ? d : [...d, s]));

  const setAnswer = (i: number, v: string) => {
    const next = [...answers];
    next[i] = v;
    setAnswers(next);
    save(key + ":answers", JSON.stringify(next));
  };

  const payloadFor = (s: Stage): string => {
    switch (s) {
      case "requirements":
        return checked.join("\n");
      case "capacity":
        return `Peak writes/s estimate: ${rpsGuess}\nReasoning: ${capNote}`;
      case "api":
        return apiText;
      case "diagram":
        return edges.join("\n");
      case "deepdive":
        return problem.deepdives
          .map((d, i) => `Q: ${d.q}\nA: ${answers[i] ?? ""}`)
          .join("\n\n");
    }
  };

  const submit = async (s: Stage) => {
    setSubmitting(s);
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug: problem.slug,
          stage: s,
          payload: payloadFor(s),
          attemptId: attempt ?? undefined,
          llm: loadAiConfig() ?? undefined
        })
      });
      const data = await res.json();
      if (data.feedback)
        setFeedbacks((f) => ({ ...f, [s]: data.feedback as StageFeedback }));
      if (data.attemptId) {
        setAttempt(data.attemptId);
        save(key + ":attempt", data.attemptId);
      }
      markDone(s);
    } finally {
      setSubmitting(null);
    }
  };

  const reviewButton = (s: Stage, ready: boolean, readyLabel: string) => (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      <button
        onClick={() => void submit(s)}
        disabled={!ready || submitting === s}
        className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm text-white disabled:opacity-40"
      >
        {submitting === s
          ? "Grading…"
          : feedbacks[s]
            ? "Resubmit for review"
            : readyLabel}
      </button>
      {attempt && feedbacks[s] && (
        <Link
          href={`/report/${attempt}`}
          className="text-sm text-indigo-600 hover:underline dark:text-indigo-400"
        >
          View report →
        </Link>
      )}
    </div>
  );

  const toggleReq = (r: string) => {
    const next = checked.includes(r)
      ? checked.filter((x) => x !== r)
      : [...checked, r];
    setChecked(next);
    save(key + ":req", JSON.stringify(next));
  };

  const connect = (name: string) => {
    if (!sel) return setSel(name);
    if (sel === name) return setSel(null);
    const e = `${sel}→${name}`;
    const next = edges.includes(e) ? edges : [...edges, e];
    setEdges(next);
    save(key + ":edges", JSON.stringify(next));
    setSel(null);
  };

  const capOk =
    rpsGuess !== "" &&
    Math.abs(Number(rpsGuess) - problem.capacityWorked.rps) /
      problem.capacityWorked.rps <
      0.5;

  return (
    <div className="rounded-md border bg-white p-4 dark:bg-zinc-900">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <AiSettings />
        {attempt && (
          <Link
            href={`/report/${attempt}`}
            className="text-sm text-indigo-600 hover:underline dark:text-indigo-400"
          >
            Attempt report →
          </Link>
        )}
      </div>
      <div className="flex flex-wrap gap-1">
        {STAGES.map((s) => (
          <button
            key={s}
            onClick={() => setStage(s)}
            className={`rounded px-2 py-1 text-xs font-semibold capitalize ${
              s === stage
                ? "bg-indigo-600 text-white"
                : "bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700"
            }`}
          >
            {done.includes(s) ? "✓ " : ""}
            {s}
          </button>
        ))}
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded bg-zinc-200 dark:bg-zinc-800">
        <div
          className="h-full bg-indigo-600 transition-all"
          style={{ width: `${(done.length / STAGES.length) * 100}%` }}
        />
      </div>

      {stage === "requirements" && (
        <div className="mt-3">
          <p className="text-sm font-semibold">Check every in-scope requirement:</p>
          {problem.requirements.map((r) => (
            <label key={r} className="mt-1 flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                checked={checked.includes(r)}
                onChange={() => toggleReq(r)}
                className="mt-1"
              />
              {r}
            </label>
          ))}
          <button
            onClick={() => markDone("requirements")}
            disabled={checked.length < problem.requirements.length}
            className="mt-3 rounded-md bg-indigo-600 px-3 py-1.5 text-sm text-white disabled:opacity-40"
          >
            {checked.length < problem.requirements.length
              ? `Check all ${problem.requirements.length} to continue`
              : "Requirements locked →"}
          </button>
          {reviewButton(
            "requirements",
            checked.length >= problem.requirements.length,
            "Submit requirements for review"
          )}
          {feedbacks.requirements && (
            <div className="mt-3">
              <FeedbackPanel feedback={feedbacks.requirements} />
            </div>
          )}
        </div>
      )}

      {stage === "capacity" && (
        <div className="mt-3 text-sm">
          <p>
            Back-of-envelope: what peak <strong>writes/s</strong> do you plan
            for? (Reference answer:{" "}
            <strong>{problem.capacityWorked.rps}/s</strong> — within 50% counts.)
          </p>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            {problem.capacityWorked.note}
          </p>
          <div className="mt-2 flex gap-2">
            <input
              value={rpsGuess}
              onChange={(e) => setRpsGuess(e.target.value)}
              inputMode="numeric"
              placeholder="e.g. 500"
              aria-label="Writes per second estimate"
              className="w-32 rounded-md border px-2 py-1 dark:bg-zinc-800"
            />
            <button
              onClick={() => capOk && markDone("capacity")}
              disabled={!capOk}
              className="rounded-md bg-indigo-600 px-3 py-1.5 text-white disabled:opacity-40"
            >
              {capOk ? "Capacity nailed →" : "Check estimate"}
            </button>
          </div>
          <textarea
            value={capNote}
            onChange={(e) => {
              setCapNote(e.target.value);
              save(key + ":capnote", e.target.value);
            }}
            rows={2}
            placeholder="Reasoning: where do reads go, what breaks first at 10x? (graded too)"
            aria-label="Capacity reasoning"
            className="mt-2 w-full rounded-md border px-2 py-1 text-xs dark:bg-zinc-800"
          />
          {reviewButton("capacity", capOk, "Submit capacity for review")}
          {feedbacks.capacity && (
            <div className="mt-3">
              <FeedbackPanel feedback={feedbacks.capacity} />
            </div>
          )}
        </div>
      )}

      {stage === "api" && (
        <div className="mt-3 text-sm">
          <p className="font-semibold">Sketch the core APIs (one per line):</p>
          <ul className="mt-1 list-disc pl-5 text-xs text-zinc-600 dark:text-zinc-400">
            {problem.apis.map((a) => (
              <li key={a.path}>
                <code>
                  {a.method} {a.path}
                </code>{" "}
                — {a.desc}
              </li>
            ))}
          </ul>
          <textarea
            value={apiText}
            onChange={(e) => {
              setApiText(e.target.value);
              save(key + ":api", e.target.value);
            }}
            rows={4}
            placeholder="POST /v1/shorten …&#10;GET /:code …"
            className="mt-2 w-full rounded-md border px-2 py-1 font-mono text-xs dark:bg-zinc-800"
          />
          <button
            onClick={() => apiText.trim().length > 20 && markDone("api")}
            disabled={apiText.trim().length <= 20}
            className="mt-2 rounded-md bg-indigo-600 px-3 py-1.5 text-white disabled:opacity-40"
          >
            APIs sketched →
          </button>
          {reviewButton(
            "api",
            apiText.trim().length > 20,
            "Submit APIs for review"
          )}
          {feedbacks.api && (
            <div className="mt-3">
              <FeedbackPanel feedback={feedbacks.api} />
            </div>
          )}
        </div>
      )}

      {stage === "diagram" && (
        <div className="mt-3 text-sm">
          <p className="font-semibold">
            Click two components to connect them (build {problem.flow.length - 1}+
            edges):
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {problem.components.map((c) => (
              <button
                key={c.name}
                title={c.role}
                onClick={() => connect(c.name)}
                className={`rounded-md border-2 px-3 py-1.5 text-xs font-semibold ${
                  sel === c.name
                    ? "border-indigo-600 bg-indigo-50 dark:bg-indigo-950"
                    : "border-zinc-300 dark:border-zinc-700"
                }`}
              >
                {c.name}
              </button>
            ))}
          </div>
          <div className="mt-2 font-mono text-xs">
            {edges.length === 0 ? (
              <span className="text-zinc-500">No connections yet.</span>
            ) : (
              edges.map((e) => (
                <span
                  key={e}
                  className="mr-1 rounded bg-indigo-50 px-1.5 py-0.5 dark:bg-indigo-950"
                >
                  {e}
                </span>
              ))
            )}
          </div>
          <button
            onClick={() => edges.length >= problem.flow.length - 1 && markDone("diagram")}
            disabled={edges.length < problem.flow.length - 1}
            className="mt-2 rounded-md bg-indigo-600 px-3 py-1.5 text-white disabled:opacity-40"
          >
            Diagram connected →
          </button>
          {reviewButton(
            "diagram",
            edges.length >= problem.flow.length - 1,
            "Submit diagram for review"
          )}
          {feedbacks.diagram && (
            <div className="mt-3">
              <FeedbackPanel feedback={feedbacks.diagram} />
            </div>
          )}
        </div>
      )}

      {stage === "deepdive" && (
        <div className="mt-3 text-sm">
          <p className="font-semibold">Interviewer twists — write your answer:</p>
          {problem.deepdives.map((d, i) => (
            <details key={i} className="mt-1 rounded border p-2 dark:border-zinc-700">
              <summary className="cursor-pointer font-medium">{d.q}</summary>
              <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
                Hint: {d.hint}
              </p>
              <textarea
                value={answers[i] ?? ""}
                onChange={(e) => setAnswer(i, e.target.value)}
                rows={2}
                placeholder="Decision, what breaks, what you watch…"
                aria-label={`Answer to twist ${i + 1}`}
                className="mt-1 w-full rounded-md border px-2 py-1 text-xs dark:bg-zinc-800"
              />
            </details>
          ))}
          <div className="mt-2 rounded bg-zinc-100 p-2 text-xs dark:bg-zinc-800">
            <strong>Model decisions:</strong>
            <ul className="list-disc pl-4">
              {problem.decisions.map((d) => (
                <li key={d}>{d}</li>
              ))}
            </ul>
          </div>
          <button
            onClick={() => markDone("deepdive")}
            className="mt-2 rounded-md bg-green-600 px-3 py-1.5 text-white"
          >
            {done.includes("deepdive") ? "Solved ✓ — review again" : "Mark solved 🎉"}
          </button>
          {reviewButton(
            "deepdive",
            answers.some((a) => (a ?? "").trim().length > 10),
            "Submit deep-dives for review"
          )}
          {feedbacks.deepdive && (
            <div className="mt-3">
              <FeedbackPanel feedback={feedbacks.deepdive} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
