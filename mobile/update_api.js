const fs = require('fs');
const path = require('path');

const apiPath = path.join('/Users/nghiatrang/G-nome/G-Nome/mobile/lib/api.ts');
let code = fs.readFileSync(apiPath, 'utf8');

if (!code.includes('analyzeSelfie')) {
  code += `\n
export async function analyzeSelfie(sessionId: string, imageUri: string): Promise<any> {
  const formData = new FormData();
  formData.append('image', {
    uri: imageUri,
    type: 'image/jpeg',
    name: 'selfie.jpg',
  } as any);

  const res = await fetch(\`\${API_BASE_URL}/api/cv/selfie?session_id=\${sessionId}\`, {
    method: 'POST',
    body: formData,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error('Selfie analysis failed: ' + text);
  }
  return await res.json();
}
`;
  fs.writeFileSync(apiPath, code);
  console.log("Updated api.ts");
} else {
  console.log("Already updated");
}
