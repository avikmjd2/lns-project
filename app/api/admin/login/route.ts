import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { ADMIN_COOKIE, createAdminToken } from "@/lib/auth";

export async function POST(req: Request) {
  const b = await req.json().catch(() => null);
  const given = Buffer.from(String(b?.password ?? ""));
  const real = Buffer.from(process.env.ADMIN_PASSWORD ?? "");
  const ok = real.length > 0 && given.length === real.length && timingSafeEqual(given, real);
  if (!ok) return NextResponse.json({ error: "Wrong password" }, { status: 401 });
  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_COOKIE, await createAdminToken(), {
    httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 7,
  });
  return res;
}
