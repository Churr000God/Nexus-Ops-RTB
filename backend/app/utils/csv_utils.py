from __future__ import annotations

import csv
import hashlib
from collections.abc import Iterable, Iterator
from pathlib import Path
from typing import Any


def compute_sha256(file_path: Path) -> str:
    hasher = hashlib.sha256()
    with file_path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            hasher.update(chunk)
    return hasher.hexdigest()


def read_csv_rows(
    file_path: Path,
    *,
    delimiter: str = ",",
    encoding: str = "utf-8",
) -> tuple[list[str], Iterator[dict[str, Any]]]:
    handle = file_path.open("r", encoding=encoding, newline="")
    reader = csv.DictReader(handle, delimiter=delimiter)

    def _iter_rows() -> Iterator[dict[str, Any]]:
        try:
            for row in reader:
                yield dict(row)
        finally:
            handle.close()

    return (list(reader.fieldnames or []), _iter_rows())


def normalize_header(header: Iterable[str]) -> list[str]:
    return [col.strip().lower().replace(" ", "_") for col in header]
