"""
Parse WHO dietary guideline PDFs using Docling and convert to corpus documents.

Docling handles multi-column PDFs, tables, and reading order automatically.
Much more reliable than manual PDF parsing.

STEP 1 — Download PDFs manually into cultural_rag/data/who_pdfs/:
    Recommended WHO documents (all free at who.int):

    Global:
    - WHO Technical Report 916 "Diet, nutrition and prevention of chronic diseases"
      https://apps.who.int/iris/handle/10665/42665

    Regional (most useful for the cultures we cover):
    - WPRO (Western Pacific — East Asian, Southeast Asian populations):
      https://iris.who.int/handle/10665/206941
    - SEARO (South-East Asia — South Asian):
      https://iris.who.int/handle/10665/204587
    - AFRO (Africa):
      https://iris.who.int/handle/10665/42665   (use global TRS916 for Africa)
    - EMRO (Eastern Mediterranean — Middle Eastern):
      https://iris.who.int/handle/10665/119819
    - EURO (Europe):
      https://iris.who.int/handle/10665/107806
    - AMRO/PAHO (Americas — Brazilian, Mexican, Latin American):
      https://iris.paho.org/handle/10665.2/54031

STEP 2 — Run this script:
    cd G-Nome
    python -m cultural_rag.ingest.pull_who

    Reads all PDFs from cultural_rag/data/who_pdfs/
    Outputs corpus documents to cultural_rag/data/who_corpus_raw.json

STEP 3 — Re-run verify_docs.py to include who_corpus_raw.json in the final corpus.

Usage:
    python -m cultural_rag.ingest.pull_who [--pdf path/to/specific.pdf]
"""

import json
import re
import sys
from pathlib import Path

from cultural_rag.config import DATA_DIR

# ---------------------------------------------------------------------------
# Region → cultures mapping
# Filenames should contain a region keyword (case-insensitive) OR you assign
# the culture manually in WHO_PDF_SOURCES below.
# ---------------------------------------------------------------------------
WHO_PDF_SOURCES: list[dict] = [
    # filename_pattern: maps to these cultures
    {"pattern": "wpro",        "cultures": ["East Asian", "Southeast Asian", "Vietnamese", "Japanese", "Korean"]},
    {"pattern": "searo",       "cultures": ["South Asian", "Indian", "Southeast Asian"]},
    {"pattern": "afro",        "cultures": ["African"]},
    {"pattern": "emro",        "cultures": ["Middle Eastern"]},
    {"pattern": "euro",        "cultures": ["European", "German", "Italian"]},
    {"pattern": "paho",        "cultures": ["Brazilian", "Mexican"]},
    {"pattern": "amro",        "cultures": ["Brazilian", "Mexican"]},
    {"pattern": "trs916",      "cultures": ["East Asian", "South Asian", "African", "Middle Eastern", "European", "Southeast Asian"]},
    {"pattern": "global",      "cultures": ["East Asian", "South Asian", "African", "Middle Eastern", "European", "Southeast Asian"]},
    {"pattern": "healthy_diet","cultures": ["East Asian", "South Asian", "African", "Middle Eastern", "European", "Southeast Asian"]},
]

# Conditions to look for in WHO text — keywords that flag a section as relevant
CONDITION_KEYWORDS: dict[str, list[str]] = {
    "Type 2 Diabetes":       ["diabetes", "glycaemic", "glycemic", "blood glucose", "insulin", "hyperglycaemia"],
    "coronary artery disease":["cardiovascular", "coronary", "heart disease", "atherosclerosis", "blood pressure", "hypertension", "stroke"],
    "elevated LDL cholesterol": ["cholesterol", "lipid", "LDL", "HDL", "saturated fat", "trans fat", "dyslipidaemia"],
    "celiac disease":        ["gluten", "coeliac", "celiac", "wheat intolerance"],
    "Alzheimer's disease":   ["dementia", "cognitive", "alzheimer", "neurodegeneration", "brain health"],
    "MTHFR folate":          ["folate", "folic acid", "neural tube", "homocysteine", "B vitamin"],
    "vitamin D deficiency":  ["vitamin D", "calcium", "bone health", "rickets", "osteoporosis"],
    "alcohol metabolism":    ["alcohol", "ethanol", "drinking", "ALDH"],
    "lactose intolerance":   ["lactose", "dairy", "milk intolerance", "calcium absorption"],
    "general_nutrition":     ["diet", "nutrition", "dietary", "food", "nutrient"],
}

MIN_CHUNK_LENGTH = 150    # discard very short chunks (headers, page numbers, captions)
MAX_CHUNK_LENGTH = 1200   # split very long chunks


def _slugify(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "_", text.lower()).strip("_")


def _detect_cultures(pdf_path: Path) -> list[str]:
    """Map PDF filename to culture list using WHO_PDF_SOURCES patterns."""
    name = pdf_path.name.lower()
    for entry in WHO_PDF_SOURCES:
        if entry["pattern"] in name:
            return entry["cultures"]
    # Default: treat as global guideline covering all macro cultures
    return ["East Asian", "South Asian", "African", "Middle Eastern", "European", "Southeast Asian"]


def _detect_condition(text: str) -> str:
    """Classify a text chunk to the most relevant condition based on keyword frequency."""
    text_lower = text.lower()
    scores: dict[str, int] = {}
    for condition, keywords in CONDITION_KEYWORDS.items():
        score = sum(text_lower.count(kw.lower()) for kw in keywords)
        if score > 0:
            scores[condition] = score

    if not scores:
        return "general_nutrition"

    # Return condition with highest keyword score (excluding general_nutrition unless only match)
    specific = {k: v for k, v in scores.items() if k != "general_nutrition"}
    if specific:
        return max(specific, key=specific.__get__ if hasattr(specific, '__get__') else lambda k: specific[k])
    return "general_nutrition"


def _chunk_markdown(markdown_text: str) -> list[str]:
    """
    Split Docling markdown output into chunks by heading boundaries.
    Each heading + its following paragraphs = one chunk.
    Long paragraphs are split further.
    """
    chunks: list[str] = []
    current_lines: list[str] = []

    for line in markdown_text.splitlines():
        # New heading = flush current chunk, start new
        if line.startswith("#"):
            if current_lines:
                chunk = " ".join(l.strip() for l in current_lines if l.strip())
                if len(chunk) >= MIN_CHUNK_LENGTH:
                    chunks.append(chunk)
            current_lines = [line.lstrip("#").strip()]
        else:
            current_lines.append(line)

    # Flush final chunk
    if current_lines:
        chunk = " ".join(l.strip() for l in current_lines if l.strip())
        if len(chunk) >= MIN_CHUNK_LENGTH:
            chunks.append(chunk)

    # Split chunks that are too long
    final_chunks: list[str] = []
    for chunk in chunks:
        if len(chunk) <= MAX_CHUNK_LENGTH:
            final_chunks.append(chunk)
        else:
            # Split at sentence boundaries
            sentences = re.split(r"(?<=[.!?])\s+", chunk)
            sub_chunk: list[str] = []
            for sentence in sentences:
                sub_chunk.append(sentence)
                if sum(len(s) for s in sub_chunk) >= MAX_CHUNK_LENGTH // 2:
                    joined = " ".join(sub_chunk)
                    if len(joined) >= MIN_CHUNK_LENGTH:
                        final_chunks.append(joined)
                    sub_chunk = []
            if sub_chunk:
                joined = " ".join(sub_chunk)
                if len(joined) >= MIN_CHUNK_LENGTH:
                    final_chunks.append(joined)

    return final_chunks


def parse_who_pdf(pdf_path: Path) -> list[dict]:
    """Parse a single WHO PDF into corpus documents using Docling."""
    try:
        from docling.document_converter import DocumentConverter
    except ImportError:
        print("  [ERROR] docling not installed. Run: pip install docling")
        return []

    print(f"  Parsing: {pdf_path.name}")
    cultures = _detect_cultures(pdf_path)
    print(f"    Cultures: {cultures}")

    # Extract text with pypdf — fast, no ML, works perfectly for WHO's digitally-typed PDFs.
    # Docling's layout model crashes on large PDFs due to memory pressure; not needed here.
    try:
        from pypdf import PdfReader
    except ImportError:
        print("  [ERROR] pypdf not installed. Run: pip install pypdf")
        return []

    reader = PdfReader(str(pdf_path))
    pages_text = []
    for page in reader.pages:
        text = page.extract_text()
        if text and text.strip():
            pages_text.append(text.strip())

    # Join pages and fake a simple markdown structure so _chunk_markdown works
    # Insert a heading boundary between pages so chunks don't span page breaks awkwardly
    markdown_text = "\n\n".join(pages_text)

    # Chunk by section
    chunks = _chunk_markdown(markdown_text)
    print(f"    Chunks: {len(chunks)}")

    # Convert each chunk to corpus documents (one per culture)
    docs: list[dict] = []
    pdf_slug = _slugify(pdf_path.stem)
    seen: set[str] = set()

    for i, chunk in enumerate(chunks):
        condition = _detect_condition(chunk)

        # Skip generic chunks — they add noise without cultural specificity.
        # Only keep chunks that map to a tracked condition.
        if condition == "general_nutrition":
            continue

        for culture in cultures:
            doc_id = f"who_{pdf_slug}_{_slugify(culture)}_{i:03d}"

            if doc_id in seen:
                continue
            seen.add(doc_id)

            content = f"[WHO Dietary Guideline — {culture} region] {chunk}"

            docs.append({
                "id": doc_id,
                "culture": culture,
                "condition": condition,
                "content": content,
                "evidence_source": f"WHO:{pdf_path.stem}",
            })

    return docs


def pull_who(
    pdf_dir: Path | None = None,
    output_path: Path | None = None,
    specific_pdf: Path | None = None,
) -> list[dict]:
    """
    Parse all WHO PDFs in pdf_dir and output corpus documents.

    Args:
        pdf_dir: Directory containing WHO PDF files. Defaults to data/who_pdfs/
        output_path: Output JSON path. Defaults to data/who_corpus_raw.json
        specific_pdf: If set, parse only this PDF (for testing).
    """
    if pdf_dir is None:
        pdf_dir = DATA_DIR / "who_pdfs"
    if output_path is None:
        output_path = DATA_DIR / "who_corpus_raw.json"

    pdf_dir.mkdir(parents=True, exist_ok=True)

    if specific_pdf:
        pdf_files = [specific_pdf]
    else:
        pdf_files = list(pdf_dir.glob("*.pdf"))

    if not pdf_files:
        print(f"No PDFs found in {pdf_dir}")
        print("Download WHO guideline PDFs into that directory, then re-run.")
        print("See module docstring for recommended WHO PDF sources.")
        return []

    print(f"WHO Dietary Guidelines Parser (Docling)")
    print(f"  PDF directory: {pdf_dir}")
    print(f"  PDFs found: {len(pdf_files)}")
    print()

    all_docs: list[dict] = []
    for pdf_path in pdf_files:
        docs = parse_who_pdf(pdf_path)
        all_docs.extend(docs)
        print(f"    -> {len(docs)} corpus documents")
        print()

    if not all_docs:
        return []

    output_path.parent.mkdir(parents=True, exist_ok=True)
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(all_docs, f, indent=2, ensure_ascii=False)

    print(f"Done. {len(all_docs)} WHO documents saved to {output_path}")

    # Condition breakdown
    conds: dict[str, int] = {}
    for d in all_docs:
        conds[d["condition"]] = conds.get(d["condition"], 0) + 1
    print("Condition breakdown:")
    for k, v in sorted(conds.items()):
        print(f"  {k}: {v}")

    return all_docs


if __name__ == "__main__":
    specific = None
    if "--pdf" in sys.argv:
        idx = sys.argv.index("--pdf")
        specific = Path(sys.argv[idx + 1])

    pull_who(specific_pdf=specific)
