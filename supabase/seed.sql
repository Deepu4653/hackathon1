-- ============================================================================
-- X-FARM AI · reference seed data
-- ----------------------------------------------------------------------------
-- Contains ONLY reference/marketplace taxonomy and general agronomic reference
-- information for crops commonly grown in Andhra Pradesh.
--
-- It intentionally contains NO market prices. Mandi prices are ingested from a
-- named, dated, verifiable source (see scripts/import-market-prices.ts) so that
-- X-FARM AI can never display an invented price.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Marketplace categories
-- ---------------------------------------------------------------------------
insert into public.categories (slug, name_en, name_te, name_hi, kind, icon, sort_order) values
  ('paddy',        'Paddy / Rice',    'వరి',            'धान',            'produce', 'wheat',      10),
  ('maize',        'Maize',           'మొక్కజొన్న',      'मक्का',          'produce', 'wheat',      11),
  ('cotton',       'Cotton',          'పత్తి',           'कपास',           'produce', 'flower',     12),
  ('groundnut',    'Groundnut',       'వేరుశనగ',         'मूंगफली',        'produce', 'nut',        13),
  ('chilli',       'Chilli',          'మిరపకాయ',        'मिर्च',          'produce', 'pepper',     14),
  ('turmeric',     'Turmeric',        'పసుపు',           'हल्दी',          'produce', 'sparkles',   15),
  ('pulses',       'Pulses',          'పప్పు ధాన్యాలు',   'दालें',          'produce', 'bean',       16),
  ('vegetables',   'Vegetables',      'కూరగాయలు',        'सब्जियाँ',        'produce', 'carrot',     17),
  ('fruits',       'Fruits',          'పండ్లు',          'फल',             'produce', 'apple',      18),
  ('other-produce','Other produce',   'ఇతర పంటలు',       'अन्य उपज',       'produce', 'sprout',     19),

  ('seeds',        'Seeds',           'విత్తనాలు',       'बीज',            'input',   'sprout',     20),
  ('fertilizers',  'Fertilizers',     'ఎరువులు',         'खाद',            'input',   'flask',      21),
  ('pesticides',   'Crop protection', 'పంట సంరక్షణ',     'फसल सुरक्षा',    'input',   'spray-can',  22),
  ('tools',        'Tools & implements', 'పనిముట్లు',    'औज़ार',          'input',   'wrench',     23),
  ('irrigation',   'Irrigation',      'నీటిపారుదల',      'सिंचाई',         'input',   'droplets',   24),
  ('other-inputs', 'Other inputs',    'ఇతర పరికరాలు',    'अन्य सामग्री',   'input',   'package',    25),

  ('tractor',      'Tractor',         'ట్రాక్టర్',       'ट्रैक्टर',       'machinery', 'tractor',  30),
  ('harvester',    'Harvester',       'కోత యంత్రం',      'हार्वेस्टर',     'machinery', 'tractor',  31),
  ('power-tiller', 'Power tiller',    'పవర్ టిల్లర్',     'पावर टिलर',      'machinery', 'tractor',  32),
  ('sprayer',      'Sprayer',         'స్ప్రేయర్',       'स्प्रेयर',       'machinery', 'spray-can',33),
  ('seeder',       'Seeder / planter','విత్తే యంత్రం',    'बुवाई यंत्र',    'machinery', 'sprout',   34),
  ('thresher',     'Thresher',        'నూర్పిడి యంత్రం',  'थ्रेशर',         'machinery', 'settings', 35),
  ('rotavator',    'Rotavator',       'రోటవేటర్',        'रोटावेटर',       'machinery', 'settings', 36),
  ('trailer',      'Trailer',         'ట్రైలర్',         'ट्रेलर',         'machinery', 'truck',    37),
  ('pump',         'Irrigation pump', 'నీటి పంపు',       'सिंचाई पंप',     'machinery', 'droplets', 38),
  ('other-machinery','Other machinery','ఇతర యంత్రాలు',    'अन्य मशीनरी',    'machinery', 'settings', 39),

  ('soil-testing', 'Soil testing',    'నేల పరీక్ష',      'मृदा परीक्षण',   'service', 'flask',      40),
  ('drone-spraying','Drone spraying', 'డ్రోన్ పిచికారీ',  'ड्रोन छिड़काव',  'service', 'plane',      41),
  ('labour',       'Farm labour',     'వ్యవసాయ కూలీలు',  'खेत मज़दूर',     'service', 'users',      42),
  ('transport',    'Transport',       'రవాణా',           'परिवहन',         'service', 'truck',      43),
  ('agronomy-advice','Agronomy advice','వ్యవసాయ సలహా',   'कृषि सलाह',      'service', 'book-open',  44),
  ('other-services','Other services', 'ఇతర సేవలు',       'अन्य सेवाएँ',     'service', 'handshake', 45)
on conflict (slug) do update set
  name_en = excluded.name_en,
  name_te = excluded.name_te,
  name_hi = excluded.name_hi,
  kind    = excluded.kind,
  icon    = excluded.icon,
  sort_order = excluded.sort_order;

-- ---------------------------------------------------------------------------
-- Crop catalogue — general agronomic reference information.
-- Seasons use the standard Indian cropping calendar. Water need is expressed
-- as low / medium / high. Durations are typical ranges for the region and are
-- presented in the UI as guidance, never as a guarantee.
-- ---------------------------------------------------------------------------
insert into public.crops (slug, name_en, name_te, name_hi, category, seasons, duration_days, water_need, soil_types, sowing_months, notes) values
  ('paddy', 'Paddy', 'వరి', 'धान', 'cereal', '{kharif,rabi}', 120, 'high',
    '{clay,loamy,alluvial}', '{6,7,11,12}',
    'Needs standing water during establishment. Common in Krishna and Godavari deltas.'),
  ('maize', 'Maize', 'మొక్కజొన్న', 'मक्का', 'cereal', '{kharif,rabi}', 100, 'medium',
    '{loamy,sandy,red}', '{6,7,10,11}',
    'Widely grown for grain and fodder; responds well to timely irrigation.'),
  ('groundnut', 'Groundnut', 'వేరుశనగ', 'मूंगफली', 'oilseed', '{kharif,rabi}', 110, 'medium',
    '{sandy,red,loamy}', '{6,7,11,12}',
    'Requires well-drained soil; pod development suffers in waterlogged fields.'),
  ('cotton', 'Cotton', 'పత్తి', 'कपास', 'fibre', '{kharif}', 170, 'medium',
    '{black,red,loamy}', '{6,7}',
    'Long duration crop; monitoring for bollworm is important through the season.'),
  ('chilli', 'Chilli', 'మిరపకాయ', 'मिर्च', 'spice', '{kharif,rabi}', 150, 'medium',
    '{black,loamy,red}', '{6,7,9,10}',
    'Guntur district is a major chilli growing region; sensitive to water stress.'),
  ('turmeric', 'Turmeric', 'పసుపు', 'हल्दी', 'spice', '{kharif}', 240, 'high',
    '{loamy,red,alluvial}', '{5,6}',
    'Long duration rhizome crop; needs good drainage and heavy organic matter.'),
  ('sugarcane', 'Sugarcane', 'చెరకు', 'गन्ना', 'cash', '{perennial}', 330, 'high',
    '{loamy,alluvial,black}', '{1,2,6,7}', 'Perennial crop with high water demand.'),
  ('blackgram', 'Black gram', 'మినుములు', 'उड़द दाल', 'pulse', '{kharif,rabi}', 75, 'low',
    '{black,loamy,red}', '{6,7,10,11}', 'Short duration pulse, useful in rotation with rice.'),
  ('greengram', 'Green gram', 'పెసలు', 'मूंग', 'pulse', '{kharif,rabi,zaid}', 70, 'low',
    '{loamy,black,sandy}', '{2,3,6,7}', 'Short duration pulse that improves soil nitrogen.'),
  ('redgram', 'Red gram (tur)', 'కందులు', 'अरहर', 'pulse', '{kharif}', 160, 'low',
    '{black,red,loamy}', '{6,7}', 'Deep-rooted pulse; commonly intercropped.'),
  ('bengalgram', 'Bengal gram (chana)', 'శనగలు', 'चना', 'pulse', '{rabi}', 100, 'low',
    '{black,loamy}', '{10,11}', 'Rainfed rabi pulse in black soils.'),
  ('sesame', 'Sesame', 'నువ్వులు', 'तिल', 'oilseed', '{kharif,zaid}', 90, 'low',
    '{sandy,red,loamy}', '{2,3,6,7}', 'Tolerates light soils and low rainfall.'),
  ('jowar', 'Jowar (sorghum)', 'జొన్నలు', 'ज्वार', 'cereal', '{kharif,rabi}', 110, 'low',
    '{black,red,loamy}', '{6,7,9,10}', 'Drought tolerant millet used for grain and fodder.'),
  ('bajra', 'Bajra (pearl millet)', 'సజ్జలు', 'बाजरा', 'cereal', '{kharif,zaid}', 85, 'low',
    '{sandy,red,loamy}', '{6,7,2,3}', 'Hardy millet suited to low rainfall areas.'),
  ('tomato', 'Tomato', 'టొమాటో', 'टमाटर', 'vegetable', '{kharif,rabi}', 130, 'medium',
    '{loamy,red,black}', '{6,7,10,11}', 'Staking and drip irrigation improve fruit quality.'),
  ('onion', 'Onion', 'ఉల్లిపాయ', 'प्याज', 'vegetable', '{kharif,rabi}', 120, 'medium',
    '{loamy,black,red}', '{6,7,11,12}', 'Needs careful irrigation near maturity for good storage.'),
  ('brinjal', 'Brinjal', 'వంకాయ', 'बैंगन', 'vegetable', '{kharif,rabi}', 140, 'medium',
    '{loamy,black,red}', '{6,7,10,11}', 'Fruit borer management is the main yield risk.'),
  ('okra', 'Okra (bhendi)', 'బెండకాయ', 'भिंडी', 'vegetable', '{kharif,zaid}', 95, 'medium',
    '{loamy,sandy,red}', '{2,3,6,7}', 'Harvested repeatedly; needs regular picking.'),
  ('banana', 'Banana', 'అరటి', 'केला', 'fruit', '{perennial,kharif}', 330, 'high',
    '{loamy,alluvial}', '{6,7,2,3}', 'High water and nutrient demand; tissue-culture planting common.'),
  ('mango', 'Mango', 'మామిడి', 'आम', 'fruit', '{perennial}', 1825, 'low',
    '{red,loamy,black}', '{7,8}', 'Perennial orchard crop; flowering period is frost sensitive.'),
  ('sapota', 'Sapota', 'సపోటా', 'चीकू', 'fruit', '{perennial}', 1095, 'medium',
    '{red,loamy}', '{6,7}', 'Perennial fruit crop suited to coastal Andhra Pradesh.'),
  ('coconut', 'Coconut', 'కొబ్బరి', 'नारियल', 'plantation', '{perennial}', 1825, 'medium',
    '{sandy,loamy,alluvial}', '{6,7}', 'Long-term plantation crop; coastal belt friendly.')
on conflict (slug) do update set
  name_en = excluded.name_en,
  name_te = excluded.name_te,
  name_hi = excluded.name_hi,
  category = excluded.category,
  seasons = excluded.seasons,
  duration_days = excluded.duration_days,
  water_need = excluded.water_need,
  soil_types = excluded.soil_types,
  sowing_months = excluded.sowing_months,
  notes = excluded.notes;
