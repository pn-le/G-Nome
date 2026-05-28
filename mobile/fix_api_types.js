const fs = require('fs');
const p = '/Users/nghiatrang/G-nome/G-Nome/mobile/lib/api.ts';
let code = fs.readFileSync(p, 'utf8');

// The file lib/types.ts already has ParseResult, DrugFlag, GeneResult, AncestryAdjustment, RiskCondition, CarrierResult, TraitResult, ReportResult
// We need to remove them from api.ts.
// It's easier to just use regex to remove everything from `export interface ParseResult {` up to `export async function parseFile`
const regex = /export interface ParseResult[\s\S]*?(?=export async function parseFile)/;
code = code.replace(regex, '');

fs.writeFileSync(p, code);
