import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getUserId } from "@/lib/auth";
import { getDb, nowSql } from "@/lib/db";
import { encryptKey, last4, vaultEnabled } from "@/lib/keyvault";
import { isValidModel, providerById } from "@/lib/providers";
import { checkLimit, clientIp, rateLimited } from "@/lib/ratelimit";

const Body = z.object({
  provider: z.string().max(50),
  key: z.string().min(1).max(500),
  model: z.string().max(100)
});

function limited(req: NextRequest) {
  const limit = checkLimit(`keys:${clientIp(req)}`, 10, 10 * 60 * 1000);
  return limit.ok ? null : rateLimited(limit.retryAfterSec);
}

async function authed() {
  return getUserId().catch(() => null);
}

/**
 * Vault status — write-only UX: provider/model/last4 only, never key material.
 */
export async function GET(req: NextRequest) {
  const hit = limited(req);
  if (hit) return hit;
  const userId = await authed();
  if (!userId) return NextResponse.json({ error: "Log in first" }, { status: 401 });
  if (!vaultEnabled()) return NextResponse.json({ saved: false, disabled: true });
  const db = await getDb();
  const row = (await db.get(
    "SELECT provider, model, last4 FROM user_llm_keys WHERE userId = ?",
    userId
  )) as { provider: string; model: string; last4: string } | undefined;
  return NextResponse.json(
    row ? { saved: true, ...row } : { saved: false }
  );
}

/** Save (upsert) the caller's key — encrypted at rest, never echoed back. */
export async function POST(req: NextRequest) {
  const hit = limited(req);
  if (hit) return hit;
  const userId = await authed();
  if (!userId) return NextResponse.json({ error: "Log in first" }, { status: 401 });
  if (!vaultEnabled())
    return NextResponse.json(
      { error: "Server key vault is not configured" },
      { status: 503 }
    );
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  const { provider: providerId, key, model } = parsed.data;
  const provider = providerById(providerId);
  if (!provider || !isValidModel(model))
    return NextResponse.json({ error: "Unknown provider or model" }, { status: 400 });
  const cipher = encryptKey(key.trim(), userId, provider.id);
  const masked = last4(key);
  const db = await getDb();
  const now = nowSql();
  await db.run(
    `INSERT INTO user_llm_keys (userId, provider, model, cipher, last4, updatedAt) VALUES (?, ?, ?, ?, ?, ${now}) ON CONFLICT (userId) DO UPDATE SET provider = excluded.provider, model = excluded.model, cipher = excluded.cipher, last4 = excluded.last4, updatedAt = ${now}`,
    userId,
    provider.id,
    model.trim(),
    cipher,
    masked
  );
  return NextResponse.json({
    saved: true,
    provider: provider.id,
    model: model.trim(),
    last4: masked
  });
}

/** Revoke — immediate; in-flight requests are the only traffic that survives. */
export async function DELETE(req: NextRequest) {
  const hit = limited(req);
  if (hit) return hit;
  const userId = await authed();
  if (!userId) return NextResponse.json({ error: "Log in first" }, { status: 401 });
  const db = await getDb();
  await db.run("DELETE FROM user_llm_keys WHERE userId = ?", userId);
  return NextResponse.json({ saved: false });
}
