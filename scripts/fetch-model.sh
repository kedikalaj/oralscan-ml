#!/bin/sh
# Downloads the Teachable Machine model into public/model so it is served by this app.
# Skips the download when the model is already there (e.g. you copied an export in by hand).
# The weight file names are read from model.json: the hosted model uses "model.weights.bin",
# while a downloaded export uses "weights.bin".
set -e
MODEL_URL="${TM_MODEL_URL:-https://teachablemachine.withgoogle.com/models/QVQAlY759/}"
case "$MODEL_URL" in */) ;; *) MODEL_URL="$MODEL_URL/";; esac
DEST="public/model"
mkdir -p "$DEST"

weight_files() {
  # Prints each path listed in the weightsManifest of model.json, without a leading "./".
  tr -d '\n\r ' < "$DEST/model.json" | grep -o '"paths":\[[^]]*\]' | grep -o '"[^"]*\.bin"' | tr -d '"' | sed 's#^\./##'
}

model_present() {
  [ -s "$DEST/model.json" ] && [ -s "$DEST/metadata.json" ] || return 1
  W=$(weight_files)
  [ -n "$W" ] || return 1
  for w in $W; do [ -s "$DEST/$w" ] || return 1; done
}

fetch() {
  echo "[fetch-model] $MODEL_URL$1"
  if command -v curl >/dev/null 2>&1; then
    curl -fsSL "$MODEL_URL$1" -o "$DEST/$1" && return 0
  else
    wget -q "$MODEL_URL$1" -O "$DEST/$1" && return 0
  fi
  rm -f "$DEST/$1"
  echo "[fetch-model] ERROR: could not download $MODEL_URL$1" >&2
  echo "[fetch-model] Check the server's internet access, or export the model from Teachable Machine" >&2
  echo "[fetch-model] (Export Model > Tensorflow.js > Download) and put its files (model.json, metadata.json, weights.bin) in public/model/." >&2
  exit 1
}

if model_present; then
  echo "[fetch-model] model already present in $DEST, skipping download"
  exit 0
fi

fetch model.json
fetch metadata.json
W=$(weight_files)
if [ -z "$W" ]; then
  echo "[fetch-model] ERROR: model.json lists no weight files" >&2
  exit 1
fi
for w in $W; do fetch "$w"; done
echo "[fetch-model] done"
