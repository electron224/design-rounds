"use client";
import { useEffect, useState } from "react";
import {
  LLM_PROVIDERS,
  isValidModel,
  providerById,
  type LlmProvider
} from "@/lib/providers";

export interface AiConfig {
  provider: string;
  key: string;
  model: string;
}

const STORAGE_KEY = "lld_ai_config";

/** Candidate's own key, if set. Lives only in this browser. */
export function loadAiConfig(): AiConfig | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<AiConfig>;
    if (
      typeof parsed.key !== "string" ||
      !parsed.key.trim() ||
      !providerById(parsed.provider ?? "") ||
      !isValidModel(parsed.model ?? "")
    )
      return null;
    return {
      provider: parsed.provider!,
      key: parsed.key.trim(),
      model: parsed.model!.trim()
    };
  } catch {
    return null;
  }
}

function saveAiConfig(cfg: AiConfig | null) {
  try {
    if (cfg) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
    else window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* private mode */
  }
}

interface VaultInfo {
  provider: string;
  model: string;
  last4: string;
}

/** Bring-your-own-key for hosted deploys: provider + model + key. */
export default function AiSettings({ onChange }: { onChange?: () => void }) {
  const [open, setOpen] = useState(false);
  const [saved, setSaved] = useState<AiConfig | null>(() => loadAiConfig());
  // Server vault (logged-in accounts): null = guest/unknown, info = saved.
  const [vaultAccount, setVaultAccount] = useState(false);
  const [vault, setVault] = useState<VaultInfo | null>(null);
  const [providerId, setProviderId] = useState(
    saved?.provider ?? LLM_PROVIDERS[1].id
  );
  const [model, setModel] = useState(saved?.model ?? "");
  const [custom, setCustom] = useState(false);
  const [key, setKey] = useState("");
  const [error, setError] = useState("");
  const [testing, setTesting] = useState(false);
  const [testMsg, setTestMsg] = useState<{ ok: boolean; detail: string } | null>(null);

  const provider: LlmProvider =
    providerById(providerId) ?? LLM_PROVIDERS[1];
  const effectiveModel = custom ? model.trim() : model || provider.defaultModel;

  // Logged-in accounts keep the key encrypted on the server (write-only) —
  // the browser then sends nothing per grading request. Guests keep the
  // localStorage flow. Runs once; failures mean guest mode.
  useEffect(() => {
    let live = true;
    fetch("/api/keys")
      .then((r) => (r.ok ? r.json() : null))
      .then((s) => {
        if (!live || !s || s.disabled) return;
        setVaultAccount(true);
        if (s.saved)
          setVault({ provider: s.provider, model: s.model, last4: s.last4 });
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);

  const save = async () => {
    if (!key.trim()) {
      setError("Paste an API key first.");
      return;
    }
    if (!isValidModel(effectiveModel)) {
      setError("Pick a model from the list or type a valid model id.");
      return;
    }
    if (vaultAccount) {
      try {
        const res = await fetch("/api/keys", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            provider: provider.id,
            key: key.trim(),
            model: effectiveModel
          })
        });
        const data = await res.json().catch(() => null);
        if (!res.ok || !data?.saved) {
          setError(data?.error ?? "Could not save to the server vault.");
          return;
        }
        setVault({
          provider: data.provider,
          model: data.model,
          last4: data.last4
        });
        // Single source of truth — a stale browser copy would shadow the vault.
        saveAiConfig(null);
        setSaved(null);
      } catch {
        setError("Could not reach this app's server.");
        return;
      }
    } else {
      const cfg = { provider: provider.id, key: key.trim(), model: effectiveModel };
      saveAiConfig(cfg);
      setSaved(cfg);
    }
    setKey("");
    setError("");
    setOpen(false);
    onChange?.();
  };

  const clear = async () => {
    if (vault) {
      try {
        await fetch("/api/keys", { method: "DELETE" });
      } catch {
        /* row stays — status refetch on next mount shows it */
      }
      setVault(null);
    }
    saveAiConfig(null);
    setSaved(null);
    setKey("");
    setModel("");
    setError("");
    onChange?.();
  };

  const switchProvider = (id: string) => {
    setProviderId(id);
    setModel("");
    setCustom(false);
    setError("");
    setTestMsg(null);
  };

  const runTest = async () => {
    const testKey = key.trim() || loadAiConfig()?.key || "";
    if (!testKey) {
      setTestMsg({ ok: false, detail: "Paste a key first (or save one)." });
      return;
    }
    if (!isValidModel(effectiveModel)) {
      setTestMsg({ ok: false, detail: "Pick a model from the list first." });
      return;
    }
    setTesting(true);
    setTestMsg(null);
    try {
      const res = await fetch("/api/llm-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: provider.id, key: testKey, model: effectiveModel })
      });
      setTestMsg(await res.json());
    } catch {
      setTestMsg({ ok: false, detail: "Could not reach this app's server." });
    } finally {
      setTesting(false);
    }
  };

  const badge = vault ?? saved;
  const badgeLabel = vault
    ? `${providerById(vault.provider)?.label} · ${vault.model} · server ${vault.last4}`
    : saved
      ? `${providerById(saved.provider)?.label} ${saved.model}`
      : null;

  return (
    <div className="flex items-center gap-2 text-xs">
      <span
        // Text depends on the browser-stored key: server and first client
        // paint may legitimately differ here.
        suppressHydrationWarning
        className={`rounded-full px-2 py-0.5 ${badge ? "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300" : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"}`}
        title={
          badge
            ? `AI reviews via ${badgeLabel}`
            : "Built-in static rubric — add your own key for AI reviews"
        }
      >
        {badge ? `AI: ${badgeLabel}` : "AI: static rubric"}
      </span>
      <button
        suppressHydrationWarning
        onClick={() => setOpen((o) => !o)}
        className="rounded border bg-white px-2 py-0.5 hover:bg-zinc-100 dark:bg-zinc-900 dark:hover:bg-zinc-800"
      >
        {open ? "Hide" : badge ? "Change key" : "Use my key"}
      </button>
      {open && (
        <span className="flex flex-wrap items-center gap-2 rounded-md border bg-white p-2 dark:bg-zinc-900">
          <select
            value={provider.id}
            onChange={(e) => switchProvider(e.target.value)}
            title="Provider"
            className="rounded border bg-white px-1 py-1 dark:bg-zinc-800"
          >
            {LLM_PROVIDERS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
          {!custom ? (
            <select
              value={model || provider.defaultModel}
              onChange={(e) =>
                e.target.value === "__custom__"
                  ? setCustom(true)
                  : setModel(e.target.value)
              }
              title="Model"
              className="max-w-56 rounded border bg-white px-1 py-1 dark:bg-zinc-800"
            >
              {provider.models.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
              <option value="__custom__">Custom id…</option>
            </select>
          ) : (
            <input
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder="model id"
              className="w-44 rounded border bg-white px-1 py-1 font-mono dark:bg-zinc-800"
            />
          )}
          <input
            type="password"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder={`${provider.keyHint} — re-enter to change`}
            title="API key: stored only in this browser, sent with each grading request"
            className="w-52 rounded border bg-white px-2 py-1 font-mono dark:bg-zinc-800"
          />
          <button
            onClick={() => void save()}
            className="rounded bg-indigo-600 px-2 py-1 font-semibold text-white hover:bg-indigo-500"
          >
            Save{vaultAccount ? " to server" : ""}
          </button>
          <button
            onClick={runTest}
            disabled={testing}
            title="Check the key + model against the provider right now"
            className="rounded border px-2 py-1 hover:bg-zinc-100 disabled:opacity-50 dark:hover:bg-zinc-800"
          >
            {testing ? "Testing…" : "Test"}
          </button>
          {badge && (
            <button
              onClick={() => void clear()}
              className="rounded border px-2 py-1 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            >
              Remove
            </button>
          )}
          <a
            href={provider.keyUrl}
            target="_blank"
            rel="noreferrer"
            className="text-indigo-600 underline dark:text-indigo-400"
          >
            Get a key
          </a>
          {error && <span className="text-red-600 dark:text-red-400">{error}</span>}
          {testMsg && (
            <span className={testMsg.ok ? "text-green-700 dark:text-green-400" : "text-red-600 dark:text-red-400"}>
              {testMsg.ok ? "✓ " : "✗ "}{testMsg.detail}
            </span>
          )}
          <span className="w-full text-[11px] text-zinc-500 dark:text-zinc-400">
            {vaultAccount
              ? "Key is encrypted on this server — the browser sends nothing per review. Remove revokes it instantly."
              : "Key stays in this browser only — sent with each grading request over HTTPS, never stored server-side. Clear it on shared machines."}
          </span>
        </span>
      )}
    </div>
  );
}
