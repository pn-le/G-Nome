import { Platform } from 'react-native';
import { ParseResult, ReportResult, CulturalRecommendations } from './types';
import { API_BASE_URL } from './config';

async function readErrorBody(res: Response): Promise<string> {
  try {
    const data = await res.json();
    if (typeof data?.detail === 'string') return data.detail;
    return JSON.stringify(data);
  } catch {
    try {
      return await res.text();
    } catch {
      return res.statusText;
    }
  }
}

function guessMimeType(fileName: string): string {
  const ext = fileName.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'txt': return 'text/plain';
    case 'csv': return 'text/csv';
    case 'zip': return 'application/zip';
    default:    return 'application/octet-stream';
  }
}

export async function parseFile(fileUri: string, fileName: string, webFile?: File): Promise<ParseResult> {
  console.log(`[api] parseFile name=${fileName} platform=${Platform.OS} base=${API_BASE_URL}`);

  const form = new FormData();
  if (Platform.OS === 'web') {
    if (!webFile) throw new Error('File object missing — please try picking the file again.');
    // Browser FormData requires a native File/Blob
    form.append('file', webFile, fileName);
  } else {
    // React Native native: {uri, name, type} object
    form.append('file', {
      uri: fileUri,
      name: fileName,
      type: guessMimeType(fileName),
    } as any);
  }

  const res = await fetch(`${API_BASE_URL}/api/parse`, {
    method: 'POST',
    body: form,
  });

  if (!res.ok) {
    throw new Error(`Parse failed (${res.status}): ${await readErrorBody(res)}`);
  }
  return (await res.json()) as ParseResult;
}

export async function getReport(sessionId: string): Promise<ReportResult> {
  console.log(`[api] getReport session_id=${sessionId} base=${API_BASE_URL}`);

  const url = `${API_BASE_URL}/api/report?session_id=${encodeURIComponent(sessionId)}`;
  const res = await fetch(url, { method: 'POST' });

  if (!res.ok) {
    throw new Error(`Report failed (${res.status}): ${await readErrorBody(res)}`);
  }
  return (await res.json()) as ReportResult;
}

export function getPdfUrl(sessionId: string): string {
  if (!sessionId) return '';
  return `${API_BASE_URL}/api/pdf/${encodeURIComponent(sessionId)}`;
}

export async function checkHealth(): Promise<{ status: string; sessions: number }> {
  const res = await fetch(`${API_BASE_URL}/api/health`);
  if (!res.ok) throw new Error(`Health check failed (${res.status})`);
  return res.json();
}

export async function sendChatMessage(sessionId: string, message: string): Promise<string> {
  const res = await fetch(`${API_BASE_URL}/api/chat/${sessionId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message })
  });
  if (!res.ok) throw new Error('Chat failed');
  const data = await res.json();
  return data.response;
}

export async function generateMealPlan(sessionId: string): Promise<string> {
  const res = await fetch(`${API_BASE_URL}/api/meal-plan/${sessionId}`, {
    method: 'POST'
  });
  if (!res.ok) throw new Error('Plan failed');
  const data = await res.json();
  return data.plan;
}



export async function analyzeSelfie(sessionId: string, imageUri: string, webFile?: File): Promise<any> {
  const formData = new FormData();
  if (Platform.OS === 'web' && webFile) {
    formData.append('image', webFile, 'selfie.jpg');
  } else {
    formData.append('image', {
      uri: imageUri,
      type: 'image/jpeg',
      name: 'selfie.jpg',
    } as any);
  }

  const res = await fetch(`${API_BASE_URL}/api/cv/selfie?session_id=${sessionId}`, {
    method: 'POST',
    body: formData,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error('Selfie analysis failed: ' + text);
  }
  return await res.json();
}


export async function analyzeSkin(sessionId: string, imageUri: string, webFile?: File): Promise<any> {
  const formData = new FormData();
  if (Platform.OS === 'web' && webFile) {
    formData.append('image', webFile, 'skin.jpg');
  } else {
    formData.append('image', {
      uri: imageUri,
      type: 'image/jpeg',
      name: 'skin.jpg',
    } as any);
  }

  const res = await fetch(`${API_BASE_URL}/api/cv/skin?session_id=${sessionId}`, {
    method: 'POST',
    body: formData,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error('Skin analysis failed: ' + text);
  }
  return await res.json();
}



export async function getCulturalRecommendations(
  parseResult: { ancestry?: Record<string, number>; session_id?: string; source?: string; snp_count?: number; chromosomes?: number },
  report: ReportResult,
  culture: string,
): Promise<CulturalRecommendations> {
  // Build the payload shape the backend expects (matches schemas.SAMPLE_PAYLOAD)
  const payload = {
    parse: {
      source: parseResult.source ?? 'Unknown',
      ancestry: parseResult.ancestry ?? {},
      snp_count: parseResult.snp_count ?? 0,
      session_id: parseResult.session_id ?? '',
      chromosomes: parseResult.chromosomes ?? 0,
    },
    report: {
      report_text: report.report_text,
      disease_risk: report.disease_risk,
      carrier_status: report.carrier_status,
    },
  };

  // Extract flagged drugs + metabolizer status from PGX data
  const flaggedDrugs: string[] = [];
  const metabolizerStatus: Record<string, string> = {};
  for (const gene of report.pharmacogenomics?.genes ?? []) {
    if (gene.metabolizer_status) {
      metabolizerStatus[gene.gene] = gene.metabolizer_status;
    }
    for (const flag of gene.drug_flags ?? []) {
      if (!flaggedDrugs.includes(flag.drug)) {
        flaggedDrugs.push(flag.drug);
      }
    }
  }

  const body = {
    payload,
    culture,
    flagged_drugs: flaggedDrugs,
    metabolizer_status: metabolizerStatus,
  };

  console.log(`[api] getCulturalRecommendations culture=${culture} base=${API_BASE_URL}`);

  const res = await fetch(`${API_BASE_URL}/api/cultural-recommendations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw new Error(`Cultural recommendations failed (${res.status}): ${await readErrorBody(res)}`);
  }
  return (await res.json()) as CulturalRecommendations;
}
