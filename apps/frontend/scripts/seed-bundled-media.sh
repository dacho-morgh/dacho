#!/bin/sh
set -eu

source_dir="${1:?Bundled media source is required}"
target_dir="${2:?Upload destination is required}"

# CI images omit the gitignored media directory; uploads live in a volume.
[ -d "$source_dir" ] || exit 0
for file in "$source_dir"/*; do
  [ -f "$file" ] || continue
  cp -n "$file" "$target_dir"/
done
