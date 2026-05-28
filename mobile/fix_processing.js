const fs = require('fs');
const p = '/Users/nghiatrang/G-nome/G-Nome/mobile/ProcessingScreen.tsx';
let code = fs.readFileSync(p, 'utf8');

if (!code.includes('savePastSession')) {
  code = code.replace(
    "import { getReport } from './lib/api';",
    "import { getReport } from './lib/api';\nimport { savePastSession } from './lib/storage';"
  );

  code = code.replace(
    "setReportResult(res);",
    "setReportResult(res);\n          // Save to local storage for past records feature\n          savePastSession(parseResult.source || 'DNA File', parseResult, res);"
  );

  fs.writeFileSync(p, code);
}
