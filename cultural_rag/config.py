"""
Shared configuration for the Cultural RAG module.

- Nebius client (OpenAI-compatible) for embeddings + generation
- USDA API key
- Cultural food seed map
- Condition list
"""

import os
from pathlib import Path
from openai import OpenAI
from dotenv import load_dotenv

# Load .env from project root (one level up — cultural_rag is now at root level)
_env_path = Path(__file__).resolve().parent.parent / ".env"
if _env_path.exists():
    load_dotenv(_env_path)

# Also try backend-level .env as fallback
_env_backend = Path(__file__).resolve().parent.parent / "backend" / ".env"
if _env_backend.exists():
    load_dotenv(_env_backend, override=False)

# ---------------------------------------------------------------------------
# Nebius client — OpenAI-compatible
# ---------------------------------------------------------------------------
NEBIUS_API_KEY = os.environ.get("NEBIUS_API_KEY", "")
NEBIUS_BASE_URL = os.environ.get(
    "NEBIUS_BASE_URL",
    "https://api.tokenfactory.nebius.com/v1/"
)

nebius_client = OpenAI(
    base_url=NEBIUS_BASE_URL,
    api_key=NEBIUS_API_KEY,
) if NEBIUS_API_KEY else None

# Model constants
EMBED_MODEL = "Qwen/Qwen3-Embedding-8B"
# Newest Qwen3 instruct (July 2025), 22B active MoE params, non-thinking — best for structured JSON output
GEN_MODEL = "Qwen/Qwen3-235B-A22B-Instruct-2507"
# Smaller instruct for classification tasks (verification pass) — same architecture, faster/cheaper
VERIFY_MODEL = "Qwen/Qwen3-30B-A3B-Instruct-2507"

# ---------------------------------------------------------------------------
# USDA FoodData Central
# ---------------------------------------------------------------------------
USDA_API_KEY = os.environ.get("USDA_API_KEY", "DEMO_KEY")
USDA_SEARCH_URL = "https://api.nal.usda.gov/fdc/v1/foods/search"

# ---------------------------------------------------------------------------
# Data directories
# ---------------------------------------------------------------------------
DATA_DIR = Path(__file__).resolve().parent / "data"
DATA_DIR.mkdir(exist_ok=True)
HANDCURATED_DIR = DATA_DIR / "handcurated"
HANDCURATED_DIR.mkdir(exist_ok=True)
SQL_DIR = Path(__file__).resolve().parent / "sql"
SQL_DIR.mkdir(exist_ok=True)

# ---------------------------------------------------------------------------
# Cultural food seed map — the foods to pull from USDA per culture
# ---------------------------------------------------------------------------
CULTURE_FOODS: dict[str, list[str]] = {
    # Each list is condition-first (clinically relevant) + cuisine-first (actually eaten daily).
    # The goal: foods where cultural dietary guidance adds real value for the tracked conditions.

    "East Asian": [
        # T2D concern: white rice — THE daily staple, primary glycemic concern
        "white rice",
        # T2D drug interaction + protective: bitter melon — hypoglycemic vegetable
        "bitter melon",
        # T2D/CAD/Alzheimer's protective: tofu — plant protein, isoflavones, calcium
        "tofu",
        # T2D protective substitute: shirataki — near-zero GI konjac noodle
        "shirataki noodles",
        # CAD concern: miso — high sodium (~3730mg/100g), also probiotic
        "miso",
        # MTHFR/folate protective: bok choy — folate (68mcg/100g), calcium, vitamin K
        "bok choy",
        # MTHFR protective: edamame — richest folate source (311mcg/100g cooked)
        "edamame",
        # Caffeine/Alzheimer's: green tea — EGCG, caffeine, L-theanine
        "green tea",
        # CAD concern: soy sauce — ubiquitous high-sodium condiment
        "soy sauce",
        # CAD/Alzheimer's protective: mackerel — omega-3 DHA/EPA, central fatty fish
        "mackerel",
        # CAD protective: wakame seaweed — fucoidan, omega-3, folate
        "wakame seaweed",
        # T2D/CAD protective: shiitake mushrooms — vitamin D (UV-exposed), lentinan, B vitamins
        "shiitake mushrooms",
        # T2D protective: sweet potato — lower GI (~54) than white rice, fiber, beta-carotene
        "sweet potato",
        # Iconic daily food protective: congee (rice porridge) — lower GI than plain rice, daily comfort meal
        "rice porridge",
        # CAD concern: pork belly — daily protein, saturated fat guidance
        "pork belly",
    ],
    "South Asian": [
        # MTHFR/T2D protective: red lentils — highest folate of common dals, low GI
        "red lentils",
        # T2D protective: whole wheat chapati — lower GI than naan or rice
        "whole wheat chapati",
        # Alzheimer's/drug interaction: turmeric — curcumin, CYP interactions
        "turmeric",
        # T2D drug interaction: fenugreek seeds — potentiates metformin
        "fenugreek seeds",
        # CAD concern: ghee — saturated fat, daily cooking fat
        "ghee",
        # T2D: basmati rice — lower GI (52) than regular rice, actual daily staple
        "basmati rice",
        # T2D/MTHFR protective: chickpeas — fiber, folate, low GI
        "chickpeas",
        # Lactose intolerance/calcium protective: plain yogurt — fermented, reduced lactose
        "plain yogurt",
        # MTHFR protective: spinach — folate (194mcg/100g raw), iron
        "spinach",
        # Drug interaction: amla — antiplatelet, warfarin interaction
        "amla",
        # Alzheimer's/anti-inflammatory: ginger — daily cooking ingredient
        "ginger",
        # CAD protective: mustard oil — omega-3 ALA cooking fat
        "mustard oil",
        # Iconic daily protective: moong dal (split mung beans) — lowest GI of all dals, digestible
        "mung beans",
        # CAD/T2D protective: coconut water — electrolytes, potassium, low calorie daily drink
        "coconut water",
        # T2D protective iconic: karela (bitter gourd) — South Asian cousin of bitter melon, hypoglycemic
        "bitter gourd",
    ],
    "Southeast Asian": [
        # T2D concern: jasmine rice — high GI (89), actual daily staple
        "jasmine rice",
        # CAD concern: fish sauce — ~700-1400mg sodium/tbsp, primary condiment
        "fish sauce",
        # T2D/CAD protective: tempeh — fermented soy, complete protein, probiotic
        "tempeh",
        # T2D protective: green papaya — low GI (~30), fiber, daily in salads
        "green papaya",
        # CAD concern: coconut milk — ~82% saturated fat, daily in curries
        "coconut milk",
        # Vitamin D/CAD protective: mackerel — omega-3, common fatty fish
        "mackerel",
        # Drug interaction concern: star fruit — caramboxin nephrotoxicity
        "star fruit",
        # MTHFR/folate protective: moringa leaves — exceptional folate, calcium, iron
        "moringa leaves",
        # T2D/MTHFR protective: mung beans — high folate, low GI
        "mung beans",
        # T2D protective: water spinach (rau muong/kangkong) — folate, iron, daily vegetable
        "water spinach",
        # Iconic daily protective: lemongrass — anti-inflammatory, liver-protective compounds
        "lemongrass",
        # T2D/CAD protective iconic: tofu — daily protein in Thai/Vietnamese/Indonesian cooking
        "tofu",
        # T2D protective: dragon fruit — fiber, low calorie, Vitamin C, daily tropical fruit
        "dragon fruit",
        # CAD concern: palm oil — high saturated fat, Malaysian/Indonesian cooking
        "palm oil",
        # T2D protective: taro root — moderate GI, resistant starch
        "taro root",
    ],
    "African": [
        # T2D: plantain — starchy staple, GI varies 40-74 (unripe=low, ripe=high)
        "plantain",
        # T2D concern: cassava — high GI (80-94), dominant West/Central African carb
        "cassava",
        # T2D/MTHFR/CAD protective: black-eyed peas — high folate, low GI protein
        "black-eyed peas",
        # T2D/CAD protective: sorghum — low GI whole grain, magnesium
        "sorghum",
        # CAD concern: palm oil — saturated fat, primary West African cooking fat
        "palm oil",
        # T2D protective iconic: okra — mucilage slows glucose absorption, daily vegetable
        "okra",
        # Vitamin D/CAD/MTHFR protective: sardines — eaten whole with bones, omega-3
        "sardines",
        # MTHFR/folate protective: amaranth leaves — high folate, iron, calcium
        "amaranth leaves",
        # T2D/CAD protective: millet — lower GI than cassava, magnesium
        "millet",
        # T2D: yam — moderate GI, cultural staple, better than cassava
        "yam",
        # Iconic daily protective: groundnuts (peanuts) — protein, MUFA, folate, daily snack
        "peanuts",
        # MTHFR/vitamin protective: moringa — highest calcium/folate/vitamin C of any common food
        "moringa leaves",
        # CAD/T2D protective iconic: cowpea leaves — high folate, iron, eaten across Africa
        "cowpea",
        # Alzheimer's/antioxidant: baobab fruit — exceptionally high Vitamin C, prebiotic fiber
        "baobab",
        # CAD concern: egusi melon seeds — high fat, protein, West African staple
        "egusi melon seeds",
    ],
    "Middle Eastern": [
        # T2D/CAD protective: bulgur wheat — very low GI (~46), high fiber whole grain
        "bulgur wheat",
        # T2D/MTHFR/CAD protective: chickpeas — fiber, folate, low GI, hummus base
        "chickpeas",
        # CAD protective (PREDIMED): olive oil — primary cooking and dipping fat
        "olive oil",
        # T2D concern iconic: dates — high sugar, extremely culturally significant (Ramadan)
        "dates",
        # CAD/Alzheimer's protective: pomegranate — anthocyanins, LDL oxidation
        "pomegranate",
        # Calcium/LDL protective: tahini — calcium, MUFA, daily condiment
        "tahini",
        # T2D/MTHFR/CAD protective: lentils — low GI, folate, Lebanese/Turkish/Persian staple
        "lentils",
        # Celiac concern/T2D protective: freekeh — high fiber, low GI, gluten grain
        "freekeh",
        # Lactose/calcium protective: labneh — reduced lactose, probiotic, daily with breakfast
        "labneh yogurt",
        # Drug interaction concern: licorice root — glycyrrhizin, antihypertensive interactions
        "licorice root",
        # CAD/T2D protective: walnuts — omega-3 ALA, LDL reduction
        "walnuts",
        # Iconic daily protective: za'atar herb blend — polyphenols, thymol, daily condiment
        "thyme",
        # CAD/Alzheimer's protective: almonds — MUFA, vitamin E, daily snack across Middle East
        "almonds",
        # T2D protective: eggplant (baba ganoush base) — fiber, low calorie, daily vegetable
        "eggplant",
        # MTHFR/CAD protective: parsley — extremely high folate (152mcg/100g), daily garnish
        "parsley",
    ],
    "European": [
        # T2D/CAD protective: pumpernickel/rye bread — GI ~41, arabinoxylan fiber, daily staple
        "pumpernickel bread",
        # CAD protective (PREDIMED): olive oil — Mediterranean primary fat
        "olive oil",
        # Lactose intolerance/calcium protective: kefir — fermented, reduced lactose, probiotic
        "kefir",
        # T2D/LDL protective: oats — beta-glucan, cholesterol lowering
        "rolled oats",
        # Vitamin D/CAD/Alzheimer's protective: salmon — omega-3, vitamin D
        "salmon",
        # CAD/LDL protective: walnuts — omega-3 ALA, MIND diet food
        "walnuts",
        # MTHFR/folate protective: lentils — high folate (179mcg/100g cooked)
        "lentils",
        # Alzheimer's protective: blueberries — anthocyanins, MIND diet key food
        "blueberries",
        # T2D/LDL protective: flaxseed — omega-3 ALA, lignans
        "flaxseed",
        # Drug interaction concern: St John's Wort — CYP3A4/2C9 inducer
        "St John's Wort",
        # CAD/T2D protective: sauerkraut — vitamin K, probiotics
        "sauerkraut",
        # Alzheimer's/CAD protective: dark chocolate — flavanols, European daily treat
        "dark chocolate",
        # Iconic daily protective: sourdough bread — lower GI than regular bread, prebiotic
        "sourdough bread",
        # CAD/Alzheimer's protective: sardines — omega-3, vitamin D, calcium (eaten whole)
        "sardines",
        # T2D/CAD/MTHFR protective iconic: buckwheat — gluten-free, complete protein, Eastern European
        "buckwheat",
    ],
    "Vietnamese": [
        # T2D: rice noodles — GI 61-68, pho/bun daily staple
        "rice noodles",
        # CAD concern: fish sauce — primary condiment, ~700-1400mg sodium/tbsp
        "fish sauce",
        # T2D drug interaction + protective: bitter melon (kho qua) — hypoglycemic
        "bitter melon",
        # MTHFR/folate protective: water spinach (rau muong) — folate, iron, daily vegetable
        "water spinach",
        # T2D protective: green papaya — low GI (~30), high fiber, in goi du du salad
        "green papaya",
        # Drug interaction concern: star fruit (khe) — caramboxin, renal/drug risk
        "star fruit",
        # CAD/Vitamin D protective: mackerel (ca thu) — omega-3, Vietnamese fish staple
        "mackerel",
        # Iconic daily food: pho broth — bone broth, collagen, low calorie, minimal fat base
        "bone broth",
        # MTHFR/folate protective iconic: mung bean sprouts — folate, daily pho garnish
        "mung bean sprouts",
        # Iconic daily protective: fresh herb plate (rau song) — mint, perilla, basil — antioxidants
        "fresh herbs",
        # CAD concern: pork belly — daily protein, saturated fat guidance
        "pork belly",
        # Caffeine/CYP1A2: coffee — Vietnamese ca phe is very strong, condensed milk form
        "coffee",
        # T2D/CAD protective iconic: lotus root — fiber, low GI, vitamin C, used in soups
        "lotus root",
        # CAD concern: shrimp paste (mam) — extremely high sodium condiment
        "shrimp paste",
        # T2D/CAD protective: tofu — daily protein in Vietnamese home cooking (dau hu)
        "tofu",
    ],
    "Korean": [
        # T2D concern: white rice — Korean daily staple, glycemic concern
        "white rice",
        # T2D/gut protective: kimchi — fermented, probiotic, glucose regulation evidence
        "kimchi",
        # T2D protective: sweet potato noodles (dangmyeon) — GI ~45, lower than wheat
        "sweet potato noodles",
        # CAD concern/probiotic: doenjang — high sodium fermented soybean paste, isoflavones
        "doenjang",
        # Drug interaction concern: ginseng — antiplatelet, warfarin interaction
        "ginseng",
        # CAD/LDL protective: sesame oil — PUFA finishing oil, ubiquitous
        "sesame oil",
        # MTHFR/folate/vitamin D protective: wakame seaweed — folate, iodine (miyeok-guk)
        "wakame seaweed",
        # CAD/Alzheimer's protective: mackerel — omega-3, very common in Korean cooking
        "mackerel",
        # MTHFR/folate protective: perilla leaves (kkaennip) — omega-3 ALA, folate, daily banchan
        "perilla leaves",
        # T2D protective iconic: Korean sweet potato (goguma) — baked/roasted, GI ~44, beloved snack
        "sweet potato",
        # Iconic daily protective: tofu jjigae — silken tofu, daily protein in Korean stew
        "silken tofu",
        # T2D/CAD protective: barley — beta-glucan, mixed into grain rice (japgokbap)
        "barley",
        # CAD concern: pork belly (samgyeopsal) — popular BBQ, saturated fat
        "pork belly",
        # Iconic daily protective: napa cabbage — banchan base, fiber, folate
        "napa cabbage",
        # CAD protective: bean sprouts (kongnamul) — daily banchan, folate, vitamin C
        "bean sprouts",
    ],
    "Japanese": [
        # T2D concern: white rice — THE Japanese staple, glycemic concern
        "white rice",
        # Drug interaction concern: natto — Vitamin K2 (MK-7, ~1000mcg/100g), warfarin
        "natto",
        # CAD concern/probiotic: miso — high sodium, fermented
        "miso",
        # T2D protective: soba noodles — GI ~54, lower than udon/ramen
        "soba noodles",
        # T2D protective: konjac/shirataki — near-zero GI, traditional Japanese food
        "konjac",
        # Vitamin D/CAD/Alzheimer's protective: salmon — omega-3, vitamin D
        "salmon",
        # MTHFR/folate protective: nori seaweed — folate, iodine, daily in onigiri/sushi
        "nori seaweed",
        # Alzheimer's/caffeine protective: matcha — EGCG, L-theanine
        "matcha",
        # CAD/Alzheimer's protective: mackerel (saba) — highest omega-3 fish in Japan
        "mackerel",
        # ALDH2 drug interaction concern: mirin — cooking wine ~14% alcohol
        "mirin",
        # Vitamin D protective: shiitake mushrooms — vitamin D when UV-exposed, daily ingredient
        "shiitake mushrooms",
        # T2D protective iconic: Japanese sweet potato (satsumaimo) — GI ~44, beloved daily snack
        "sweet potato",
        # Iconic daily protective: edamame — protein, folate, fiber, popular snack
        "edamame",
        # T2D protective: daikon radish — low calorie, digestive enzymes, daily condiment
        "daikon radish",
        # CAD/T2D protective: tofu — calcium-set, isoflavones, daily protein
        "tofu",
    ],
    "Brazilian": [
        # T2D/MTHFR protective: black beans — high folate, fiber, low GI daily staple
        "black beans",
        # T2D concern: white rice — paired with beans daily (feijao-arroz)
        "white rice",
        # Alzheimer's/CAD protective: acai — anthocyanins, antioxidants, low GI
        "acai",
        # T2D concern: cassava flour (farofa) — high GI, daily side
        "cassava flour",
        # Caffeine/drug interaction concern: guarana — ~200mg caffeine/100g, highest natural source
        "guarana",
        # CAD concern: palm oil (dende) — ~48% saturated fat, Bahian cooking
        "palm oil",
        # Selenium/LDL protective: Brazil nuts — highest selenium food, omega-3 ALA
        "Brazil nuts",
        # MTHFR/folate protective: collard greens (couve) — high folate, daily side dish
        "collard greens",
        # CAD/Vitamin D protective: sardines — omega-3, eaten fresh in coastal Brazil
        "sardines",
        # T2D protective: pumpkin (abobora) — fiber, beta-carotene, low GI
        "pumpkin",
        # Iconic daily protective: papaya — digestive enzymes, Vitamin C, eaten daily at breakfast
        "papaya",
        # CAD/T2D protective iconic: coconut water — potassium, electrolytes, natural Brazilian drink
        "coconut water",
        # T2D protective: mango — Vitamin C, fiber, beloved fruit (moderate GI ~55)
        "mango",
        # CAD concern: cured beef (charque) — high sodium, traditional regional staple
        "dried beef",
        # T2D/Alzheimer's protective: cacao — flavanols, Brazil is cacao origin country
        "cacao",
    ],
    "Mexican": [
        # T2D protective: corn tortillas — nixtamalized, GI ~52, calcium, lower than flour
        "corn tortillas",
        # T2D/MTHFR/CAD protective: black beans — folate, fiber, low GI daily staple
        "black beans",
        # T2D drug interaction protective: nopales — hypoglycemic, potentiates metformin
        "nopales cactus",
        # CAD protective/drug interaction: avocado — MUFA, potassium, vitamin K (warfarin)
        "avocado",
        # T2D/MTHFR/CAD protective: pinto beans — fiber, folate, low GI
        "pinto beans",
        # CAD protective: chili peppers — capsaicin, vasodilation
        "chili peppers",
        # CAD/LDL/MTHFR protective: pumpkin seeds (pepitas) — omega-3 ALA, magnesium
        "pumpkin seeds",
        # MTHFR/folate protective: amaranth — high folate, complete protein, traditional grain
        "amaranth",
        # CAD/T2D protective: hibiscus tea (agua de jamaica) — anthocyanins, blood pressure
        "hibiscus",
        # T2D/Vitamin D/CAD protective: tuna — omega-3, common in tostadas
        "tuna",
        # Iconic daily protective: squash (calabaza) — fiber, beta-carotene, low calorie
        "squash",
        # T2D protective iconic: sweet potato (camote) — lower GI than potato, street food
        "sweet potato",
        # CAD concern: chorizo — processed meat, high sodium, saturated fat
        "chorizo",
        # Calcium/lactose: cotija cheese — aged, reduced lactose, daily condiment
        "cotija cheese",
        # Alzheimer's/CAD protective: cacao — flavanols, Mexico is cacao origin
        "cacao",
    ],
    "Indian": [
        # MTHFR/T2D protective: red lentils (masoor dal) — highest folate of Indian dals
        "red lentils",
        # T2D protective: basmati rice — lower GI (52) than regular rice
        "basmati rice",
        # T2D drug interaction: fenugreek seeds — hypoglycemic, potentiates antidiabetics
        "fenugreek seeds",
        # Alzheimer's/drug interaction: turmeric — curcumin, CYP interactions
        "turmeric",
        # CAD concern: ghee — high saturated fat, daily cooking fat
        "ghee",
        # Lactose intolerance/calcium: paneer — fresh cheese, moderate lactose, calcium
        "paneer",
        # Drug interaction concern: amla — antiplatelet, warfarin interaction
        "amla",
        # CAD protective: mustard oil — omega-3 ALA, daily North Indian cooking fat
        "mustard oil",
        # MTHFR/folate protective: spinach (palak) — folate (194mcg/100g), iron
        "spinach",
        # Drug interaction concern: licorice root (mulethi) — in chai, pseudoaldosteronism
        "licorice root",
        # Alzheimer's protective: black pepper — piperine, curcumin bioavailability
        "black pepper",
        # T2D protective iconic: okra (bhindi) — mucilage, glucose absorption
        "okra",
        # Iconic daily protective: chana dal (split chickpeas) — lowest GI of all Indian dals
        "chickpea lentils",
        # T2D/CAD protective iconic: idli (fermented rice-lentil cake) — probiotic, lower GI than rice
        "lentils",
        # Alzheimer's/anti-inflammatory iconic: cardamom — polyphenols, daily in chai
        "cardamom",
    ],
    "Italian": [
        # T2D/CAD protective: whole wheat pasta — GI ~40-55, lower than most carbs
        "whole wheat pasta",
        # CAD protective (PREDIMED): extra virgin olive oil — strongest evidence food for CAD
        "extra virgin olive oil",
        # CAD/Vitamin D protective: sardines — omega-3, vitamin D, calcium (eaten whole)
        "sardines",
        # CAD/Alzheimer's protective: tomatoes — lycopene, LDL oxidation reduction
        "tomatoes",
        # T2D/MTHFR/CAD protective: cannellini beans — folate, fiber, low GI Italian staple
        "cannellini beans",
        # LDL/CAD protective: artichoke — cynarin, LDL lowering, prebiotic inulin
        "artichoke",
        # Calcium/lactose protective: parmesan — aged low-lactose, very high calcium daily
        "parmesan cheese",
        # Alzheimer's/CAD protective: walnuts — omega-3, MIND diet
        "walnuts",
        # Drug interaction concern: licorice (sambuca/amaro) — glycyrrhizin, hypertension
        "licorice",
        # Celiac concern: semolina — gluten-containing wheat, celiac risk
        "semolina",
        # CAD/Alzheimer's protective iconic: dark leafy greens (rapini/broccolini) — folate, vitamin K
        "broccoli",
        # Alzheimer's/CAD protective iconic: blueberries (mirtilli) — anthocyanins, MIND diet
        "blueberries",
        # T2D/CAD protective iconic: fennel — prebiotic inulin fiber, daily vegetable
        "fennel",
        # CAD/Vitamin D protective: mackerel — omega-3, Southern Italian cuisine
        "mackerel",
        # Iconic daily protective: extra virgin olive oil already listed; add lentil soup (ribollita base)
        "lentils",
    ],
    "German": [
        # T2D/CAD protective: pumpernickel bread — GI ~41, arabinoxylan fiber, defining German food
        "pumpernickel bread",
        # Drug interaction concern/probiotic: sauerkraut — vitamin K, fermented
        "sauerkraut",
        # Vitamin D/CAD protective: smoked mackerel — omega-3, vitamin D
        "smoked mackerel",
        # Drug interaction concern: St. John's Wort — CYP3A4/2C9 inducer, licensed antidepressant in Germany
        "St John's Wort",
        # T2D/LDL protective: barley — beta-glucan, cholesterol lowering
        "barley",
        # CAD/Alzheimer's protective: red cabbage — anthocyanins, vitamin C, daily side dish
        "red cabbage",
        # Calcium/lactose protective: quark — high protein, low fat, widespread German staple
        "quark dairy",
        # T2D/MTHFR/CAD protective: lentil soup (Linsensuppe) — folate, fiber, low GI
        "lentils",
        # CAD protective: beets — nitrates, blood pressure, folate
        "beets",
        # CAD concern: bratwurst — processed pork, high sodium, saturated fat
        "bratwurst",
        # Celiac concern: rye bread — secalin (rye gluten), common for HLA-DQ celiac variants
        "rye bread",
        # Iconic daily protective: whole grain bread (Vollkornbrot) — fiber, lower GI than white
        "whole grain bread",
        # CAD/Vitamin D protective iconic: herring (Hering) — omega-3, common German fish
        "herring",
        # T2D/CAD protective: spelt (Dinkel) — ancient grain, higher protein, lower GI
        "spelt grain",
        # Alzheimer's/CAD protective: walnuts — omega-3 ALA, MIND diet
        "walnuts",
    ],
}

CULTURE_HIERARCHY = {
    # Asian
    "Vietnamese": "Southeast Asian",
    "Filipino": "Southeast Asian",
    "Thai": "Southeast Asian",
    "Korean": "East Asian",
    "Japanese": "East Asian",
    "Chinese": "East Asian",
    "Indian": "South Asian",
    "Pakistani": "South Asian",
    
    # European
    "German": "European",
    "Italian": "European",
    "French": "European",
    "Greek": "European",
    
    # Latin American
    "Brazilian": "South American",
    "Mexican": "Latin American",
    "Caribbean": "Latin American",
    
    # African
    "Ethiopian": "African",
    "Nigerian": "African",
    
    # Middle Eastern
    "Turkish": "Middle Eastern",
    "Persian": "Middle Eastern",

    # Add identity fallbacks for the macro regions
    "East Asian": "East Asian",
    "South Asian": "South Asian",
    "Southeast Asian": "Southeast Asian",
    "African": "African",
    "Middle Eastern": "Middle Eastern",
    "European": "European",
    "South American": "South American",
    "Latin American": "Latin American"
}

# ---------------------------------------------------------------------------
# Conditions relevant to dietary recommendations
# Must match the genomic outputs the app actually produces.
# ---------------------------------------------------------------------------
CONDITIONS = [
    "Type 2 Diabetes",
    "coronary artery disease",
    "celiac disease",
    "caffeine metabolism",
    "vitamin D deficiency",
    "elevated LDL cholesterol",
    "alcohol metabolism",       # ALDH2 rs671 — flush reaction, cooking alcohol guidance
    "MTHFR folate",             # MTHFR rs1801133 — folate-rich food guidance
    "lactose intolerance",      # MCM6 rs4988235 — dairy alternatives per culture
    "Alzheimer's disease",      # APOE / PRS — MIND diet and cognitive health foods
]

# ---------------------------------------------------------------------------
# PubMed search queries — (culture, condition, search_terms)
# Filtered to systematic reviews and RCTs
# ---------------------------------------------------------------------------
PUBMED_QUERIES: list[tuple[str, str, str]] = [
    # East Asian
    ("East Asian", "Type 2 Diabetes", "East Asian diet type 2 diabetes glycemic rice"),
    ("East Asian", "coronary artery disease", "East Asian diet cardiovascular soy isoflavone"),
    ("East Asian", "caffeine metabolism", "CYP1A2 caffeine green tea East Asian"),
    ("East Asian", "vitamin D deficiency", "vitamin D East Asian dietary intake"),
    # South Asian
    ("South Asian", "Type 2 Diabetes", "South Asian diet diabetes metabolic syndrome"),
    ("South Asian", "coronary artery disease", "South Asian cardiovascular diet ghee turmeric"),
    ("South Asian", "vitamin D deficiency", "vitamin D South Asian deficiency diet"),
    ("South Asian", "elevated LDL cholesterol", "South Asian diet cholesterol lipid"),
    # Southeast Asian
    ("Southeast Asian", "Type 2 Diabetes", "Southeast Asian diet diabetes rice glycemic"),
    ("Southeast Asian", "coronary artery disease", "coconut oil cardiovascular Southeast Asian"),
    ("Southeast Asian", "caffeine metabolism", "caffeine metabolism Asian population"),
    # African
    ("African", "Type 2 Diabetes", "African diet diabetes cassava plantain glycemic"),
    ("African", "coronary artery disease", "African diet cardiovascular palm oil"),
    ("African", "vitamin D deficiency", "vitamin D African descent diet"),
    ("African", "elevated LDL cholesterol", "African diet cholesterol sorghum millet"),
    # Middle Eastern
    ("Middle Eastern", "Type 2 Diabetes", "Mediterranean Middle Eastern diet diabetes"),
    ("Middle Eastern", "coronary artery disease", "Mediterranean diet cardiovascular olive oil"),
    ("Middle Eastern", "celiac disease", "celiac disease Middle Eastern wheat freekeh"),
    ("Middle Eastern", "elevated LDL cholesterol", "Mediterranean diet LDL cholesterol"),
    # European
    ("European", "Type 2 Diabetes", "European diet diabetes whole grain oats"),
    ("European", "coronary artery disease", "European diet cardiovascular fermented dairy"),
    ("European", "celiac disease", "celiac disease European diet gluten free"),
    ("European", "elevated LDL cholesterol", "European diet cholesterol omega-3 flaxseed"),
    ("European", "caffeine metabolism", "CYP1A2 caffeine metabolism European"),
    # Vietnamese (Southeast Asian sub-cuisine)
    ("Vietnamese", "Type 2 Diabetes", "Vietnamese diet diabetes rice noodles pho glycemic Southeast Asian"),
    ("Vietnamese", "coronary artery disease", "Vietnamese diet cardiovascular sodium fish sauce nuoc mam hypertension"),
    ("Vietnamese", "elevated LDL cholesterol", "Vietnamese diet cholesterol lipid fermented traditional"),
    # Korean (East Asian sub-cuisine)
    ("Korean", "Type 2 Diabetes", "Korean diet diabetes kimchi fermented food glucose probiotic"),
    ("Korean", "coronary artery disease", "Korean traditional diet cardiovascular sodium kimchi doenjang"),
    ("Korean", "elevated LDL cholesterol", "Korean diet cholesterol lipid soybean fermented"),
    # Japanese (East Asian sub-cuisine)
    ("Japanese", "Type 2 Diabetes", "Japanese diet diabetes washoku traditional fish glycemic index"),
    ("Japanese", "coronary artery disease", "Japanese diet cardiovascular longevity omega-3 fish DHA EPA"),
    ("Japanese", "vitamin D deficiency", "Japanese diet vitamin D fish mushroom dietary intake"),
    # Indian (South Asian sub-cuisine)
    ("Indian", "Type 2 Diabetes", "Indian diet diabetes lentils dal roti glycemic vegetarian"),
    ("Indian", "vitamin D deficiency", "Indian vegetarian diet vitamin D deficiency supplementation"),
    ("Indian", "elevated LDL cholesterol", "Indian diet cholesterol mustard oil ghee cardiovascular"),
    # Italian (European sub-cuisine)
    ("Italian", "coronary artery disease", "Italian Mediterranean diet cardiovascular olive oil PREDIMED"),
    ("Italian", "celiac disease", "Italian diet celiac disease gluten pasta wheat alternative"),
    ("Italian", "Type 2 Diabetes", "Italian Mediterranean diet diabetes glycemic pasta"),
    # German (European sub-cuisine)
    ("German", "coronary artery disease", "German diet cardiovascular processed meat sausage rye bread"),
    ("German", "celiac disease", "German diet celiac gluten rye wheat bread sourdough"),
    ("German", "elevated LDL cholesterol", "German diet cholesterol lipid saturated fat sauerkraut"),
    # Brazilian (South American)
    ("Brazilian", "Type 2 Diabetes", "Brazilian diet diabetes black beans rice glycemic feijão"),
    ("Brazilian", "coronary artery disease", "Brazilian diet cardiovascular palm oil dendê acai"),
    ("Brazilian", "elevated LDL cholesterol", "Brazilian diet cholesterol lipid saturated fat"),
    # Mexican (Latin American)
    ("Mexican", "Type 2 Diabetes", "Mexican diet diabetes tortilla beans nopales prickly pear glycemic"),
    ("Mexican", "coronary artery disease", "Mexican traditional diet cardiovascular avocado legumes"),
    ("Mexican", "elevated LDL cholesterol", "Mexican diet cholesterol lipid avocado healthy fat"),
    # --- ALDH2 / alcohol metabolism ---
    ("East Asian", "alcohol metabolism", "ALDH2 deficiency alcohol flush East Asian diet cooking alcohol"),
    ("Korean", "alcohol metabolism", "ALDH2 variant alcohol metabolism Korean population dietary guidance"),
    ("Japanese", "alcohol metabolism", "ALDH2 deficiency Japanese diet mirin sake cooking alcohol"),
    ("Vietnamese", "alcohol metabolism", "ALDH2 alcohol flush Southeast Asian Vietnamese diet fermented"),
    ("South Asian", "alcohol metabolism", "alcohol metabolism South Asian ALDH2 dietary risk"),
    ("European", "alcohol metabolism", "alcohol metabolism European diet CYP2E1 genetic variation"),
    # --- MTHFR / folate ---
    ("East Asian", "MTHFR folate", "MTHFR folate deficiency East Asian diet leafy greens supplementation"),
    ("South Asian", "MTHFR folate", "MTHFR folate deficiency South Asian diet lentils dal"),
    ("European", "MTHFR folate", "MTHFR rs1801133 folate dietary intake supplementation"),
    ("African", "MTHFR folate", "MTHFR folate metabolism African diet beans greens"),
    ("Mexican", "MTHFR folate", "MTHFR folate deficiency Mexican diet beans corn folic acid"),
    ("Indian", "MTHFR folate", "MTHFR folate Indian vegetarian diet legumes supplementation"),
    # --- Lactose intolerance ---
    ("East Asian", "lactose intolerance", "lactose intolerance East Asian MCM6 dairy alternative diet"),
    ("African", "lactose intolerance", "lactose intolerance African population dairy alternative fermented"),
    ("South Asian", "lactose intolerance", "lactose intolerance South Asian fermented dairy yogurt tolerance"),
    ("Southeast Asian", "lactose intolerance", "lactose intolerance Southeast Asian dairy substitute plant milk"),
    ("European", "lactose intolerance", "lactose intolerance Northern European MCM6 rs4988235 dairy"),
    ("Mexican", "lactose intolerance", "lactose intolerance Latin American Mexican diet dairy"),
    # --- Alzheimer's disease / cognitive health ---
    ("East Asian", "Alzheimer's disease", "East Asian diet dementia Alzheimer cognitive health fish soy"),
    ("European", "Alzheimer's disease", "MIND diet Mediterranean dementia Alzheimer prevention"),
    ("South Asian", "Alzheimer's disease", "South Asian diet dementia cognitive health turmeric curcumin"),
    ("African", "Alzheimer's disease", "African diet dementia cognitive health leafy greens protective"),
    ("Japanese", "Alzheimer's disease", "Japanese diet dementia cognitive health fish omega-3 longevity"),
    ("Indian", "Alzheimer's disease", "Indian diet dementia cognitive turmeric curcumin Alzheimer"),
]
