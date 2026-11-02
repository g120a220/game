#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/../.."
fail() { echo; echo "啟動失敗：$1"; echo '請保留此視窗中的錯誤訊息。'; exit 1; }
if command -v node >/dev/null 2>&1 && command -v npm >/dev/null 2>&1 && node -e 'process.exit(Number(process.versions.node.split(".")[0])>=24?0:1)' 2>/dev/null; then
  exec node scripts/launcher/launch.mjs
fi
case "$(uname -m)" in arm64) arch=arm64;; x86_64) arch=x64;; *) fail '目前只支援 Apple Silicon 或 Intel Mac。';; esac
# These filenames and SHA-256 digests were verified against nodejs.org official SHASUMS256.txt.
case "$arch" in
  arm64) file='node-v24.22.2-darwin-arm64.tar.gz'; expected='aa9549349e47dffaa42dcf95d6e06ade8c4bdafc980979883b88767670df385a';;
  x64) file='node-v24.22.2-darwin-x64.tar.gz'; expected='d5e336d588c45be0c37dbd52cc29895593009ca4997a77a1fd02815131ed0e52';;
esac
runtime="$PWD/.runtime/${file%.tar.gz}"
if [ ! -x "$runtime/bin/node" ]; then
  echo '正在準備 Node.js，第一次啟動需要連網，請稍候…'
  mkdir -p .runtime
  tempdir="$(mktemp -d "$PWD/.runtime/download.XXXXXX")"
  trap 'rm -rf "$tempdir"' EXIT
  curl --fail --location --show-error --connect-timeout 20 --retry 2 "https://nodejs.org/dist/v24.22.2/$file" -o "$tempdir/$file"
  actual="$(shasum -a 256 "$tempdir/$file" | awk '{print $1}')"
  [ "$actual" = "$expected" ] || fail 'Node.js 校驗不符，已停止安裝。請重新下載或檢查網路。'
  tar -xzf "$tempdir/$file" -C "$tempdir"
  [ ! -e "$runtime" ] || fail "執行環境資料夾不完整，請刪除專案內的 .runtime 後重試。"
  mv "$tempdir/${file%.tar.gz}" "$runtime"
  rm -rf "$tempdir"
  trap - EXIT
fi
export PATH="$runtime/bin:$PATH"
exec "$runtime/bin/node" scripts/launcher/launch.mjs
