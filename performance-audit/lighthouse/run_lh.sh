#!/usr/bin/env bash
# Runner Lighthouse : 3 passes x {mobile,desktop} pour chaque route.
# Usage: run_lh.sh <outdir> <base_url>
OUT="$1"; BASE="$2"
export CHROME_PATH="/c/Program Files/Google/Chrome/Application/chrome.exe"
PID="9a8f89dd-430d-4e17-845c-fc9fbc3c9509"
declare -A ROUTES=( [home]="/" [catalog]="/catalog" [product]="/product/$PID" [quote]="/quote" )
mkdir -p "$OUT"
for name in home catalog product quote; do
  url="$BASE${ROUTES[$name]}"
  for mode in mobile desktop; do
    PRESET=""; [ "$mode" = "desktop" ] && PRESET="--preset=desktop"
    for pass in 1 2 3; do
      f="$OUT/${name}_${mode}_${pass}"
      echo "=> $name $mode pass$pass"
      npx --yes lighthouse@11 "$url" --only-categories=performance $PRESET \
        --output=json --output=html --output-path="$f" \
        --chrome-flags="--headless=new --no-sandbox --disable-gpu" --quiet >/dev/null 2>&1
    done
  done
done
echo "DONE"
