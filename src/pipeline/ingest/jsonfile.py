"""One JSON format for every generated content file (issue #197), so article
and stats diffs read the same: 2-space indent, UTF-8 kept as is, trailing
newline. Writes are atomic: a temp file in the same directory, then rename."""

from __future__ import annotations

import json
import os
import tempfile
from pathlib import Path
from typing import Any


def dumps(data: Any) -> str:
    return json.dumps(data, indent=2, ensure_ascii=False) + "\n"


def write_json(path: Path, data: Any) -> None:
    text = dumps(data)  # serialise first: a bad value never touches the disk
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp = tempfile.mkstemp(dir=path.parent, prefix=f".{path.name}.", suffix=".tmp")
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            f.write(text)
        os.replace(tmp, path)
    except BaseException:
        Path(tmp).unlink(missing_ok=True)
        raise
