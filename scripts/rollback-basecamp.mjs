// 포토닥터 운영을 베이스캠프 배포로 즉시 되돌림 (다시 빌드하지 않음, 1분 이내)
import fs from "node:fs";
import { spawnSync } from "node:child_process";
if (!fs.existsSync("scripts/out/basecamp.json")) {
  console.log("⚠️ 아직 베이스캠프가 없습니다. 먼저 이 줄을 실행하세요:\n   cd ~/projects/plant-doctor-app && node scripts/basecamp.mjs");
  process.exit(1);
}
const b = JSON.parse(fs.readFileSync("scripts/out/basecamp.json", "utf8"));
console.log(`운영을 베이스캠프(${b.name})로 되돌립니다 → ${b.prodUrl}`);
const r = spawnSync("npx", ["--yes", "vercel@latest", "promote", b.prodUrl, "--yes"], { encoding: "utf8", stdio: "inherit" });
if (r.status !== 0) { console.log("❌ 되돌리기 실패 — Vercel 대시보드 → Deployments 에서 위 주소를 'Promote to Production' 하세요"); process.exit(1); }
await new Promise((s) => setTimeout(s, 5000));
const page = await (await fetch("https://plant-doctor-app.vercel.app/ai")).text().catch(() => "");
console.log(page.includes("포토닥터") ? "✅ 되돌리기 완료 — 운영 화면 정상" : "⚠️ 되돌렸지만 화면 확인 필요");
