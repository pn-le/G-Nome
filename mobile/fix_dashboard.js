const fs = require('fs');
const p = '/Users/nghiatrang/G-nome/G-Nome/mobile/DashboardScreen.tsx';
let code = fs.readFileSync(p, 'utf8');

if (!code.includes('onOpenCultural')) {
  // Update Props
  code = code.replace(
    "interface Props {\n  onTabPress?: (tab: TabKey) => void;\n  onOpenChat?: () => void;\n  onOpenPlan?: () => void;\n}",
    "interface Props {\n  onTabPress?: (tab: TabKey) => void;\n  onOpenChat?: () => void;\n  onOpenPlan?: () => void;\n  onOpenReport?: (tab: number) => void;\n  onOpenCultural?: () => void;\n}"
  );

  code = code.replace(
    "export default function DashboardScreen({ onTabPress, onOpenChat, onOpenPlan }: Props) {",
    "export default function DashboardScreen({ onTabPress, onOpenChat, onOpenPlan, onOpenReport, onOpenCultural }: Props) {"
  );

  // Add the button
  const newButton = `
        </View>
        {/* Cultural Nutrition button */}
        <TouchableOpacity style={[styles.priorityCard, { marginBottom: 14, height: 80 }]} onPress={onOpenCultural} activeOpacity={0.8}>
          <View style={[styles.accentBar, { backgroundColor: '#0D9488' }]} />
          <View style={{ padding: 12, justifyContent: 'center', flex: 1 }}>
            <Text style={[styles.geneName, { fontFamily: serifBold, marginBottom: 4 }]}>🌏  Cultural Nutrition</Text>
            <Text style={[styles.priorityDesc, { fontFamily: serif }]}>Cuisine-aware food recs from your DNA</Text>
          </View>
        </TouchableOpacity>

        {/* ── Explore Reports ─────────────────────────────────────────── */}
`;
  code = code.replace(
    `        </View>\n\n        {/* ── Explore Reports ─────────────────────────────────────────── */}`,
    newButton
  );

  fs.writeFileSync(p, code);
}
