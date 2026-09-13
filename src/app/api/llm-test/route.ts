import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isValidModel, providerById } from "@/lib/providers";

const Body = z.object({
  provider: z.string().max(50),
  key: z.string().min(1).max(500),
  model: z.string().max(100)
});

const HINTS: [number, string][] = [
  [401, "Key rejected — copy it fresh from the provider dashboard (no extra spaces)."],
  [403, "Key valid but blocked — enable the model API or check key restrictions."],
  [404, "Model id not found — pick one from the dropdown instead of typing it."],
  [429, "Quota/billing hit — check usage limits or add billing."]
];

/**
 * POST /api/llm-test { provider, key, model } → { ok, detail? }.
 * Dry-runs the key against the provider's model list so a bad key or dead
 * model id surfaces HERE with a plain reason — not as a silent static
 * fallback after grading. The key is used once and never stored or logged.
 */
export async function POST(req: NextRequest) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json({ ok: false, detail: "Invalid request." });
  const { provider: providerId, key, model } = parsed.data;
  const provider = providerById(providerId);
  if (!provider || !isValidModel(model))
    return NextResponse.json({ ok: false, detail: "Unknown provider or model." });

  try {
    const res = await fetch(`${provider.baseUrl}/models`, {
      headers: { Authorization: `Bearer ${key.trim()}` },
      signal: AbortSignal.timeout(15000)
    });
    if (!res.ok) {
      const hint =
        HINTS.find(([code]) => code === res.status)?.[1] ??
        `Provider answered ${res.status} — retry, or try another model.`;
      return NextResponse.json({ ok: false, detail: hint });
    }
    return NextResponse.json({ ok: true, detail: `${provider.label} key works.` });
  } catch {
    return NextResponse.json({
      ok: false,
      detail: "Could not reach the provider — check your connection and retry."
    });
  }
}
