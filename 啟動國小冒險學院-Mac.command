#!/bin/bash
cd "$(dirname "$0")" || exit 1
/bin/bash scripts/launcher/bootstrap-mac.sh
result=$?
if [ "$result" -ne 0 ]; then
  echo '按 Enter 關閉視窗。'
  read -r _
fi
exit "$result"
