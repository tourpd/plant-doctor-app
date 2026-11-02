// 포토닥터 운영 긴급수정: 지금 운영본(main)에 '갤럭시 사진 인식' 수정만 얹어 시험 → 운영 배포 → 운영에서 재확인
// 진단 v3 개선(시험 중)은 포함하지 않음. 문제 시 되돌리기: Vercel 이전 배포를 Promote
import fs from "node:fs";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
const ROOT = process.cwd();
const WT = path.resolve(ROOT, "../plant-doctor-hotfix");
const LOG = path.join(ROOT, "scripts/out/hotfix_deploy.log");
fs.mkdirSync(path.dirname(LOG), { recursive: true });
fs.writeFileSync(LOG, `시작 ${new Date().toString()}\n`);
const log = (...a) => { const s = a.join(" "); console.log(s); fs.appendFileSync(LOG, s + "\n"); };
const sh = (cmd, args, opt = {}) => { const r = spawnSync(cmd, args, { encoding: "utf8", maxBuffer: 1 << 26, ...opt }); fs.appendFileSync(LOG, `$ ${cmd} ${args.join(" ")}\n${r.stdout || ""}${r.stderr || ""}\n`); return r; };
const die = (m) => { log("❌ " + m + "  (자세한 기록: scripts/out/hotfix_deploy.log)"); process.exit(1); };

// 1) 운영본(main) 별도 작업 폴더
log("① 운영본(main)으로 작업 폴더 준비...");
if (fs.existsSync(WT)) { sh("git", ["worktree", "remove", "--force", WT]); fs.rmSync(WT, { recursive: true, force: true }); }
sh("git", ["worktree", "prune"]);
sh("git", ["branch", "-D", "hotfix-galaxy-photo"]);
if (sh("git", ["worktree", "add", "-b", "hotfix-galaxy-photo", WT, "main"]).status !== 0) die("작업 폴더 생성 실패");

// 2) 수정 파일 얹기
const H = path.join(ROOT, "scripts/hotfix");
for (const f of ["app/api/vision/route.ts", "app/ai/page.tsx", "lib/clientImage.ts", "lib/serverImage.ts", "lib/heic-convert.d.ts", "next.config.js"]) {
  fs.mkdirSync(path.dirname(path.join(WT, f)), { recursive: true });
  fs.copyFileSync(path.join(H, f), path.join(WT, f));
}
for (const f of [".env.local", ".vercel/project.json"]) if (fs.existsSync(path.join(ROOT, f))) { fs.mkdirSync(path.dirname(path.join(WT, f)), { recursive: true }); fs.copyFileSync(path.join(ROOT, f), path.join(WT, f)); }
fs.writeFileSync(path.join(WT, ".vercelignore"), ".env.local\n.env*.local\n");
log("② 사진 변환 부품 설치...");
if (sh("npm", ["install", "--no-audit", "--no-fund"], { cwd: WT }).status !== 0) die("설치 실패");
if (sh("npm", ["install", "--no-audit", "--no-fund", "sharp@^0.34.5", "heic-convert@^2.1.0"], { cwd: WT }).status !== 0) die("부품 설치 실패");

// 3) 빌드 확인
log("③ 운영용 빌드 확인 (1~3분)...");
const b = sh("npx", ["next", "build"], { cwd: WT });
if (b.status !== 0) die("빌드 실패: " + ((b.stdout || "") + (b.stderr || "")).split("\n").filter((l) => /error|Error/.test(l)).slice(0, 5).join(" | "));

// 4) 이 맥에서 띄워 사진 4종 시험 (저장 안 함)
const D = path.join(ROOT, "scripts/out/imgtest");
const files = [["50MP JPEG", "50mp.jpg", "image/jpeg"], ["세로(EXIF 회전) JPEG", "rotated12mp.jpg", "image/jpeg"], ["HEIC(고효율 사진)", "photo.heic", "image/heic"], ["형식 표시 없는 HEIC", "photo.heic", ""]];
async function trial(base, label) {
  let pass = 0;
  for (const [n, f, type] of files) {
    const fd = new FormData();
    fd.append("image", new Blob([fs.readFileSync(path.join(D, f))], type ? { type } : {}), f);
    fd.append("crop", "고추"); fd.append("province", "충청남도"); fd.append("city", "논산시");
    fd.append("device_id", "claude-system-check");
    try {
      const r = await fetch(base + "/api/vision", { method: "POST", body: fd, signal: AbortSignal.timeout(120000) });
      const j = await r.json().catch(() => null);
      const ok = r.ok && j?.ok && j?.test_mode && (j.possible_causes || []).length > 0;
      if (ok) pass++;
      log(`  ${ok ? "✅" : "❌"} [${label}] ${n} → ${r.status} ${ok ? (j.image_note || "") : (j?.error || "응답 오류")}`);
    } catch (e) { log(`  ❌ [${label}] ${n} → ${e.message}`); }
  }
  return pass;
}
spawnSync("sh", ["-c", "lsof -ti tcp:3940 | xargs kill 2>/dev/null; sleep 1"]);
log("④ 이 맥에서 운영용으로 띄워 사진 4종 시험...");
const srv = spawn("npx", ["next", "start", "-p", "3940"], { cwd: WT, stdio: "ignore", detached: true });
const stop = () => { try { process.kill(-srv.pid); } catch {} };
process.on("exit", stop);
let up = false;
for (let i = 0; i < 60 && !up; i++) { await new Promise((r) => setTimeout(r, 1000)); try { await fetch("http://localhost:3940/ai"); up = true; } catch {} }
if (!up) die("시험 서버가 안 뜸");
const localPass = await trial("http://localhost:3940", "내 맥");
stop();
if (localPass !== files.length) die(`맥 시험 ${localPass}/4 — 운영 배포 중단`);

// 5) 운영 배포
log("⑤ 운영에 배포 중 (2~4분)...");
const d = sh("npx", ["--yes", "vercel@latest", "deploy", "--prod", "--yes"], { cwd: WT });
const url = ((d.stdout || "") + (d.stderr || "")).match(/https:\/\/[a-z0-9.-]+\.vercel\.app/g);
if (d.status !== 0) die("배포 실패");
log("   배포 완료:", url ? url[url.length - 1] : "");

// 6) 운영 주소에서 재확인
log("⑥ 운영 주소에서 사진 4종 재확인...");
await new Promise((r) => setTimeout(r, 8000));
const prodPass = await trial("https://plant-doctor-app.vercel.app", "운영");
const page = await (await fetch("https://plant-doctor-app.vercel.app/ai")).text().catch(() => "");
log(`  화면: ${page.includes("포토닥터") ? "✅ 정상 열림" : "❌ 확인 필요"}`);
log(prodPass === files.length ? "✅ 끝 — 운영 반영 완료, 4/4 인식" : `❌ 운영 ${prodPass}/4 — 확인 필요`);
// 기록 남기기
sh("git", ["add", "-A", "--", ".", ":!.env.local", ":!.vercel"], { cwd: WT });
sh("git", ["commit", "-m", "운영 긴급수정: 갤럭시 Z폴드 사진 인식 실패 해결 (휴대폰 축소·회전, 서버 HEIC 변환, 실패 안내)"], { cwd: WT });
process.exit(0);
