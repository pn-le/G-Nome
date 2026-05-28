const fs = require('fs');
const p = '/Users/nghiatrang/G-nome/G-Nome/mobile/ScanScreen.tsx';
let code = fs.readFileSync(p, 'utf8');

// Replace ImagePicker with DocumentPicker
code = code.replace('import * as ImagePicker from "expo-image-picker";', 'import * as DocumentPicker from "expo-document-picker";');

// Replace the picker logic
const oldLogic = `const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
    });
    if (result.canceled) return;

    const uri = result.assets[0].uri;`;

const newLogic = `const result = await DocumentPicker.getDocumentAsync({
      type: ['image/jpeg', 'image/png', 'image/jpg'],
      copyToCacheDirectory: true,
      multiple: false,
    });
    if (result.canceled) return;

    const uri = result.assets[0].uri;`;

code = code.replace(oldLogic, newLogic);

// Add an inline error text just in case Alert fails
code = code.replace(
  'const [skinImage, setSkinImage] = useState<string | null>(null);',
  'const [skinImage, setSkinImage] = useState<string | null>(null);\n  const [errorMsg, setErrorMsg] = useState<string | null>(null);'
);

code = code.replace(
  `if (!sessionId) {
      Alert.alert('Error', 'No active session. Please upload a report first.');
      return;
    }`,
  `if (!sessionId) {
      setErrorMsg('No active session. Please upload a report first.');
      return;
    }
    setErrorMsg(null);`
);

// Add error message to UI
code = code.replace(
  '{/* Selfie Section */}',
  `{errorMsg && <Text style={{color: 'red', textAlign: 'center', marginBottom: 10, fontFamily: serifBold}}>{errorMsg}</Text>}
        {/* Selfie Section */}`
);

fs.writeFileSync(p, code);
