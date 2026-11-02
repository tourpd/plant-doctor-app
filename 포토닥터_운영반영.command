#!/bin/zsh
cd "$(dirname "$0")"
[ -s "$HOME/.nvm/nvm.sh" ] && . "$HOME/.nvm/nvm.sh"
export PATH="$HOME/.homebrew/bin:/opt/homebrew/bin:/usr/local/bin:$HOME/.npm-global/bin:$PATH"
echo "포토닥터 운영 반영 — 갤럭시 사진 인식 수정만 (진단 v3는 포함 안 함)"
node scripts/hotfix-deploy.mjs
echo; echo "창을 닫아도 됩니다."
