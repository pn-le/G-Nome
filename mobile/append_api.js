const fs = require('fs');
const p = '/Users/nghiatrang/G-nome/G-Nome/mobile/lib/api.ts';
let code = fs.readFileSync(p, 'utf8');

if (!code.includes('export async function getCulturalRecommendations')) {
  // Add the import to CulturalRecommendations
  code = code.replace(
    "import { ParseResult, ReportResult } from './types';",
    "import { ParseResult, ReportResult, CulturalRecommendations } from './types';"
  );
  if (!code.includes('CulturalRecommendations')) {
    code = code.replace(
      "import { ParseResult, ReportResult } from './api';",
      "import { ParseResult, ReportResult, CulturalRecommendations } from './types';"
    );
  }

  const func = `
export async function getCulturalRecommendations(
  parseResult: { ancestry?: Record<string, number>; session_id?: string; source?: string; snp_count?: number; chromosomes?: number },
  report: ReportResult,
  culture: string,
): Promise<CulturalRecommendations> {
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

  console.log(\`[api] getCulturalRecommendations culture=\${culture} base=\${API_BASE_URL}\`);

  const res = await fetch(\`\${API_BASE_URL}/api/cultural-recommendations\`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw new Error(\`Cultural recommendations failed (\${res.status}): \${await readErrorBody(res)}\`);
  }
  return (await res.json()) as CulturalRecommendations;
}
`;
  fs.writeFileSync(p, code + "\n" + func);
}
