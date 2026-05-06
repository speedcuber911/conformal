"""Load the SFS demo workbook into an in-memory DuckDB instance.

The dataset ships as one workbook (`Docs/sfs_demo_dataset.xlsx`) with one sheet
per table plus a documentation `README` sheet. We register each data sheet as a
DuckDB table, named identically to the sheet.
"""
from __future__ import annotations

from pathlib import Path

import duckdb
import pandas as pd

REPO_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_XLSX_PATH = REPO_ROOT / "Docs" / "sfs_demo_dataset.xlsx"

# README is a documentation sheet, not a table.
SKIP_SHEETS = {"README"}


def load_workbook(
    conn: duckdb.DuckDBPyConnection,
    xlsx_path: Path = DEFAULT_XLSX_PATH,
) -> dict[str, int]:
    """Register each data sheet of `xlsx_path` as a DuckDB table on `conn`.

    Returns a mapping {table_name: row_count} so callers can log a load summary.
    """
    if not xlsx_path.exists():
        raise FileNotFoundError(f"Demo workbook not found at {xlsx_path}")

    xl = pd.ExcelFile(xlsx_path)
    summary: dict[str, int] = {}
    for sheet in xl.sheet_names:
        if sheet in SKIP_SHEETS:
            continue
        df = pd.read_excel(xl, sheet_name=sheet)
        conn.register("_load_df", df)
        conn.execute(f'CREATE OR REPLACE TABLE "{sheet}" AS SELECT * FROM _load_df')
        conn.unregister("_load_df")
        summary[sheet] = len(df)
    return summary


def open_database(xlsx_path: Path = DEFAULT_XLSX_PATH) -> duckdb.DuckDBPyConnection:
    """Create an in-memory DuckDB connection with all tables loaded."""
    conn = duckdb.connect(":memory:")
    summary = load_workbook(conn, xlsx_path)
    total = sum(summary.values())
    print(f"[duckdb] loaded {len(summary)} tables, {total:,} total rows from {xlsx_path.name}")
    for table, n in summary.items():
        print(f"  {table:32s} {n:>7,} rows")
    return conn
