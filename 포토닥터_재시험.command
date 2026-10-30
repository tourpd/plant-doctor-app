#!/bin/zsh
cd "$(dirname "$0")"
[ -s "$HOME/.nvm/nvm.sh" ] && . "$HOME/.nvm/nvm.sh"
export PATH="$HOME/.homebrew/bin:/opt/homebrew/bin:/usr/local/bin:$HOME/.npm-global/bin:$PATH"
echo "포토닥터 재시험 (배포 없음, 운영 앱은 건드리지 않음)"
node scripts/local-retest.mjs
echo; echo "창을 닫아도 됩니다."
