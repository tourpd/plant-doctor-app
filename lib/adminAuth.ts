// lib/adminAuth.ts — 관리자 전용 잠금 (대표님만)
// - Vercel 환경변수 ADMIN_KEY 와 같은 열쇠를 가진 요청만 통과
// - ADMIN_KEY 가 설정 안 돼 있으면 아무도 못 봄 (열린 채로 두지 않음)
import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";

export function isAdmin(req: Request): boolean {
  const expected = process.env.ADMIN_KEY || "";
  if (expected.length < 16) return false;
  const given = req.headers.get("x-admin-key") || "";
  const a = Buffer.from(given), b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function adminDenied() {
  return NextResponse.json(
    { ok: false, error: "관리자 전용입니다." },
    { status: 401, headers: { "Cache-Control": "no-store" } }
  );
}
