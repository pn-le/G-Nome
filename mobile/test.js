const fs = require('fs');
let code = fs.readFileSync('/Users/nghiatrang/G-nome/G-Nome/mobile/App.tsx', 'utf8');
code = code.replace(
  '<ScanScreen onTabPress={handleTabPress} />',
  '<ScanScreen onTabPress={handleTabPress} onNewUpload={() => setAppScreen("upload")} />'
);
fs.writeFileSync('/Users/nghiatrang/G-nome/G-Nome/mobile/App.tsx', code);
