"""Skin lesion scanner — EfficientNet-B4 inference + MC1R genetic risk fusion."""

import io

import numpy as np
import pandas as pd

# HAM10000 class labels
CLASSES = ["MEL", "NV", "BCC", "AKIEC", "BKL", "DF", "VASC"]
CLASS_LABELS = {
    "MEL": "Melanoma",
    "NV": "Melanocytic Nevus (common mole)",
    "BCC": "Basal Cell Carcinoma",
    "AKIEC": "Actinic Keratosis / Intraepithelial Carcinoma",
    "BKL": "Benign Keratosis",
    "DF": "Dermatofibroma",
    "VASC": "Vascular Lesion",
}

# MC1R SNPs for genetic risk multiplier
MC1R_SNPS = {
    "rs1805007": {"risk_alleles": ["T"]},
    "rs1805008": {"risk_alleles": ["T"]},
}


def _get_mc1r_multiplier(snps: pd.DataFrame) -> float:
    """Check MC1R variants for melanoma genetic risk adjustment."""
    lookup = dict(zip(snps["rsid"].str.lower(), snps["genotype"]))

    for rsid, info in MC1R_SNPS.items():
        genotype = lookup.get(rsid.lower(), "")
        for allele in info["risk_alleles"]:
            if allele in genotype.upper():
                return 2.1  # MC1R variant present — 2.1x risk multiplier

    return 1.0  # No MC1R variants detected


def _run_inference(img_bytes: bytes) -> dict:
    """Run EfficientNet-B4 inference on skin lesion image."""
    try:
        from PIL import Image
        import torch
        from torchvision import transforms
        from transformers import AutoModelForImageClassification

        img = Image.open(io.BytesIO(img_bytes)).convert("RGB")

        # Preprocessing for EfficientNet
        transform = transforms.Compose([
            transforms.Resize((380, 380)),
            transforms.ToTensor(),
            transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
        ])
        tensor = transform(img).unsqueeze(0)

        # Load model — will download on first use
        model = AutoModelForImageClassification.from_pretrained(
            "google/efficientnet-b4",
            num_labels=7,
            ignore_mismatched_sizes=True,
        )
        model.eval()

        with torch.no_grad():
            outputs = model(tensor)
            probs = torch.softmax(outputs.logits, dim=1).squeeze().numpy()

        class_probs = {cls: round(float(prob), 4) for cls, prob in zip(CLASSES, probs)}
        return {"success": True, "probabilities": class_probs}

    except Exception as e:
        # Return mock probabilities for demo if model isn't available
        return {
            "success": False,
            "error": str(e),
            "probabilities": _mock_probabilities(),
        }


def _mock_probabilities() -> dict:
    """Generate realistic-looking mock probabilities for demo."""
    # Heavily weighted toward NV (benign mole) — most common result
    probs = {"MEL": 0.08, "NV": 0.72, "BCC": 0.05, "AKIEC": 0.03, "BKL": 0.07, "DF": 0.03, "VASC": 0.02}
    return probs


def _compute_fused_risk(p_melanoma: float, genetic_multiplier: float) -> dict:
    """Fuse CV melanoma probability with MC1R genetic risk."""
    fused = p_melanoma * genetic_multiplier
    fused_pct = min(round(fused * 100, 1), 100)

    if fused_pct >= 75:
        urgency = "urgent"
        urgency_label = "Urgent — seek review within 1 week"
        color = "#e74c3c"
    elif fused_pct >= 55:
        urgency = "high"
        urgency_label = "High — see dermatologist within 4 weeks"
        color = "#e67e22"
    elif fused_pct >= 30:
        urgency = "moderate"
        urgency_label = "Moderate — discuss with GP"
        color = "#f39c12"
    else:
        urgency = "low"
        urgency_label = "Low — routine monitoring"
        color = "#27ae60"

    return {
        "fused_risk_pct": fused_pct,
        "urgency": urgency,
        "urgency_label": urgency_label,
        "color": color,
    }


def analyze_skin_lesion(img_bytes: bytes, snps: pd.DataFrame) -> dict:
    """Full skin lesion analysis: CV inference + genetic risk fusion."""
    inference = _run_inference(img_bytes)
    probs = inference["probabilities"]

    genetic_multiplier = _get_mc1r_multiplier(snps)
    p_melanoma = probs.get("MEL", 0)

    fused = _compute_fused_risk(p_melanoma, genetic_multiplier)

    # Format class results
    classifications = []
    for cls in sorted(probs, key=probs.get, reverse=True):
        classifications.append({
            "class": cls,
            "label": CLASS_LABELS.get(cls, cls),
            "probability": probs[cls],
            "probability_pct": round(probs[cls] * 100, 1),
        })

    return {
        "classifications": classifications,
        "melanoma_probability": round(p_melanoma, 4),
        "mc1r_variant_detected": genetic_multiplier > 1.0,
        "genetic_multiplier": genetic_multiplier,
        **fused,
        "model_available": inference["success"],
        "disclaimer": "Not a dermatological assessment. Consult a clinician for any skin concern.",
    }
