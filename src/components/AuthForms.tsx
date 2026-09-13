"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import Link from "next/link";
import type { PublicUser } from "@/lib/auth";

/** Email + password login/signup. Guests skip everything below. */
export default function AuthForms() {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  const submit = async () => {
    setError("");
    setBusy(true);
    try {
      const res = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password })
      });
      const data: { user?: PublicUser; error?: string } = await res.json();
      if (!res.ok || !data.user) {
        setError(data.error ?? "Something went wrong.");
        return;
      }
      router.push("/problems");
      router.refresh();
    } catch {
      setError("Could not reach the server.");
    } finally {
      setBusy(false);
    }
  };

  const inputCls =
    "w-full rounded-md border bg-white px-3 py-1.5 text-sm text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100";

  return (
    <div className="space-y-3">
      <div className="flex gap-2 text-sm">
        {(["login", "signup"] as const).map((m) => (
          <button
            key={m}
            onClick={() => {
              setMode(m);
              setError("");
            }}
            className={`rounded-md px-3 py-1.5 font-semibold ${mode === m ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900" : "border hover:bg-zinc-100 dark:hover:bg-zinc-800"}`}
          >
            {m === "login" ? "Log in" : "Create account"}
          </button>
        ))}
      </div>
      {mode === "signup" && (
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your name"
          autoComplete="name"
          className={inputCls}
        />
      )}
      <input
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Email"
        type="email"
        autoComplete="email"
        className={inputCls}
      />
      <input
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && submit()}
        placeholder="Password (8+ characters)"
        type="password"
        autoComplete={mode === "login" ? "current-password" : "new-password"}
        className={inputCls}
      />
      {error && (
        <p className="rounded bg-red-50 p-2 text-xs text-red-700 dark:bg-red-950 dark:text-red-300">
          {error}
        </p>
      )}
      <button
        onClick={submit}
        disabled={busy}
        className="w-full rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
      >
        {busy
          ? "Please wait…"
          : mode === "login"
            ? "Log in"
            : "Create account"}
      </button>
      <Link
        href="/problems"
        className="block w-full rounded-md border border-zinc-300 px-4 py-2 text-center text-sm hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
      >
        Continue as guest — no account needed
      </Link>
    </div>
  );
}
