const fs = require('fs');
const p = '/Users/nghiatrang/G-nome/G-Nome/mobile/ScanScreen.tsx';
let code = fs.readFileSync(p, 'utf8');

code = code.replace(
  '  Alert\n} from "react-native";\nimport { SafeAreaView } from "react-native-safe-area-context";',
  '  Alert,\n  SafeAreaView\n} from "react-native";'
);

// Also remove edges={["top"]} from SafeAreaView if present, since RN SafeAreaView doesn't support it
code = code.replace(/<SafeAreaView style={styles\.root} edges={\["top"\]}>/, '<SafeAreaView style={styles.root}>');
// And from bottom if present
code = code.replace(/edges={\["bottom"\]}/g, '');

fs.writeFileSync(p, code);
