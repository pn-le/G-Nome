import { Platform } from "react-native";

const API_BASE = __DEV__ ? "http://localhost:8000" : "http://localhost:8000";

async function appendFile(fd: FormData, key: string, uri: string, name: string, mime: string) {
  if (Platform.OS === "web") {
    const r = await fetch(uri);
    const blob = await r.blob();
    fd.append(key, new File([blob], name, { type: mime }));
  } else {
    fd.append(key, { uri, name, type: mime } as any);
  }
}

export async function parseFile(fileUri: string, fileName: string): Promise<ParseResult> {
  const formData = new FormData();
  await appendFile(formData, "file", fileUri, fileName, "text/plain");

  const res = await fetch(`${API_BASE}/api/parse`, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Parse failed: ${err}`);
  }

  return res.json();
}

export async function getReport(sessionId: string): Promise<ReportResult> {
  const res = await fetch(`${API_BASE}/api/report?session_id=${sessionId}`, {
    method: "POST",
  });

  if (!res.ok) throw new Error("Report generation failed");
  return res.json();
}

export async function analyzeSelfie(sessionId: string, imageUri: string): Promise<any> {
  const formData = new FormData();
  await appendFile(formData, "image", imageUri, "selfie.jpg", "image/jpeg");

  const res = await fetch(`${API_BASE}/api/cv/selfie?session_id=${sessionId}`, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) throw new Error("Selfie analysis failed");
  return res.json();
}

export async function analyzeSkin(sessionId: string, imageUri: string): Promise<any> {
  const formData = new FormData();
  await appendFile(formData, "image", imageUri, "skin.jpg", "image/jpeg");

  const res = await fetch(`${API_BASE}/api/cv/skin?session_id=${sessionId}`, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) throw new Error("Skin analysis failed");
  return res.json();
}

export function getPdfUrl(sessionId: string): string {
  return `${API_BASE}/api/pdf/${sessionId}`;
}

// Types
export interface ParseResult {
  session_id: string;
  source: string;
  snp_count: number;
  chromosomes: number;
  ancestry: Record<string, number>;
}

export interface DrugFlag {
  drug: string;
  severity: "HIGH" | "MODERATE" | "LOW";
  action: string;
  reason: string;
}

export interface GeneResult {
  gene: string;
  metabolizer_status: string;
  status_label: string;
  drug_flags: DrugFlag[];
  disclaimer: string;
  // CYP2D6 special
  status?: string;
  affected_drugs?: string[];
}

export interface RiskCondition {
  condition: string;
  label: string;
  description: string;
  status: string;
  raw_score?: number;
  percentile?: number;
  risk_tier?: string;
  risk_label?: string;
  snps_matched?: number;
  snps_total?: number;
  coverage_pct?: number;
  ancestry_adjustment?: {
    primary_ancestry: string;
    ancestry_percentage: number;
    population_used: string;
    confidence: string;
    note: string;
  };
  message?: string;
  disclaimer?: string;
}

export interface CarrierResult {
  gene: string;
  condition: string;
  rsid: string;
  genotype: string;
  status: string;
  status_label: string;
  detail: string;
  notes: string;
  disclaimer: string;
}

export interface TraitResult {
  name: string;
  category: string;
  gene: string;
  rsid: string;
  genotype: string;
  status: string;
  label: string;
  detail: string;
}

export interface ReportResult {
  pharmacogenomics: {
    genes: GeneResult[];
    summary: { high_risk_drugs: number; moderate_risk_drugs: number; genes_tested: number };
  };
  disease_risk: {
    conditions: RiskCondition[];
    equity_note: string;
  };
  carrier_status: {
    results: CarrierResult[];
    carriers_found: number;
    conditions_tested: number;
    disclaimer: string;
  };
  nutrition_traits: {
    traits: TraitResult[];
    total_tested: number;
  };
  report_text: {
    full_text: string;
    llm_generated: boolean;
  };
}
