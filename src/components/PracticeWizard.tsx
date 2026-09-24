"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Timer from "@/components/Timer";
import ObjectModeler from "@/components/ObjectModeler";
import WizardTabs from "@/components/WizardTabs";
import FlowEditor from "@/components/FlowEditor";
import Whiteboard from "@/components/Whiteboard";
import ProjectEditor from "@/components/ProjectEditor";
import RunPanel from "@/components/RunPanel";
import AiSettings, { loadAiConfig } from "@/components/AiSettings";
import FeedbackPanel from "@/components/FeedbackPanel";
import { summarizeScene } from "@/lib/scene";
import { sanitizeStageFeedback } from "@/lib/safeFeedback";
import { joinFiles, type ProjectFile } from "@/lib/files";
import {
  readAttemptForSlug,
  touchAttempt
} from "@/lib/attemptIndex";
import { buildSkeleton } from "@/lib/problems";
import { checkCoherence } from "@/lib/coherence";
import type { ClassModel, LLDProblem, Stage, StageFeedback } from "@/lib/types";

const DEFAULT_FLOW = `sequenceDiagram
  participant C as Client
  participant S as System
  C->>S: request(...)
  S-->>C: response
`;

export default function PracticeWizard({
  problem,
  timerMin,
  resumeAttemptId
}: {
  problem: LLDProblem;
  timerMin: number;
  resumeAttemptId: string | null;
}) {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<"saved" | "saving" | "off">("off");
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [stage, setStage] = useState<Stage>("clarify");
  const [questions, setQuestions] = useState("");
  const [agreed, setAgreed] = useState<string[]>([]);
  const [newAgreed, setNewAgreed] = useState("");
  const [classes, setClasses] = useState<ClassModel[]>([]);
  const [flowMode, setFlowMode] = useState<"draw" | "mermaid">("draw");
  const [scene, setScene] = useState<readonly object[]>([]);
  const [flow, setFlow] = useState(DEFAULT_FLOW);
  const [files, setFiles] = useState<ProjectFile[]>([
    { path: "Solution.java", content: problem.codeStarter.java }
  ]);
  const [folders, setFolders] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [feedbacks, setFeedbacks] = useState<Partial<Record<Stage, StageFeedback>>>({});
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [expired, setExpired] = useState(false);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [submitCount, setSubmitCount] = useState(0);
  const stageCardRef = useRef<HTMLDivElement>(null);
  const feedbackRef = useRef<HTMLDivElement>(null);
  const firstSubmit = useRef(true);

  /** Guided attention, never animation for its own sake. */
  const reveal = (el: HTMLElement | null) => {
    if (!el || typeof el.scrollIntoView !== "function") return;
    const reduce =
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
  };

  const selectStage = (t: Stage) => {
    setStage(t);
    reveal(stageCardRef.current);
  };

  // Newly arrived feedback scrolls into view after commit (Timer pattern:
  // notify as an effect, never inside the submit handler).
  useEffect(() => {
    if (firstSubmit.current) {
      firstSubmit.current = false;
      return;
    }
    reveal(feedbackRef.current);
  }, [submitCount]);

  const flowText = flowMode === "draw" ? summarizeScene(scene) : flow;
  const coherence = useMemo(
    () => checkCoherence(classes, flowText, files),
    [classes, flowText, files]
  );

  const payload = useMemo(() => {
    if (stage === "clarify") return questions;
    if (stage === "objects") return JSON.stringify(classes, null, 2);
    if (stage === "flow") return flowText;
    return joinFiles(files, folders);
  }, [stage, questions, classes, flowText, files, folders]);

  const addStarter = (l: "java" | "python" | "typescript") => {
    const name =
      l === "java" ? "Solution.java" : l === "python" ? "solution.py" : "solution.ts";
    if (files.some((f) => f.path === name)) return;
    setFiles([...files, { path: name, content: problem.codeStarter[l] }]);
  };

  // ---- Attempt lifecycle: resume, autosave, fresh, finish ----
  const applyDrafts = (d: Record<string, unknown> | null) => {
    if (!d || typeof d !== "object") return;
    if (typeof d.questions === "string") setQuestions(d.questions);
    if (Array.isArray(d.agreed))
      setAgreed(d.agreed.filter((a): a is string => typeof a === "string"));
    if (Array.isArray(d.classes))
      setClasses(d.classes as ClassModel[]);
    if (typeof d.flow === "string") setFlow(d.flow);
    if (d.flowMode === "draw" || d.flowMode === "mermaid") setFlowMode(d.flowMode);
    if (Array.isArray(d.scene)) setScene(d.scene as object[]);
    if (Array.isArray(d.files)) {
      const clean = (d.files as unknown[]).filter(
        (f): f is ProjectFile =>
          !!f && typeof f === "object" &&
          typeof (f as ProjectFile).path === "string" &&
          typeof (f as ProjectFile).content === "string"
      );
      if (clean.length > 0) setFiles(clean);
    }
    if (Array.isArray(d.folders))
      setFolders(d.folders.filter((f): f is string => typeof f === "string"));
    if (typeof d.timeLeftSec === "number" && Number.isFinite(d.timeLeftSec))
      setTimeLeft(Math.max(0, Math.floor(d.timeLeftSec)));
  };

  const touchIndex = (id: string, status?: string) =>
    touchAttempt(id, problem.slug, status);

  const indexForSlug = (): string | null =>
    readAttemptForSlug(problem.slug)?.id ?? null;

  const loadAttempt = async (id: string) => {
    try {
      const res = await fetch(`/api/attempts?attemptId=${id}`);
      if (!res.ok) return false;
      const data = await res.json();
      if (!data.attempt || data.attempt.problemSlug !== problem.slug)
        return false;
      setAttemptId(id);
      applyDrafts(data.attempt.drafts);
      const fb: Partial<Record<Stage, StageFeedback>> = {};
      for (const s of data.submissions ?? []) {
        try {
          // Rows stored before sanitization may hold raw model shapes.
          fb[s.stage as Stage] = sanitizeStageFeedback(JSON.parse(s.feedback));
        } catch {
          /* skip corrupt rows */
        }
      }
      setFeedbacks(fb);
      touchIndex(id);
      return true;
    } catch {
      return false;
    }
  };

  const createAttempt = async () => {
    try {
      const res = await fetch("/api/attempts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ problemSlug: problem.slug, timerMin })
      });
      const data = await res.json();
      if (data.attemptId) {
        setAttemptId(data.attemptId);
        touchIndex(data.attemptId);
        return data.attemptId as string;
      }
    } catch {
      /* offline — practice continues without persistence */
    }
    return null;
  };

  useEffect(() => {
    (async () => {
      const target = resumeAttemptId ?? indexForSlug();
      let ok = false;
      if (target) ok = await loadAttempt(target);
      if (!ok) await createAttempt();
      setReady(true);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Debounced autosave of all drafts.
  useEffect(() => {
    if (!ready || !attemptId) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      setSaveState("saving");
      try {
        await fetch("/api/attempts", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            attemptId,
            drafts: { questions, agreed, classes, flow, flowMode, scene, files, folders, timeLeftSec: timeLeft }
          })
        });
        setSavedAt(new Date().toLocaleTimeString());
        setSaveState("saved");
      } catch {
        setSaveState("off");
      }
    }, 2000);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [questions, agreed, classes, flow, flowMode, scene, files, folders, timeLeft, attemptId, ready]);

  // Last-chance save when the tab hides or closes (autosave may be mid-debounce).
  // Refs mirror render state inside an effect — never read/write them mid-render.
  const draftRef = useRef({ questions, agreed, classes, flow, flowMode, scene, files, folders, timeLeft });
  const attemptRef = useRef<string | null>(null);
  useEffect(() => {
    draftRef.current = { questions, agreed, classes, flow, flowMode, scene, files, folders, timeLeft };
    attemptRef.current = attemptId;
  });
  useEffect(() => {
    const flush = () => {
      if (document.visibilityState !== "hidden") return;
      const id = attemptRef.current;
      if (!id) return;
      try {
        void fetch("/api/attempts", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ attemptId: id, drafts: draftRef.current }),
          keepalive: true
        });
      } catch {
        /* page is going away — autosave already holds the rest */
      }
    };
    document.addEventListener("visibilitychange", flush);
    window.addEventListener("pagehide", flush);
    return () => {
      document.removeEventListener("visibilitychange", flush);
      window.removeEventListener("pagehide", flush);
    };
  }, []);

  const startFresh = async () => {
    setReady(false);
    setQuestions("");
    setAgreed([]);
    setNewAgreed("");
    setTimeLeft(null);
    setClasses([]);
    setFlow(DEFAULT_FLOW);
    setFlowMode("draw");
    setScene([]);
    setFiles([{ path: "Solution.java", content: problem.codeStarter.java }]);
    setFolders([]);
    setFeedbacks({});
    setElapsed(0);
    setExpired(false);
    await createAttempt();
    setReady(true);
  };

  const finish = async () => {
    if (!attemptId) return;
    touchIndex(attemptId, "finished");
    try {
      await fetch("/api/attempts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          attemptId,
          status: "finished",
          drafts: { questions, agreed, classes, flow, flowMode, scene, files, folders, timeLeftSec: timeLeft }
        })
      });
    } catch {
      /* report still renders from submissions */
    }
    router.push(`/report/${attemptId}`);
  };

  const submit = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug: problem.slug,
          stage,
          payload,
          attemptId,
          timerMin,
          llm: loadAiConfig() ?? undefined
        })
      });
      const data = await res.json();
      if (data.feedback) {
        setFeedbacks((f) => ({ ...f, [stage]: data.feedback }));
        setSubmitCount((c) => c + 1);
      }
      if (data.attemptId) setAttemptId(data.attemptId);
    } finally {
      setLoading(false);
    }
  };

  const tabs: Stage[] = ["clarify", "objects", "flow", "code"];
  const tabLabel = (t: Stage) =>
    t === "clarify"
      ? "Clarify"
      : t === "objects"
        ? "Entities"
        : t === "flow"
          ? "Flow"
          : "Code";
  const stageIdx = tabs.indexOf(stage);
  const nextStage = stageIdx < tabs.length - 1 ? tabs[stageIdx + 1] : null;

  return (
    <div>
      <div className="sticky top-0 z-10 -mx-1 bg-zinc-50/95 px-1 py-2 backdrop-blur dark:bg-zinc-950/95">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <WizardTabs
            tabs={tabs.map((t, i) => ({
              id: t,
              index: i,
              label: tabLabel(t),
              done: Boolean(feedbacks[t])
            }))}
            active={stage}
            onSelect={(id) => selectStage(id as Stage)}
            next={
              nextStage && feedbacks[stage]
                ? { label: tabLabel(nextStage), onNext: () => selectStage(nextStage) }
                : null
            }
          />
          <Timer
          key={attemptId ?? "pending"}
          minutes={timerMin}
          initialLeft={timeLeft ?? undefined}
          onExpire={() => {
            setExpired(true);
            submit();
          }}
          onTick={(sec, el) => {
            setTimeLeft(sec);
            setElapsed(el);
          }}
        />
        </div>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
        <button
          onClick={startFresh}
          className="rounded border bg-white px-2 py-1 hover:bg-zinc-100 dark:bg-zinc-900 dark:hover:bg-zinc-800"
        >
          Start fresh
        </button>
        <button
          onClick={finish}
          disabled={!attemptId}
          className="rounded bg-indigo-600 px-2 py-1 font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
        >
          Finish &amp; see score
        </button>
        <AiSettings />
        {saveState === "saving" && <span>Saving…</span>}
        {saveState === "saved" && savedAt && <span>All work saved ✓ {savedAt}</span>}
        <span>Pause anytime — work and clock restore here. Start fresh resets both.</span>
      </div>

      {!ready ? (
        <p className="mt-4 text-sm text-zinc-500">Loading your attempt…</p>
      ) : (
      <div className="mt-4 space-y-4">
        <div ref={stageCardRef} className="scroll-mt-24 rounded-md border bg-zinc-50 p-4 dark:bg-zinc-900">
          <h2 className="font-semibold">
            {stage === "clarify" && "Stage 0 — Ask before you design"}
            {stage === "objects" && "Stage 1 — Core entities"}
            {stage === "flow" && "Stage 2 — Draw the flow (whiteboard)"}
            {stage === "code" && "Stage 3 — Code it in the IDE (run it below)"}
          </h2>
          <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
            {stage === "clarify" &&
              "Write the questions you'd ask the interviewer first — users, scope, scale, ambiguities. Two sharp questions beat ten vague ones."}
            {stage === "objects" &&
              "Name the core entities as visual cards — name, properties, behaviors. Relationships come later: you'll draw them between these same boxes on the flow board."}
            {stage === "flow" &&
              "Draw boxes + arrows on the whiteboard (or switch to Mermaid text). Show happy path + error branches (full/invalid/expire) + state transitions; concurrency notes expected where relevant."}
            {stage === "code" &&
              "Create folders with + Folder (even empty ones, like a real IDE), one class per file. Interview standard is Java, but any language works — the editor detects it from the extension."}
          </p>
          {stage !== "clarify" && agreed.length > 0 && (
            <p className="mt-1 rounded bg-emerald-50 px-2 py-1 text-xs text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
              Agreed scope: {agreed.join(" · ")}
            </p>
          )}
          <div className="mt-3">
            {stage === "clarify" && (
              <>
                <textarea
                  value={questions}
                  onChange={(e) => setQuestions(e.target.value)}
                  placeholder={"Who are the users?\nWhat is out of scope?\nHow many concurrent users?"}
                  spellCheck={false}
                  rows={6}
                  className="w-full rounded-md border bg-white p-2 font-mono text-xs text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100"
                />
                <div className="mt-3 rounded-md border border-emerald-200 bg-emerald-50 p-3 dark:border-emerald-800 dark:bg-emerald-950">
                  <h3 className="text-sm font-semibold text-emerald-800 dark:text-emerald-200">
                    Agreed scope — pin down what the interviewer confirms
                  </h3>
                  <p className="text-xs text-emerald-700 dark:text-emerald-300">
                    Liked an answer or made a scope call? Add it here and it
                    travels with you into every later stage.
                  </p>
                  {agreed.length > 0 && (
                    <ul className="mt-2 space-y-1">
                      {agreed.map((a, i) => (
                        <li key={i} className="flex items-center justify-between gap-2 rounded bg-white px-2 py-1 text-sm dark:bg-zinc-900">
                          <span>{a}</span>
                          <button
                            className="text-xs text-red-600 hover:underline dark:text-red-400"
                            onClick={() => setAgreed(agreed.filter((_, j) => j !== i))}
                          >
                            remove
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                  <div className="mt-2 flex gap-2">
                    <input
                      value={newAgreed}
                      onChange={(e) => setNewAgreed(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && newAgreed.trim()) {
                          setAgreed([...agreed, newAgreed.trim()]);
                          setNewAgreed("");
                        }
                      }}
                      placeholder="e.g. Buses out of scope — CAR/BIKE/TRUCK only"
                      className="w-full rounded border bg-white px-2 py-1 text-sm text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100"
                    />
                    <button
                      onClick={() => {
                        if (!newAgreed.trim()) return;
                        setAgreed([...agreed, newAgreed.trim()]);
                        setNewAgreed("");
                      }}
                      className="shrink-0 rounded bg-emerald-600 px-3 py-1 text-sm font-semibold text-white hover:bg-emerald-500"
                    >
                      + Add
                    </button>
                  </div>
                </div>
              </>
            )}
            {stage === "objects" && (
              <ObjectModeler value={classes} onChange={setClasses} />
            )}
            {stage === "flow" && (
              <>
                <div className="mb-2 flex gap-2 text-xs">
                  {(["draw", "mermaid"] as const).map((m) => (
                    <button
                      key={m}
                      onClick={() => setFlowMode(m)}
                      className={`rounded border px-2 py-1 ${flowMode === m ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900" : "bg-white dark:bg-zinc-800"}`}
                    >
                      {m === "draw" ? "Whiteboard" : "Mermaid text"}
                    </button>
                  ))}
                </div>
                {flowMode === "draw" ? (
                  <Whiteboard
                    initialScene={scene}
                    seeds={classes.map((c) => ({
                      name: c.name,
                      attributes: c.attributes,
                      methods: c.methods
                    }))}
                    onChange={setScene}
                  />
                ) : (
                  <FlowEditor value={flow} onChange={setFlow} />
                )}
              </>
            )}
            {stage === "code" && (
              <>
                <div className="mb-2 flex flex-wrap items-center gap-2 text-xs">
                  <span className="text-zinc-500 dark:text-zinc-400">Add starter:</span>
                  {(["java", "python", "typescript"] as const).map((l) => (
                    <button
                      key={l}
                      onClick={() => addStarter(l)}
                      className="rounded border bg-white px-2 py-1 hover:bg-zinc-100 dark:bg-zinc-800 dark:hover:bg-zinc-700"
                    >
                      {l === "java" ? "Solution.java" : l === "python" ? "solution.py" : "solution.ts"}
                    </button>
                  ))}
                </div>
                <ProjectEditor
                  files={files}
                  folders={folders}
                  onChange={(f, d) => {
                    setFiles(f);
                    setFolders(d);
                  }}
                />
                <RunPanel files={files} />
              </>
            )}
          </div>
          <button
            onClick={submit}
            disabled={loading}
            className="mt-3 rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
          >
            {loading ? "Grading…" : `Submit ${tabLabel(stage).toLowerCase()} for feedback`}
          </button>
          {(expired || elapsed > 0) && (
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              Elapsed: {Math.floor(elapsed / 60)}m {elapsed % 60}s
              {expired ? " · overtime flagged" : ""} · Attempt persists to SQLite.
            </p>
          )}
          {feedbacks[stage] && (
            <details className="mt-3 rounded-md border border-indigo-200 bg-indigo-50 p-3 text-sm dark:border-indigo-800 dark:bg-indigo-950">
              <summary className="cursor-pointer font-semibold text-indigo-800 dark:text-indigo-200">
                Model solution — compare after submitting
              </summary>
              {stage === "clarify" && (
                <ul className="mt-2 space-y-1">
                  {problem.expectedQuestions.map((q) => (
                    <li key={q.question}>
                      <strong>{q.question}</strong>
                      <span className="text-zinc-600 dark:text-zinc-400"> — {q.why}</span>
                    </li>
                  ))}
                </ul>
              )}
              {stage === "objects" && (
                <ul className="mt-2 space-y-1">
                  {problem.referenceObjects.map((o) => (
                    <li key={o.name}>
                      <strong>{o.name}</strong>
                      <span className="text-zinc-600 dark:text-zinc-400"> — {o.responsibility}</span>
                    </li>
                  ))}
                </ul>
              )}
              {stage === "flow" && (
                <ol className="mt-2 list-decimal space-y-1 pl-5">
                  {problem.referenceFlow.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ol>
              )}
              {stage === "code" && (
                <pre className="mt-2 overflow-auto rounded bg-zinc-950 p-2 font-mono text-xs text-zinc-100">
                  {buildSkeleton(problem)}
                </pre>
              )}
            </details>
          )}
        </div>
        <div ref={feedbackRef} className="scroll-mt-24">
          <FeedbackPanel feedback={feedbacks[stage] ?? null} />
        </div>
        {feedbacks[stage] && nextStage && (
          <button
            onClick={() => selectStage(nextStage)}
            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500"
          >
            Next: {tabLabel(nextStage)} →
          </button>
        )}
      </div>
      )}

      {(coherence.entities.length > 0 ||
        coherence.unmodeledInCode.length > 0) && (
        <div className="mt-4 rounded-md border bg-white p-4 dark:bg-zinc-900">
          <h2 className="font-semibold">
            Design coherence — one system across all stages{" "}
            <span className="text-xs font-normal text-zinc-500 dark:text-zinc-400">
              (live, updates as you work)
            </span>
          </h2>
          {coherence.missingInFlow.length === 0 &&
          coherence.missingInCode.length === 0 &&
          coherence.unmodeledInCode.length === 0 ? (
            <p className="mt-1 text-sm text-green-700 dark:text-green-400">
              Every modeled class appears in your flow and your code. ✓
            </p>
          ) : (
            <ul className="mt-1 space-y-1 text-sm">
              {coherence.missingInFlow.map((e) => (
                <li key={`f-${e}`}>
                  ⚠ <strong>{e}</strong> is modeled but never appears in your flow.
                </li>
              ))}
              {coherence.missingInCode.map((e) => (
                <li key={`c-${e}`}>
                  ⚠ <strong>{e}</strong> is modeled but missing from your code.
                </li>
              ))}
              {coherence.unmodeledInCode.map((e) => (
                <li key={`u-${e}`}>
                  ⚠ <strong>{e}</strong> is coded but was never modeled in Stage 1.
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="mt-4 rounded-md border bg-white p-4 dark:bg-zinc-900">
        <h2 className="font-semibold">Interviewer twists — requirements changed, adapt your design</h2>
        <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
          The follow-ups interviewers actually ask next. Try each against your
          design before peeking at the hint.
        </p>
        <div className="mt-2 space-y-2">
          {problem.followUps.map((f, i) => (
            <details key={i} className="rounded border p-2 text-sm dark:border-zinc-700">
              <summary className="cursor-pointer font-medium">
                Twist {i + 1}: {f.prompt}
              </summary>
              <p className="mt-1 text-zinc-600 dark:text-zinc-400">
                <strong>Hint:</strong> {f.hint}
              </p>
            </details>
          ))}
        </div>
      </div>
    </div>
  );
}
