#!/usr/bin/env bash
# Run once after: brew install gh && gh auth login
set -euo pipefail
gh repo edit hktrippyart/AngeLifeline \
  --description "Crisis overlay for chat apps: EMS and helplines when messages look like an emergency. Privacy-first routing (MIT)." \
  --add-topic crisis-overlay \
  --add-topic harm-reduction \
  --add-topic emergency-chat
echo "Done. Open https://github.com/hktrippyart/AngeLifeline and click Star if you want a visible star count."
