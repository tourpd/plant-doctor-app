#!/bin/zsh
cd "$(dirname "$0")"
[ -s "$HOME/.nvm/nvm.sh" ] && . "$HOME/.nvm/nvm.sh"
export PATH="$HOME/.homebrew/bin:/opt/homebrew/bin:/usr/local/bin:$HOME/.npm-global/bin:$PATH"
echo "포토닥터 갤럭시 사진 시험 (배포 없음, 운영 앱은 건드리지 않음)"
echo "① 사진 변환 부품 설치 중..."
npm install --no-audit --no-fund 2>&1 | tail -3
node scripts/image-format-test.mjs
echo; echo "창을 닫아도 됩니다."
