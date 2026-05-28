const fs = require('fs');
const p = '/Users/nghiatrang/G-nome/G-Nome/mobile/ScanScreen.tsx';
let code = fs.readFileSync(p, 'utf8');

code = code.replace(
  'const uri = result.assets[0].uri;',
  'const uri = result.assets[0].uri;\n    const webFile = (result.assets[0] as any).file;'
);

code = code.replace(
  'const res = await analyzeSelfie(sessionId, uri);',
  'const res = await analyzeSelfie(sessionId, uri, webFile);'
);

code = code.replace(
  'const res = await analyzeSkin(sessionId, uri);',
  'const res = await analyzeSkin(sessionId, uri, webFile);'
);

fs.writeFileSync(p, code);
