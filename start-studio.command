#!/bin/zsh
set -eu
cd "$(dirname "$0")"
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
studio_installed="$HOME/Applications/Tidemark.app"
if [[ -d "$studio_installed" ]]; then
  open "$studio_installed"
  exit 0
fi
if [[ ! -d ".local-studio/Tidemark.app" ]]; then
  bun run studio:macos:build
fi
open ".local-studio/Tidemark.app"
