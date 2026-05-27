"""DNA file parser — supports 23andMe (.txt) and AncestryDNA (.csv) via snps library."""

import io
import tempfile
import os

import pandas as pd
from snps import SNPs


def parse_dna_file(raw_bytes: bytes, filename: str) -> dict:
    """Parse a raw DNA file into a standardized DataFrame.

    Returns dict with keys: snps (DataFrame), source (str), ancestry (dict).
    """
    # snps library needs a file path, so write to a temp file
    suffix = ".txt" if filename.endswith(".txt") else ".csv"
    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
        tmp.write(raw_bytes)
        tmp_path = tmp.name

    try:
        s = SNPs(tmp_path)
    finally:
        os.unlink(tmp_path)

    if s.snps is None or s.snps.empty:
        raise ValueError("No SNPs found in file — check format")

    df = s.snps.reset_index()
    # Normalize column names
    col_map = {}
    for col in df.columns:
        low = col.lower()
        if low in ("rsid", "snp", "name"):
            col_map[col] = "rsid"
        elif low in ("chromosome", "chrom", "chr"):
            col_map[col] = "chrom"
        elif low in ("position", "pos"):
            col_map[col] = "pos"
        elif low in ("genotype", "alleles", "result"):
            col_map[col] = "genotype"

    df = df.rename(columns=col_map)

    required = {"rsid", "chrom", "genotype"}
    if not required.issubset(set(df.columns)):
        raise ValueError(f"Missing columns after parsing: {required - set(df.columns)}")

    # Drop rows with missing genotype
    df = df.dropna(subset=["genotype"])
    df = df[df["genotype"] != "--"]

    # Determine source
    source = s.source or ("23andMe" if filename.endswith(".txt") else "AncestryDNA")

    # Try to extract ancestry from 23andMe header comments
    ancestry = _extract_ancestry(raw_bytes)

    return {
        "snps": df,
        "source": source,
        "ancestry": ancestry,
    }


def _extract_ancestry(raw_bytes: bytes) -> dict:
    """Best-effort extraction of ancestry composition from 23andMe file header."""
    ancestry = {}
    try:
        text = raw_bytes.decode("utf-8", errors="ignore")
        for line in text.split("\n")[:100]:
            if not line.startswith("#"):
                break
            low = line.lower()
            if "european" in low:
                ancestry["European"] = _parse_pct(line)
            elif "east asian" in low:
                ancestry["East Asian"] = _parse_pct(line)
            elif "african" in low:
                ancestry["African"] = _parse_pct(line)
            elif "south asian" in low:
                ancestry["South Asian"] = _parse_pct(line)
            elif "native american" in low or "indigenous" in low:
                ancestry["Native American"] = _parse_pct(line)
    except Exception:
        pass
    return ancestry


def _parse_pct(line: str) -> float:
    """Try to pull a percentage from a header line like '# European: 78.2%'."""
    import re
    match = re.search(r"([\d.]+)\s*%", line)
    if match:
        return float(match.group(1))
    return 0.0
