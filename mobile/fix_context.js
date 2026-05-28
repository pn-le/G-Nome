const fs = require('fs');

// 1. Fix AppContext.tsx to include culture
let p = '/Users/nghiatrang/G-nome/G-Nome/mobile/lib/AppContext.tsx';
let code = fs.readFileSync(p, 'utf8');

if (!code.includes('culture: string;')) {
  code = code.replace(
    "error: string | null;\n}",
    "error: string | null;\n  culture: string;\n}"
  );
  code = code.replace(
    "setError: (e: string | null) => void;\n  reset: () => void;",
    "setError: (e: string | null) => void;\n  setCulture: (c: string) => void;\n  reset: () => void;"
  );
  code = code.replace(
    "error: null,\n};",
    "error: null,\n  culture: '',\n};"
  );
  code = code.replace(
    "setError: () => {},\n  reset: () => {},",
    "setError: () => {},\n  setCulture: () => {},\n  reset: () => {},"
  );
  code = code.replace(
    "const setError = (e: string | null) =>\n    setState(s => ({ ...s, error: e }));",
    "const setError = (e: string | null) =>\n    setState(s => ({ ...s, error: e }));\n\n  const setCulture = (c: string) =>\n    setState(s => ({ ...s, culture: c }));"
  );
  code = code.replace(
    "setError,\n        reset,",
    "setError,\n        setCulture,\n        reset,"
  );
  fs.writeFileSync(p, code);
}

// 2. Fix UploadScreen.tsx to use setReport instead of setReportResult
p = '/Users/nghiatrang/G-nome/G-Nome/mobile/UploadScreen.tsx';
code = fs.readFileSync(p, 'utf8');
code = code.replace(/setReportResult/g, 'setReport');
fs.writeFileSync(p, code);

// 3. Fix ProcessingScreen.tsx to use setReport instead of setReportResult
p = '/Users/nghiatrang/G-nome/G-Nome/mobile/ProcessingScreen.tsx';
code = fs.readFileSync(p, 'utf8');
code = code.replace(/setReportResult/g, 'setReport');
fs.writeFileSync(p, code);

