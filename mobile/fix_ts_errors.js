const fs = require('fs');

// 1. Fix DashboardScreen.tsx
let p = '/Users/nghiatrang/G-nome/G-Nome/mobile/DashboardScreen.tsx';
let code = fs.readFileSync(p, 'utf8');
code = code.replace(
  "export default function DashboardScreen({ onOpenReport, onTabPress, onOpenChat, onOpenPlan }: Props) {",
  "export default function DashboardScreen({ onOpenReport, onTabPress, onOpenChat, onOpenPlan, onOpenCultural }: Props) {"
);
fs.writeFileSync(p, code);

// 2. Fix storage.ts
p = '/Users/nghiatrang/G-nome/G-Nome/mobile/lib/storage.ts';
code = fs.readFileSync(p, 'utf8');
code = code.replace(
  "import { ParseResult, ReportResult } from './api';",
  "import { ParseResult, ReportResult } from './types';"
);
fs.writeFileSync(p, code);
