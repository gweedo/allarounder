#!/bin/sh
# Reads changed paths, one per line, on stdin. Exits 0 only when there is at
# least one path and every path is under content/ or public/images/ -- the
# directories publish.yml commits. Anything else (including no input) exits 1.
found=1
while IFS= read -r path || [ -n "$path" ]; do
  case $path in
    src/frontend/content/?* | src/frontend/public/images/?*) found=0 ;;
    *) exit 1 ;;
  esac
done
exit "$found"
