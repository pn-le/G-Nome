const fs = require('fs');
const p = '/Users/nghiatrang/G-nome/G-Nome/mobile/ScanScreen.tsx';
let code = fs.readFileSync(p, 'utf8');

code = code.replace(
  'ImagePicker.launchCameraAsync',
  'ImagePicker.launchImageLibraryAsync'
);

// Also change the button text to "Upload Selfie" instead of "Take Selfie" to be clearer if they want
// But wait, "Take Selfie" is okay, let's change it to "Upload Selfie / Scan Mole"
code = code.replace(
  '{selfieResult ? "Retake Selfie" : "Take Selfie"}',
  '{selfieResult ? "Upload New Selfie" : "Upload Selfie"}'
);
code = code.replace(
  '{skinResult ? "Scan Another" : "Photograph a Mole"}',
  '{skinResult ? "Upload Another" : "Upload Mole Image"}'
);

fs.writeFileSync(p, code);
