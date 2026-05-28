const fs = require('fs');
const p = '/Users/nghiatrang/G-nome/G-Nome/mobile/UploadScreen.tsx';
let code = fs.readFileSync(p, 'utf8');

// Add import for storage and ScrollView
if (!code.includes('import { getPastSessions, PastSession }')) {
  code = code.replace(
    "import { useApp } from './lib/AppContext';",
    "import { useApp } from './lib/AppContext';\nimport { getPastSessions, PastSession } from './lib/storage';\nimport { ScrollView } from 'react-native';"
  );
}

// Add onPastSessionSelected to Props
if (!code.includes('onPastSessionSelected?: () => void;')) {
  code = code.replace(
    "interface Props {\n  onFileSelected: () => void;\n}",
    "interface Props {\n  onFileSelected: () => void;\n  onPastSessionSelected?: () => void;\n}"
  );
  code = code.replace(
    "export default function UploadScreen({ onFileSelected }: Props) {",
    "export default function UploadScreen({ onFileSelected, onPastSessionSelected }: Props) {"
  );
}

// Add state for past sessions
if (!code.includes('const [pastSessions, setPastSessions]')) {
  code = code.replace(
    "const { setParseResult, setError } = useApp();",
    "const { setParseResult, setReportResult, setError } = useApp();\n  const [pastSessions, setPastSessions] = useState<PastSession[]>([]);"
  );
}

// Add useEffect to load past sessions
if (!code.includes('useEffect(() => {')) {
  code = code.replace(
    "const handleChooseFile = useCallback(async () => {",
    `React.useEffect(() => {
    getPastSessions().then(setPastSessions);
  }, []);

  const handleChooseFile = useCallback(async () => {`
  );
}

// Add UI for past sessions
if (!code.includes('Recent Records')) {
  const newUI = `
        <TouchableOpacity onPress={handleWhatIsThis} hitSlop={{ top: 12, bottom: 12, left: 20, right: 20 }}>
          <Text style={styles.whatIsThis}>What is this?</Text>
        </TouchableOpacity>
      </View>

      {pastSessions.length > 0 && (
        <View style={{ width: SCREEN_W - 40, marginTop: 20 }}>
          <Text style={{ fontSize: 14, fontWeight: '700', color: C.textSecondary, marginBottom: 10 }}>Recent Records</Text>
          <ScrollView style={{ maxHeight: 200 }}>
            {pastSessions.map(session => (
              <TouchableOpacity
                key={session.id}
                style={{
                  backgroundColor: C.surface,
                  padding: 16,
                  borderRadius: 12,
                  marginBottom: 10,
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.05,
                  shadowRadius: 5,
                  elevation: 2,
                  flexDirection: 'row',
                  alignItems: 'center'
                }}
                onPress={() => {
                  setParseResult(session.parse);
                  setReportResult(session.report);
                  if (onPastSessionSelected) onPastSessionSelected();
                }}
              >
                <Text style={{ fontSize: 24, marginRight: 12 }}>🧬</Text>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 13, fontWeight: '600', color: C.textPrimary }}>{session.fileName}</Text>
                  <Text style={{ fontSize: 11, color: C.textSecondary, marginTop: 2 }}>
                    {new Date(session.date).toLocaleDateString()} • {session.parse.snp_count.toLocaleString()} SNPs
                  </Text>
                </View>
                <Text style={{ fontSize: 18, color: C.green }}>→</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}
`;
  code = code.replace(
    `        <TouchableOpacity onPress={handleWhatIsThis} hitSlop={{ top: 12, bottom: 12, left: 20, right: 20 }}>
          <Text style={styles.whatIsThis}>What is this?</Text>
        </TouchableOpacity>
      </View>`,
    newUI
  );
}

fs.writeFileSync(p, code);
