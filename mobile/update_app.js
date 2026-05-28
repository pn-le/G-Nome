const fs = require('fs');
const p = '/Users/nghiatrang/G-nome/G-Nome/mobile/App.tsx';
let code = fs.readFileSync(p, 'utf8');

if (!code.includes('onPastSessionSelected')) {
  code = code.replace(
    'onFileSelected={() => setTimeout(() => setAppScreen(\'processing\'), 400)}',
    'onFileSelected={() => setTimeout(() => setAppScreen(\'processing\'), 400)}\n          onPastSessionSelected={() => setAppScreen(\'main\')}'
  );
  fs.writeFileSync(p, code);
}
