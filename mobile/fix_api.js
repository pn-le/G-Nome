const fs = require('fs');
const p = '/Users/nghiatrang/G-nome/G-Nome/mobile/lib/api.ts';
let code = fs.readFileSync(p, 'utf8');

// Fix analyzeSelfie
code = code.replace(
  'export async function analyzeSelfie(sessionId: string, imageUri: string): Promise<any> {',
  'export async function analyzeSelfie(sessionId: string, imageUri: string, webFile?: File): Promise<any> {'
);
const oldSelfieForm = `  const formData = new FormData();
  formData.append('image', {
    uri: imageUri,
    type: 'image/jpeg',
    name: 'selfie.jpg',
  } as any);`;
const newSelfieForm = `  const formData = new FormData();
  if (Platform.OS === 'web' && webFile) {
    formData.append('image', webFile, 'selfie.jpg');
  } else {
    formData.append('image', {
      uri: imageUri,
      type: 'image/jpeg',
      name: 'selfie.jpg',
    } as any);
  }`;
code = code.replace(oldSelfieForm, newSelfieForm);


// Fix analyzeSkin
code = code.replace(
  'export async function analyzeSkin(sessionId: string, imageUri: string): Promise<any> {',
  'export async function analyzeSkin(sessionId: string, imageUri: string, webFile?: File): Promise<any> {'
);
const oldSkinForm = `  const formData = new FormData();
  formData.append('image', {
    uri: imageUri,
    type: 'image/jpeg',
    name: 'lesion.jpg',
  } as any);`;
const newSkinForm = `  const formData = new FormData();
  if (Platform.OS === 'web' && webFile) {
    formData.append('image', webFile, 'lesion.jpg');
  } else {
    formData.append('image', {
      uri: imageUri,
      type: 'image/jpeg',
      name: 'lesion.jpg',
    } as any);
  }`;
code = code.replace(oldSkinForm, newSkinForm);

fs.writeFileSync(p, code);
