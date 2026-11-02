// 포토닥터 새 진단(v3 + 근거사례·날씨 + 갤럭시 사진 수정) 운영 반영
// 순서: 저장 → 설치 → 빌드 → 이 맥에서 시험 → 운영 키 등록 → 운영 배포 → 운영 재확인
// 되돌리기: Vercel 대시보드 → Deployments → 이전 배포 'Promote to Production'
import fs from "node:fs";
import { spawn, spawnSync } from "node:child_process";
const LOG = "scripts/out/release_v3.log";
fs.mkdirSync("scripts/out", { recursive: true });
fs.writeFileSync(LOG, `시작 ${new Date().toString()}\n`);
const log = (...a) => { const s = a.join(" "); console.log(s); fs.appendFileSync(LOG, s + "\n"); };
const sh = (cmd, args, opt = {}) => { const r = spawnSync(cmd, args, { encoding: "utf8", maxBuffer: 1 << 26, ...opt }); fs.appendFileSync(LOG, `$ ${cmd} ${args.join(" ")}\n${r.stdout || ""}${r.stderr || ""}\n`); return r; };
const die = (m) => { log("❌ " + m + "  — 운영은 그대로입니다 (기록: scripts/out/release_v3.log)"); process.exit(1); };

const br = sh("git", ["rev-parse", "--abbrev-ref", "HEAD"]).stdout.trim();
if (br !== "upgrade-2026-11") die("브랜치가 upgrade-2026-11 이 아닙니다: " + br);
log("① 수정 내용 저장(커밋)...");
sh("git", ["add", "-A", "--", "app", "lib", "scripts/*.mjs", "scripts/hotfix", "next.config.js", "package.json", "package-lock.json", "*.command"]);
sh("git", ["commit", "-m", "포토닥터 새 진단 운영 반영 준비: 판단 방향·구별법·안전 조치 화면, 갤럭시 사진 수정, 자재 추천은 방향 뚜렷할 때만(광고 표시)"]);

log("② 부품 설치...");
if (sh("npm", ["install", "--no-audit", "--no-fund"]).status !== 0) die("설치 실패");
log("③ 운영용 빌드 (1~3분)...");
const b = sh("npx", ["next", "build"]);
if (b.status !== 0) die("빌드 실패: " + ((b.stdout || "") + (b.stderr || "")).split("\n").filter((l) => /rror/.test(l)).slice(0, 5).join(" | "));

// 시험 재료
const D = "scripts/out/imgtest";
const cases = JSON.parse(fs.readFileSync("app/data/knowledge/ncpms_cases.json", "utf8"));
const arr = Array.isArray(cases) ? cases : cases.cases;
const picks = [
  arr.find((x) => /고추/.test(x.crop) && /탄저/.test(x.pest || "") && x.images?.length),
  arr.find((x) => /배추/.test(x.crop) && /(벌레|나방|진딧물|벼룩)/.test(x.pest || "") && x.images?.length),
  arr.find((x) => /토마토/.test(x.crop) && x.images?.length),
].filter(Boolean);
const diag = [];
for (const p of picks) diag.push([`${p.crop} 사례(${p.pest})`, Buffer.from(await (await fetch(p.images[0])).arrayBuffer()), p.crop]);
const imgs = [["세로(EXIF 회전) 사진", "rotated12mp.jpg", "image/jpeg"], ["HEIC(고효율 사진)", "photo.heic", "image/heic"], ["형식 표시 없는 HEIC", "photo.heic", ""]];

async function post(base, buf, name, type, crop) {
  const fd = new FormData();
  fd.append("image", new Blob([buf], type ? { type } : {}), name);
  fd.append("crop", crop); fd.append("province", "충청남도"); fd.append("city", "논산시");
  fd.append("device_id", "claude-system-check");
  const t0 = Date.now();
  const r = await fetch(base + "/api/vision", { method: "POST", body: fd, signal: AbortSignal.timeout(90000) });
  const j = await r.json().catch(() => null);
  return { r, j, sec: Math.round((Date.now() - t0) / 1000) };
}
async function trial(base, label) {
  let fail = 0;
  for (const [n, f, type] of imgs) {
    try {
      const { r, j } = await post(base, fs.readFileSync(`${D}/${f}`), f, type, "고추");
      const ok = r.ok && j?.ok && j?.test_mode;
      if (!ok) fail++;
      log(`  ${ok ? "✅" : "❌"} [${label}] ${n} → ${r.status} ${ok ? "인식" : j?.error || "응답 오류"}`);
    } catch (e) { fail++; log(`  ❌ [${label}] ${n} → ${e.message}`); }
  }
  for (const [n, buf, crop] of diag) {
    try {
      const { r, j, sec } = await post(base, buf, "case.jpg", "image/jpeg", crop);
      const ok = r.ok && j?.ok && j?.status && j?.direction && (j.possible_causes || []).length >= 2 && sec < 58;
      if (!ok) fail++;
      const w = j?.evidence?.weather ? "날씨✓" : "날씨✗";
      const c = (j?.evidence?.cases || []).length ? "사례✓" : "사례✗";
      log(`  ${ok ? "✅" : "❌"} [${label}] ${n} → ${r.status} ${sec}초 | ${j?.final_judgement || j?.error || ""} | ${(j?.possible_causes || []).slice(0, 3).map((x) => `${x.name} ${x.probability}%`).join(" / ")} | ${w} ${c}`);
    } catch (e) { fail++; log(`  ❌ [${label}] ${n} → ${e.message}`); }
  }
  return fail;
}

spawnSync("sh", ["-c", "lsof -ti tcp:3940 | xargs kill 2>/dev/null; sleep 1"]);
log("④ 이 맥에서 운영용으로 띄워 시험 (사진 3종 + 실제 사례 진단)...");
const srv = spawn("npx", ["next", "start", "-p", "3940"], { stdio: "ignore", detached: true });
const stop = () => { try { process.kill(-srv.pid); } catch {} };
process.on("exit", stop);
let up = false;
for (let i = 0; i < 60 && !up; i++) { await new Promise((r) => setTimeout(r, 1000)); try { await fetch("http://localhost:3940/ai"); up = true; } catch {} }
if (!up) die("시험 서버가 안 뜸");
const lf = await trial("http://localhost:3940", "내 맥");
stop();
if (lf) die(`맥 시험 ${lf}건 실패 — 운영 배포 중단`);

log("⑤ 운영 서버에 키 등록 (날씨·관리자 잠금)...");
const env = Object.fromEntries(fs.readFileSync(".env.local", "utf8").split("\n").map((l) => l.match(/^([A-Z0-9_]+)=(.*)$/)).filter(Boolean).map((m) => [m[1], m[2].replace(/^["']|["']$/g, "")]));
for (const k of ["DATA_GO_KR_KEY", "ADMIN_KEY", "NCPMS_API_KEY"]) {
  if (!env[k]) { log(`  · ${k}: 이 맥에 없음 — 건너뜀`); continue; }
  sh("npx", ["--yes", "vercel@latest", "env", "rm", k, "production", "--yes"]);
  const a = sh("npx", ["--yes", "vercel@latest", "env", "add", k, "production"], { input: env[k] });
  log(`  · ${k}: ${a.status === 0 ? "등록 ✅" : "등록 실패 ❌"}`);
}

log("⑥ 운영에 배포 (2~4분)...");
const d = sh("npx", ["--yes", "vercel@latest", "deploy", "--prod", "--yes"]);
if (d.status !== 0) die("배포 실패");
log("   배포 완료");
await new Promise((r) => setTimeout(r, 8000));
log("⑦ 운영 주소에서 재확인...");
const pf = await trial("https://plant-doctor-app.vercel.app", "운영");
log(pf ? `❌ 운영 ${pf}건 확인 필요` : "✅ 끝 — 새 진단 운영 반영 완료");
sh("git", ["push", "origin", "upgrade-2026-11"]);
process.exit(0);
