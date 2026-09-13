import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { checkLimit, clientIp, rateLimited } from "@/lib/ratelimit";
import {
  SESSION_COOKIE,
  authenticate,
  createSession,
  createUser,
  deleteSession,
  expiredSessionCookie,
  getUserByToken,
  sessionCookie,
  type PublicUser
} from "@/lib/auth";

const Credentials = z.object({
  email: z.string().max(200),
  password: z.string().max(200),
  name: z.string().max(100).optional()
});

type Ctx = { params: Promise<{ action: string }> };

/** GET /api/auth/me → current user or null (guest). */
export async function GET(req: NextRequest, { params }: Ctx) {
  const { action } = await params;
  if (action !== "me")
    return NextResponse.json({ error: "Unknown action." }, { status: 404 });
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  return NextResponse.json({ user: token ? await getUserByToken(token) : null });
}

/** POST /api/auth/login | /signup | /logout */
export async function POST(req: NextRequest, { params }: Ctx) {
  const { action } = await params;

  if (action === "logout") {
    const token = req.cookies.get(SESSION_COOKIE)?.value;
    if (token) await deleteSession(token);
    const res = NextResponse.json({ ok: true });
    res.headers.set("Set-Cookie", expiredSessionCookie());
    return res;
  }

  if (action !== "login" && action !== "signup")
    return NextResponse.json({ error: "Unknown action." }, { status: 404 });

  // Brute-force throttle on credential endpoints (logout stays cheap).
  const limit = checkLimit(`auth:${clientIp(req)}`, 10, 10 * 60 * 1000);
  if (!limit.ok) return rateLimited(limit.retryAfterSec);

  const parsed = Credentials.safeParse(await req.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });

  const { email, password, name } = parsed.data;
  const result: { user: PublicUser } | { error: string } =
    action === "signup"
      ? await createUser(name ?? "", email, password)
      : await authenticate(email, password);
  if ("error" in result)
    return NextResponse.json(
      { error: result.error },
      { status: action === "login" ? 401 : 400 }
    );

  const res = NextResponse.json({ user: result.user });
  res.headers.set("Set-Cookie", sessionCookie(await createSession(result.user.id)));
  return res;
}
