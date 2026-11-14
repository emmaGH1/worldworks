#!/usr/bin/env bash
# Rebuild optimized brand assets from the supplied OpenAI-generated artwork.
set -euo pipefail
art=${1:-/opt/ww-video/trailer2/art}
out=$(cd "$(dirname "$0")/../public/brand" && pwd)
ffmpeg -v error -y -i "$art/keyart.png" -vf scale=1920:-1 -c:v libwebp -quality 82 "$out/keyart.webp"
ffmpeg -v error -y -i "$art/keyart.png" -vf scale=960:-1 -c:v libwebp -quality 82 "$out/keyart-mobile.webp"
ffmpeg -v error -y -i "$art/logo.png" -vf 'crop=2172:440:0:145,scale=900:-1' -c:v libwebp -quality 90 "$out/logo.webp"
ffmpeg -v error -y -i "$out/logo.webp" -vf 'crop=745:182:155:0' -c:v libwebp -quality 90 "$out/wordmark.webp"
for size in 256 64 180; do
 ffmpeg -v error -y -i "$art/logo-mark.png" -vf "scale=$size:$size" -frames:v 1 "$out/mark-$size.png"
done
ffmpeg -v error -y -i "$art/keyart.png" -i "$out/logo.webp" -filter_complex '[0:v]scale=1200:675,crop=1200:630:0:22[bg];[1:v]scale=470:-1[logo];[bg][logo]overlay=26:60' -frames:v 1 -update 1 "$out/social.png"
