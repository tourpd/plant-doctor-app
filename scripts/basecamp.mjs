// 포토닥터 베이스캠프 — 지금 운영 중인 상태를 '돌아올 지점'으로 고정 (운영은 건드리지 않음)
// 1) 코드: git 태그 + GitHub에 올림  2) 소스 zip 백업  3) 운영 배포 주소 기록  4) 되돌리기 실행 파일 확인
import fs from "node:fs";
import { spawnSync } from "node:child_process";
const NAME = "basecamp-20261103-v3-live";
const LOG = "scripts/out/basecamp.log";
fs.mkdirSync("scripts/out", { recursive: true });
fs.writeFileSync(LOG, `시작 ${new Date().toString()}\n`);
const log = (...a) => { const s = a.join(" "); console.log(s); fs.appendFileSync(LOG, s + "\n"); };
const sh = (cmd, args, opt = {}) => { const r = spawnSync(cmd, args, { encoding: "utf8", maxBuffer: 1 << 26, ...opt }); fs.appendFileSync(LOG, `$ ${cmd} ${args.join(" ")}\n${r.stdout || ""}${r.stderr || ""}\n`); return r; };
const die = (m) => { log("❌ " + m + " (기록: scripts/out/basecamp.log)"); process.exit(1); };

const br = sh("git", ["rev-parse", "--abbrev-ref", "HEAD"]).stdout.trim();
if (br !== "upgrade-2026-11") die("브랜치가 upgrade-2026-11 이 아닙니다: " + br);
// 운영에 올라간 코드에서 바뀐 건 빌드 설정(tsconfig) 한 줄뿐 → 같이 저장
sh("git", ["add", "tsconfig.json", "scripts/basecamp.mjs", "scripts/rollback-basecamp.mjs", "*.command"]);
sh("git", ["commit", "-m", `베이스캠프 ${NAME}: 운영 반영본 고정 + 되돌리기 실행 파일`]);
const commit = sh("git", ["rev-parse", "--short", "HEAD"]).stdout.trim();

log("① 운영 중인 배포 주소 확인...");
const ls = sh("npx", ["--yes", "vercel@latest", "ls", "plant-doctor-app", "--prod"]);
const urls = ((ls.stdout || "") + (ls.stderr || "")).match(/https:\/\/plant-doctor-[a-z0-9]+-[a-z0-9-]+\.vercel\.app/g) || [];
const prodUrl = urls[0] || "";
if (!prodUrl) die("운영 배포 주소를 못 찾음");
log("   지금 운영:", prodUrl);
const prev = urls.slice(1, 4);

log("② 코드 표시(태그) 박기 + GitHub에 올리기...");
sh("git", ["tag", "-d", NAME]);
if (sh("git", ["tag", "-a", NAME, "-m", `운영 반영본 (배포 ${prodUrl})`]).status !== 0) die("태그 실패");
const p1 = sh("git", ["push", "origin", "upgrade-2026-11"]);
const p2 = sh("git", ["push", "-f", "origin", NAME]);
log(`   GitHub: ${p1.status === 0 && p2.status === 0 ? "✅ 올림" : "⚠️ 못 올림 (맥북에는 저장됨)"}`);

log("③ 소스 통째 zip 백업...");
fs.mkdirSync("_backup", { recursive: true });
const zip = `_backup/${NAME}_${commit}.zip`;
if (sh("git", ["archive", "--format=zip", "-o", zip, NAME]).status !== 0) die("zip 실패");
// 지식 데이터·키는 git에 없을 수 있어 따로 담기
const extra = `_backup/${NAME}_data_and_keys.zip`;
sh("zip", ["-qr", extra, "app/data/knowledge", ".env.local", ".vercel"]);
log(`   ${zip} (${(fs.statSync(zip).size / 1048576).toFixed(1)}MB)`);
log(`   ${extra} (${fs.existsSync(extra) ? (fs.statSync(extra).size / 1048576).toFixed(1) : 0}MB)`);

const md = `# 포토닥터 베이스캠프 ${NAME}
만든 시각: ${new Date().toString()}

## 이 지점의 상태
- 코드: 브랜치 upgrade-2026-11, 커밋 ${commit}, 태그 ${NAME} (GitHub에도 있음)
- 운영 배포: ${prodUrl}
- 내용: 새 진단(v3, 방향 70% + 다른 가능성), 근거 사례·날씨, 갤럭시 사진 수정, 판단·구별법 화면
- 그 이전 운영 배포(더 옛날로 돌아갈 때): ${prev.join(" , ") || "-"}

## 되돌리는 법 (운영 화면이 이상할 때)
맥북 터미널에서 한 줄:
    cd ~/projects/plant-doctor-app && node scripts/rollback-basecamp.mjs
→ 운영을 위 배포(${prodUrl})로 즉시 되돌림 (1분 이내, 다시 빌드 안 함)

## 코드까지 되돌리는 법
    git checkout ${NAME}
또는 zip: ${zip}

## 데이터
- 진단 기록(Firestore diagnoses)은 덮어쓰지 않고 새 칸만 추가하는 원칙 → 되돌려도 기록은 그대로
`;
fs.writeFileSync("_backup/BASECAMP.md", md);
fs.writeFileSync("scripts/out/basecamp.json", JSON.stringify({ name: NAME, commit, prodUrl, prev, at: new Date().toISOString() }, null, 2));
log("④ 되돌리기 준비 확인...");
log(fs.existsSync("scripts/rollback-basecamp.mjs") ? "   ✅ scripts/rollback-basecamp.mjs 준비됨" : "   ❌ 되돌리기 파일 없음");
log(`✅ 끝 — 베이스캠프 ${NAME} 완성 (설명서: _backup/BASECAMP.md)`);
