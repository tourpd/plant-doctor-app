#!/bin/zsh
cd "$(dirname "$0")"
[ -s "$HOME/.nvm/nvm.sh" ] && . "$HOME/.nvm/nvm.sh"
export PATH="$HOME/.homebrew/bin:/opt/homebrew/bin:/usr/local/bin:$HOME/.npm-global/bin:$PATH"
echo "포토닥터 근거 학습 (운영 앱은 건드리지 않음)"
echo "① 열쇠 입력 (입력 내용은 화면에 * 로만 보입니다)"
node scripts/set-keys.mjs || exit 1
echo; echo "② 기상청 관측소 확인"
node scripts/verify-stations.mjs
echo; echo "③ 농진청 전문가 상담 사례 수집 + 색인 (20~40분)"
node scripts/build-ncpms-cases.mjs || { echo "❌ 사례 수집 실패"; exit 1; }
echo; echo "④ 시험지 50건 재시험 (15~20분)"
node scripts/local-retest.mjs
echo; echo "끝. 창을 닫아도 됩니다."
