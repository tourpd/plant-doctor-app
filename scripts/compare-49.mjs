// 포토닥터 시험지 49건 — 고치기 전(운영 기록) vs 고친 후(미리보기 주소) 비교
// 사용법(맥 터미널, 이 폴더에서):
//   PREVIEW_URL=https://<미리보기주소>.vercel.app node scripts/compare-49.mjs
//   (미리보기에 Vercel 보호가 켜져 있으면 VERCEL_BYPASS=<우회 토큰> 도 함께)
// - 운영 Firestore 는 "읽기만" 함. 미리보기 호출은 device_id=claude-system-check 라서 저장되지 않음.
import fs from "node:fs";
import path from "node:path";
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const PREVIEW = (process.env.PREVIEW_URL || "").replace(/\/$/, "");
if (!PREVIEW) { console.error("PREVIEW_URL 이 필요합니다."); process.exit(1); }
if (/^https:\/\/plant-doctor-app\.vercel\.app$/.test(PREVIEW)) { console.error("운영 주소입니다. 미리보기 주소를 넣으세요."); process.exit(1); }

// .env.local 읽기
for (const line of fs.readFileSync(".env.local", "utf8").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"(.*)"$/s, "$1");
}
initializeApp({ credential: cert({
  projectId: process.env.FIREBASE_PROJECT_ID,
  clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
}) });
const db = getFirestore();

// 시험지 범위: 2026-09-11 ~ 2026-10-28 (한국시간), 시험 기기 제외
const from = new Date("2026-09-11T00:00:00+09:00"), to = new Date("2026-10-29T00:00:00+09:00");
const snap = await db.collection("diagnoses").where("createdAt", ">=", from).where("createdAt", "<", to).orderBy("createdAt").get();
const rows = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(r => r.device_id !== "claude-system-check" && r.imageUrl);
console.log(`시험지 대상 ${rows.length}건 (예상 49건)`);

const isDeficit = s => /결핍|영양\s*(부족|불균형)/.test(s || "");
const out = [];
let i = 0;
for (const r of rows) {
  i++;
  const before = r.result || {};
  let after = {}, err = "";
  try {
    const img = await fetch(r.imageUrl);
    if (!img.ok) throw new Error("사진 다운로드 실패 " + img.status);
    const type = img.headers.get("content-type") || "image/jpeg";
    const fd = new FormData();
    fd.append("image", new Blob([await img.arrayBuffer()], { type }), "photo." + (type.split("/")[1] || "jpg"));
    fd.append("crop", r.crop || ""); fd.append("province", r.province || ""); fd.append("city", r.city || "");
    fd.append("device_id", "claude-system-check");
    const at = r.createdAt?.toDate?.() || new Date(r.createdAt);
    fd.append("observed_at", at.toISOString());
    const headers = process.env.VERCEL_BYPASS ? { "x-vercel-protection-bypass": process.env.VERCEL_BYPASS } : {};
    const res = await fetch(PREVIEW + "/api/vision", { method: "POST", body: fd, headers });
    after = await res.json();
    if (!res.ok || after.ok === false && after.error) throw new Error(after.error || res.status);
    if (!after.test_mode) throw new Error("test_mode 아님 — 저장됐을 수 있음! 중단");
  } catch (e) { err = String(e.message || e); if (err.includes("중단")) { console.error(err); process.exit(2); } }
  const fmt = c => (c || []).map(x => `${x.name} ${x.probability}%`).join(" / ");
  out.push({
    no: i, date: (r.createdAt?.toDate?.() || new Date(r.createdAt)).toISOString().slice(0, 16).replace("T", " "),
    crop: r.crop, region: r.region, photo: r.imageUrl,
    before: before.final_judgement || "", before_causes: fmt(before.possible_causes),
    after: after.final_judgement || "", after_causes: fmt(after.possible_causes),
    after_guess: after.ai_top_guess || "", type: after.judgement_type || "", confidence: after.confidence ?? "",
    first_pass: after.first_pass || "", weather: after.evidence?.weather || "",
    cases: (after.evidence?.cases || []).map((c) => `${c.crop}:${c.category}/${c.pest}`).join(" | "), case_images: after.evidence?.case_images ?? "",
    status: after.status || "", questions: (after.ask_questions || []).join(" / "), photo_request: after.photo_request || "", error: err,
  });
  console.log(`${i}/${rows.length} ${r.crop}: ${before.final_judgement} → ${after.final_judgement || "(오류) " + err}`);
}

// 요약
const n = out.length, ok = out.filter(o => !o.error);
const sum = {
  "대상": n, "오류": n - ok.length,
  "결핍 판정(전)": out.filter(o => isDeficit(o.before)).length,
  "결핍 판정(후)": ok.filter(o => isDeficit(o.after)).length,
  "확정(후)": ok.filter(o => o.status === "confident").length,
  "추정(후)": ok.filter(o => o.status === "likely").length,
  "전문가 확인 필요(후)": ok.filter(o => o.status === "uncertain").length,
  "추정 1순위가 결핍(후)": ok.filter(o => isDeficit(o.after_guess)).length,
  "사진 다시 요청(후)": ok.filter(o => o.status === "needs_more_photos").length,
  "판정 바뀜": ok.filter(o => o.before !== o.after).length,
};
fs.mkdirSync("scripts/out", { recursive: true });
const stamp = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, "");
const csvEsc = v => `"${String(v ?? "").replace(/"/g, '""')}"`;
const cols = Object.keys(out[0] || {});
fs.writeFileSync(`scripts/out/compare_49_${stamp}.csv`, "﻿" + [cols.join(","), ...out.map(o => cols.map(c => csvEsc(o[c])).join(","))].join("\n"));
fs.writeFileSync(`scripts/out/compare_49_${stamp}.json`, JSON.stringify({ summary: sum, rows: out }, null, 2));
console.log("\n요약", sum, `\n저장: scripts/out/compare_49_${stamp}.csv / .json`);
process.exit(0);
