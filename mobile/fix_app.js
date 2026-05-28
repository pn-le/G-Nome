const fs = require('fs');
const p = '/Users/nghiatrang/G-nome/G-Nome/mobile/App.tsx';
let code = fs.readFileSync(p, 'utf8');

if (!code.includes('CulturalPlanScreen')) {
  code = code.replace(
    "import PlanScreen from './PlanScreen';",
    "import PlanScreen from './PlanScreen';\nimport CulturalPlanScreen from './CulturalPlanScreen';"
  );
  
  code = code.replace(
    "type AppScreen = 'upload' | 'processing' | 'main' | 'chat' | 'plan';",
    "type AppScreen = 'upload' | 'processing' | 'main' | 'chat' | 'plan' | 'cultural';"
  );

  code = code.replace(
    "onOpenPlan={() => setAppScreen('plan')}",
    "onOpenPlan={() => setAppScreen('plan')}\n              onOpenCultural={() => setAppScreen('cultural')}"
  );

  code = code.replace(
    "      {appScreen === 'plan' && (\n        <PlanScreen onBack={() => setAppScreen('main')} />\n      )}",
    "      {appScreen === 'plan' && (\n        <PlanScreen onBack={() => setAppScreen('main')} />\n      )}\n\n      {appScreen === 'cultural' && (\n        <CulturalPlanScreen onBack={() => setAppScreen('main')} />\n      )}"
  );

  fs.writeFileSync(p, code);
}
