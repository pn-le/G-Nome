const fs = require('fs');
const p = '/Users/nghiatrang/G-nome/G-Nome/mobile/lib/api.ts';
let code = fs.readFileSync(p, 'utf8');

if (!code.includes('analyzeSkin')) {
  code += `\n
export async function analyzeSkin(sessionId: string, imageUri: string): Promise<any> {
  const formData = new FormData();
  formData.append('image', {
    uri: imageUri,
    type: 'image/jpeg',
    name: 'skin.jpg',
  } as any);

  const res = await fetch(\`\${API_BASE_URL}/api/cv/skin?session_id=\${sessionId}\`, {
    method: 'POST',
    body: formData,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error('Skin analysis failed: ' + text);
  }
  return await res.json();
}
`;
  fs.writeFileSync(p, code);
}
