// 포토닥터 v2 — 미리보기 배포 + 잠금 확인 + 시험지 49건 비교 (운영 배포 아님)
import fs from "node:fs";
import { spawnSync, spawn } from "node:child_process";

fs.mkdirSync("scripts/out", { recursive: true });
const LOG = "scripts/out/preview_run.log";
fs.writeFileSync(LOG, `시작 ${new Date().toString()}\n`);
const log = (...a) => { const s = a.join(" "); console.log(s); fs.appendFileSync(LOG, s + "\n"); };
const fail = (m) => { log("❌ " + m); process.exit(1); };

const br = spawnSync("git", ["rev-parse", "--abbrev-ref", "HEAD"], { encoding: "utf8" }).stdout.trim();
if (br !== "upgrade-2026-11") fail("브랜치가 upgrade-2026-11 이 아닙니다: " + br);

const env = {};
for (const line of fs.readFileSync(".env.local", "utf8").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
  if (m) env[m[1]] = m[2].replace(/^"(.*)"$/s, "$1");
}
if (!env.ADMIN_KEY) fail("ADMIN_KEY 없음");

// 1) 미리보기 배포 (--prod 없음 = 운영 아님). 환경값은 이번 미리보기에만 넣음(설정 변경 없음)
log("① Vercel 미리보기 배포 중... (2~4분)");
const args = ["-y", "vercel@latest", "deploy", "--yes"];
for (const [k, v] of Object.entries(env)) { args.push("-e", `${k}=${v}`, "-b", `${k}=${v}`); }
const r = spawnSync("npx", args, { encoding: "utf8", stdio: ["inherit", "pipe", "inherit"], maxBuffer: 1 << 26 });
fs.appendFileSync(LOG, r.stdout || "");
const url = ((r.stdout || "").match(/https:\/\/[a-z0-9.-]+\.vercel\.app/gi) || []).pop();
if (r.status !== 0 || !url) fail("배포 실패 (위 메시지 확인)");
if (/^https:\/\/plant-doctor-app\.vercel\.app$/.test(url)) fail("운영 주소가 나왔습니다. 중단");
log("✅ 미리보기 주소: " + url);

// 2) 잠금 확인
let target = url;
const probe = await fetch(url + "/api/admin/diagnoses");
const ptxt = await probe.text();
if (probe.status === 401 && ptxt.includes("관리자 전용")) {
  const ok = await fetch(url + "/api/admin/diagnoses", { headers: { "x-admin-key": env.ADMIN_KEY } });
  log(`② 잠금 확인: 열쇠 없이 → 401 차단 ✅ / 열쇠 넣고 → ${ok.status} ${ok.status === 200 ? "✅" : "⚠️"}`);
  const inc = await fetch(url + "/api/incidents");
  log(`   사고목록 열쇠 없이 → ${inc.status} ${inc.status === 401 ? "✅" : "⚠️"}`);
} else {
  log(`② 미리보기가 Vercel 로그인으로 보호돼 있음(${probe.status}). 같은 코드를 이 맥에서 띄워 시험합니다.`);
  const dev = spawn("npx", ["next", "dev", "-p", "3939"], { stdio: "ignore", detached: true });
  process.on("exit", () => { try { process.kill(-dev.pid); } catch {} });
  target = "http://localhost:3939";
  let up = false;
  for (let i = 0; i < 90 && !up; i++) { await new Promise((s) => setTimeout(s, 2000)); try { await fetch(target); up = true; } catch {} }
  if (!up) fail("로컬 서버가 안 뜸");
  const a = await fetch(target + "/api/admin/diagnoses"), b = await fetch(target + "/api/admin/diagnoses", { headers: { "x-admin-key": env.ADMIN_KEY } });
  log(`   잠금 확인(로컬): 열쇠 없이 → ${a.status} ${a.status === 401 ? "✅" : "⚠️"} / 열쇠 넣고 → ${b.status}`);
}
fs.writeFileSync("scripts/out/preview_url.txt", url + "\n");

// 3) 49건 비교
log("③ 시험지 49건 비교 시작 (10~15분)");
const c = spawnSync("node", ["scripts/compare-49.mjs"], { encoding: "utf8", env: { ...process.env, PREVIEW_URL: target }, stdio: ["inherit", "pipe", "inherit"], maxBuffer: 1 << 26 });
log(c.stdout || "");
log(c.status === 0 ? "✅ 끝. 결과는 scripts/out 폴더" : "❌ 비교 실패");
process.exit(c.status ?? 1);
