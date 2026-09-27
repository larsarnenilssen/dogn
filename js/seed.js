'use strict';
/* ---------- startdata: det en ny bruker får før noe er endret ----------
   Dette er innhold, ikke grensesnitt. Brukeren kan endre alt i appen. */
const DEFAULT_PACK = ['Bleier, fire per barn', 'Våtservietter og stelleunderlag', 'Skift til alle', 'Mat, vann og smekker', 'Regntrekk og ullteppe', 'Ekstra lue og votter'];
const DEFAULT_PANTRY = ['Salt', 'Pepper', 'Olivenolje', 'Hvetemel', 'Kanel', 'Soyasaus'];
/* Faste varer: kommer på handlelisten igjen når det er gått så mange dager siden de sist ble handlet */
const DEFAULT_STAPLES = [['Melk', 7], ['Havregryn', 14], ['Frukt', 7], ['Brød', 7], ['Bleier', 7], ['Våtservietter', 14]];
const defaultStaples = () => DEFAULT_STAPLES.map(([text, every]) => ({ id: 'st-' + uid(), text, every, last: '' }));
const SEED_TASK_OFFSETS = { 't-stov-oppe': 0, 't-stov-nede': 2, 't-bad-oppe': 1, 't-bad-nede': 8, 't-bad': 3 };
const SEED_INGREDIENTS = {
  'd-pizza': ['Pizzabunn eller mel og gjær', 'Tomatsaus', 'Revet ost', 'Skinke', 'Paprika'],
  'd-taco': ['Kjøttdeig', 'Tacokrydder', 'Tortillalefser', 'Agurk', 'Tomat', 'Mais', 'Rømme', 'Revet ost'],
  'd-fiskekaker': ['Fiskekaker', 'Poteter', 'Gulrøtter', 'Smør'],
  'd-fiskeboller': ['Fiskeboller i hvit saus', 'Poteter', 'Gulrøtter'],
  'd-laks': ['Laksefilet', 'Poteter', 'Brokkoli', 'Smør'],
  'd-torsk': ['Torskefilet', 'Ris', 'Brokkoli', 'Gulrøtter'],
  'd-fiskegrateng': ['Fiskefilet', 'Makaroni', 'Melk', 'Hvetemel', 'Smør', 'Revet ost', 'Gulrøtter', 'Griljermel'],
  'd-kjottkaker': ['Kjøttdeig', 'Egg', 'Havregryn', 'Poteter', 'Erter', 'Melk'],
  'd-bolognese': ['Kjøttdeig', 'Spaghetti', 'Hakkede tomater', 'Gulrøtter', 'Løk', 'Revet ost'],
  'd-kyllinggryte': ['Kyllingfilet', 'Ris', 'Matfløte', 'Paprika', 'Brokkoli', 'Løk'],
  'd-kyllingovn': ['Kyllinglår', 'Søtpotet', 'Brokkoli', 'Olivenolje'],
  'd-kyllingwok': ['Kyllingfilet', 'Eggnudler', 'Wokgrønnsaker', 'Soyasaus'],
  'd-omelett': ['Egg', 'Melk', 'Paprika', 'Spinat', 'Revet ost', 'Grovbrød'],
  'd-tomatsuppe': ['Tomatsuppe', 'Makaroni', 'Egg'],
  'd-pannekaker': ['Hvetemel', 'Melk', 'Egg', 'Blåbær', 'Smør'],
  'l-risgrot': ['Grøtris', 'Helmelk', 'Kanel', 'Smør'],
  // Lagt til i v9
  'd-laksepasta': ['Laksefilet', 'Pasta', 'Spinat', 'Matfløte', 'Hvitløk', 'Sitron'],
  'd-fiskesuppe': ['Torskefilet', 'Poteter', 'Gulrøtter', 'Purre', 'Melk', 'Fiskebuljong'],
  'd-sei': ['Seifilet', 'Poteter', 'Melk', 'Smør', 'Erter'],
  'd-fiskegryte': ['Torsk eller sei', 'Kokosmelk', 'Paprika', 'Ris', 'Hvitløk', 'Ingefær'],
  'd-orret': ['Ørretfilet', 'Poteter', 'Agurk', 'Rømme', 'Dill'],
  'd-kyllingsuppe': ['Kyllingfilet', 'Gulrøtter', 'Purre', 'Stangselleri', 'Pasta', 'Kyllingbuljong'],
  'd-kyllingboller': ['Kyllingkjøttdeig', 'Egg', 'Havregryn', 'Hakkede tomater', 'Pasta', 'Løk'],
  'd-kyllingcurry': ['Kyllingfilet', 'Kokosmelk', 'Mild karri', 'Brokkoli', 'Ris', 'Løk'],
  'd-karbonader': ['Karbonadedeig', 'Løk', 'Poteter', 'Brokkoli'],
  'd-svinefilet': ['Svinefilet', 'Søtpotet', 'Aspargesbønner', 'Smør'],
  'd-burger': ['Kjøttdeig', 'Grove hamburgerbrød', 'Agurk', 'Tomat', 'Salat'],
  'd-linsesuppe': ['Røde linser', 'Gulrøtter', 'Løk', 'Hakkede tomater', 'Grønnsaksbuljong', 'Grovbrød'],
  'd-kikertgryte': ['Kikerter', 'Spinat', 'Hakkede tomater', 'Kokosmelk', 'Ris'],
  'd-pytt': ['Poteter', 'Løk', 'Paprika', 'Brokkoli', 'Egg'],
};

function seedDishes() {
  const D = (id, name, meal, minutes, cat, x = {}) => ({ id, name, meal, minutes, cat, weekday: x.weekday || 0, kids: x.kids || '', prep: x.prep || '', dayBefore: x.dayBefore || '', ingredients: (SEED_INGREDIENTS[id] || []).slice() });
  return [
    D('d-pizza',       'Pizza',                                   'dinner', 40, 'annet',   { weekday: 5, kids: 'Mindre ost og skinke på barnenes del. Skjær i strimler.', prep: 'Lag deigen og la den heve' }),
    D('d-taco',        'Taco',                                    'dinner', 25, 'kjott',   { weekday: 6, kids: 'Ta ut barnenes kjøttdeig før tacokrydderet. Grønnsaker i små biter, lefse i strimler.', prep: 'Kutt grønnsaker' }),
    D('d-fiskekaker',  'Fiskekaker med potet og gulrot',          'dinner', 25, 'fisk',    { kids: 'Velg fiskekaker med lite salt. Mos potet og gulrot.', prep: 'Skrell potet og gulrot' }),
    D('d-fiskeboller', 'Fiskeboller i hvit saus med potet',       'dinner', 25, 'fisk',    { kids: 'Del fiskebollene i små biter.', prep: 'Skrell potet og gulrot' }),
    D('d-laks',        'Laks i ovn med potet og brokkoli',        'dinner', 30, 'fisk',    { kids: 'Sjekk for bein. Mos laks og potet med litt smør.', prep: 'Skrell potet', dayBefore: 'Tin laks i kjøleskapet' }),
    D('d-torsk',       'Torsk i ovn med ris og grønnsaker',       'dinner', 30, 'fisk',    { kids: 'Sjekk for bein.', prep: 'Kutt grønnsaker', dayBefore: 'Tin torsk i kjøleskapet' }),
    D('d-fiskegrateng','Fiskegrateng med revet gulrot',           'dinner', 50, 'fisk',    { kids: 'Passer godt som den er.', prep: 'Kok makaroni og gjør gratengen klar til ovnen' }),
    D('d-kjottkaker',  'Kjøttkaker med potet og ertestuing',      'dinner', 40, 'kjott',   { kids: 'Lite salt i farsen. Lag noen små kaker til barnene.', prep: 'Skrell potet, lag farse' }),
    D('d-bolognese',   'Spaghetti bolognese med revet gulrot',    'dinner', 30, 'kjott',   { kids: 'Kutt spaghettien i biter. Lite salt.', prep: 'Riv gulrot og hakk løk' }),
    D('d-kyllinggryte','Mild kyllinggryte med ris',               'dinner', 30, 'kylling', { kids: 'Kutt kyllingen i små biter.', prep: 'Kutt kylling og grønnsaker' }),
    D('d-kyllingovn',  'Kyllinglår i ovn med søtpotet',           'dinner', 45, 'kylling', { kids: 'Fjern skinn og bein. Mos søtpoteten.', prep: 'Skrell og kutt søtpotet' }),
    D('d-kyllingwok',  'Mild kyllingwok med nudler',              'dinner', 20, 'kylling', { kids: 'Klipp nudlene. Ta ut barnenes porsjon før soyasaus.', prep: 'Kutt grønnsaker' }),
    D('d-omelett',     'Grønnsaksomelett med grovbrød',           'dinner', 15, 'vegetar', { kids: 'Stek eggene helt gjennom.' }),
    D('d-tomatsuppe',  'Tomatsuppe med makaroni og egg',          'dinner', 20, 'vegetar', { kids: 'La suppen kjøle seg. Kutt egget i biter.' }),
    D('d-pannekaker',  'Pannekaker med blåbær',                   'dinner', 30, 'vegetar', { kids: 'Lite sukker. Blåbærene moses eller deles.', prep: 'Rør røren og la den svelle' }),
    // Lagt til i v9: raske, sunne og gode, og lette å tilpasse små barn
    D('d-laksepasta',  'Pasta med laks, spinat og fløtesaus',     'dinner', 20, 'fisk',    { kids: 'Sjekk laksen for bein og kutt pastaen. Sitron og pepper på de voksnes porsjon.', prep: 'Kutt laksen i terninger' }),
    D('d-fiskesuppe',  'Fiskesuppe med torsk og grønnsaker',      'dinner', 25, 'fisk',    { kids: 'Lite buljong, så suppen blir mild. La den kjøle seg og sjekk for bein.', prep: 'Kutt potet, gulrot og purre' }),
    D('d-sei',         'Stekt sei med potetmos og erter',         'dinner', 25, 'fisk',    { kids: 'Mos seien inn i potetmosen. Knus ertene lett.', prep: 'Skrell poteter' }),
    D('d-fiskegryte',  'Mild fiskegryte med kokos og ris',        'dinner', 25, 'fisk',    { kids: 'Ta ut barnenes porsjon før eventuell chili. Del fisken i små biter.', prep: 'Kutt paprika og fisk' }),
    D('d-orret',       'Ørret i ovn med potet og agurksalat',     'dinner', 30, 'fisk',    { kids: 'Sjekk for bein. Agurk i staver er fint å holde.', prep: 'Skrell poteter' }),
    D('d-kyllingsuppe','Kyllingsuppe med grønnsaker og pasta',    'dinner', 30, 'kylling', { kids: 'Kutt kylling og grønnsaker smått. Lite buljong.', prep: 'Kutt kylling og grønnsaker' }),
    D('d-kyllingboller','Kyllingkjøttboller i tomatsaus med pasta','dinner', 30, 'kylling', { kids: 'Lag små boller. Lite salt i farsen.', prep: 'Lag farsen' }),
    D('d-kyllingcurry','Mild kyllingcurry med kokos og ris',      'dinner', 25, 'kylling', { kids: 'Bruk mild karri. Kutt kyllingen i små biter.', prep: 'Kutt kylling, løk og brokkoli' }),
    D('d-karbonader',  'Karbonader med løk, potet og brokkoli',   'dinner', 25, 'kjott',   { kids: 'Stek noen uten salt til barnene og kutt i biter.', prep: 'Skrell poteter og skjær løk' }),
    D('d-svinefilet',  'Svinefilet med søtpotetmos og bønner',    'dinner', 30, 'kjott',   { kids: 'Skjær kjøttet tynt og smått. Mos søtpoteten.', prep: 'Skrell søtpotet' }),
    D('d-burger',      'Hjemmelagde burgere med grovbrød',        'dinner', 25, 'kjott',   { kids: 'Små, flate burgere uten salt, godt gjennomstekt. Brød og grønnsaker i biter.', prep: 'Form burgerne' }),
    D('d-linsesuppe',  'Rød linsesuppe med gulrot og grovbrød',   'dinner', 25, 'vegetar', { kids: 'Kjør suppen glatt og bruk lite buljong.', prep: 'Kutt løk og gulrot' }),
    D('d-kikertgryte', 'Kikertgryte med spinat og ris',           'dinner', 25, 'vegetar', { kids: 'Mos kikertene lett.', prep: 'Kutt løk' }),
    D('d-pytt',        'Grønnsakspytt med stekt egg',             'dinner', 25, 'vegetar', { kids: 'Kutt i små biter. Stek eggene helt gjennom.', prep: 'Kutt poteter og grønnsaker i terninger' }),
    D('l-risgrot',     'Risgrynsgrøt',                            'lunch',  60, 'vegetar', { weekday: 6, kids: 'Lite eller ikke sukker og kanel på barnenes porsjon.', prep: 'Sett på grøten, den koker i ca. 45 min og må røres i' }),
  ];
}

/* Kategorier for aktivitetene som følger med. Brukes også når eldre data løftes til v10. */
const ACT_TAGS = {
  'a-gulv': ['rolig'], 'a-sang': ['sprak', 'rolig'], 'a-musikk': ['sprak', 'bevegelse'], 'a-hinder': ['bevegelse'],
  'a-skuff': ['hverdag', 'sanser'], 'a-vann': ['sanser'], 'a-tur': ['natur'], 'a-leke': ['bevegelse', 'sosialt'],
  'a-handel': ['hverdag'], 'a-bibl': ['sprak', 'sosialt'], 'a-besok': ['sosialt'],
  'a-bobler': ['sanser', 'bevegelse'], 'a-ball': ['bevegelse'], 'a-titt': ['rolig', 'sprak'], 'a-esker': ['bevegelse'],
  'a-sanse': ['sanser', 'rolig'], 'a-tromme': ['sprak'], 'a-putte': ['rolig'], 'a-stable': ['rolig'], 'a-maling': ['sanser'],
  'a-lese': ['sprak', 'rolig'], 'a-badelek': ['sanser'], 'a-kjokken': ['hverdag', 'sanser'], 'a-laken': ['bevegelse', 'sanser'],
  'a-teip': ['rolig'], 'a-speil': ['sprak', 'rolig'], 'a-skog': ['natur', 'bevegelse'], 'a-blader': ['natur', 'sanser'],
  'a-lykt': ['rolig', 'sanser'], 'a-havre': ['sanser'], 'a-is': ['sanser'], 'a-sansepose': ['sanser', 'rolig'], 'a-kontakt': ['sanser', 'rolig'],
  'a-torkle': ['sanser', 'rolig'], 'a-rulle': ['bevegelse', 'sanser'], 'a-gaa': ['bevegelse'], 'a-trapp': ['bevegelse'], 'a-bamse': ['sprak', 'rolig'],
  'a-album': ['sprak', 'rolig'], 'a-tegne': ['rolig'], 'a-vindu': ['sprak', 'rolig'], 'a-toy': ['hverdag'], 'a-rydde': ['hverdag'],
  'a-vannmal': ['sanser'], 'a-sno': ['natur', 'sanser'], 'a-kongler': ['natur', 'sanser'],
};
function seedActivities() {
  const A = (id, name, kind, minutes, x = {}) => Object.assign({ id, name, kind, minutes, weather: 'any', travel: 'hjemme', where: '', note: '', url: '', days: [], from: '', to: '', tags: (ACT_TAGS[id] || []).slice() }, x);
  return [
    A('a-gulv',    'Gulvlek med klosser og bøker', 'inne', 30),
    A('a-sang',    'Sang, rim og regler',          'inne', 15),
    A('a-musikk',  'Musikk og dans i stuen',        'inne', 15),
    A('a-hinder',  'Krabbeløype med puter',        'inne', 20, { note: 'Puter, madrass og en tunnel av stoler.' }),
    A('a-skuff',   'Utforske en trygg kjøkkenskuff', 'inne', 20, { note: 'Bokser, sleiver og lokk.' }),
    A('a-vann',    'Vannlek ved vasken',           'inne', 20, { note: 'Kopper og sil. Håndkle på gulvet.' }),
    A('a-tur',     'Trilletur i nærområdet',       'ute',  60, { travel: 'gange', note: 'Regntrekk og ullteppe.' }),
    A('a-leke',    'Lekeplass',                    'ute',  45, { weather: 'dry', travel: 'gange', note: 'Huske og sandkasse.' }),
    A('a-handel',  'Handletur med vogn',           'inne', 45, { travel: 'gange', note: 'Fint på regnværsdager.' }),
    A('a-bibl',    'Biblioteket',                  'inne', 45, { travel: 'gange', note: 'Bildebøker og lekekrok. Sjekk åpningstider.' }),
    A('a-besok',   'Besøk eller lekeavtale',       'inne', 90, { sickOk: false }),
    // Lagt til i v9: mest lek hjemme, som passer når barnene er rundt ett år
    A('a-bobler',  'Såpebobler',                   'inne', 15, { note: 'Blås over gulvet og la barnene jakte. Tørk opp etterpå, det blir glatt.' }),
    A('a-ball',    'Ballek',                       'inne', 20, { note: 'Rull, kast og samle baller i en kurv.' }),
    A('a-titt',    'Titt-tei og gjemmelek',        'inne', 15, { note: 'Gjem en leke under et håndkle eller bak en pute.' }),
    A('a-esker',   'Pappesker å krype i',          'inne', 20, { note: 'Store esker å krype gjennom og putte ting i.' }),
    A('a-sanse',   'Sansekurv',                    'inne', 20, { note: 'Trygge ting med ulike overflater: børste, stoff, tresleiv, kongle. Sitt ved siden av.' }),
    A('a-tromme',  'Trommer av kjeler',            'inne', 15, { note: 'Kjeler, lokk og tresleiver.' }),
    A('a-putte',   'Putte i boks',                 'inne', 15, { note: 'Store klosser eller baller i en boks med hull i lokket. Ingenting som kan svelges.' }),
    A('a-stable',  'Stable og velte',              'inne', 15, { note: 'Bygg tårn av kopper eller bokser som barnene kan velte.' }),
    A('a-maling',  'Fingermaling med yoghurt',     'inne', 20, { note: 'Yoghurt med litt matfarge på et brett. Rett i badet etterpå.' }),
    A('a-lese',    'Lesestund med pekebøker',      'inne', 15, { note: 'Bøker med store bilder og ting å kjenne på.' }),
    A('a-badelek', 'Badelek',                      'inne', 20, { note: 'Kopper og baller i badekaret. Gå aldri fra barnene.' }),
    A('a-kjokken', 'Være med på matlagingen',      'inne', 20, { note: 'Barnene i stolen med en skål, en skje og litt mat å smake på.' }),
    A('a-laken',   'Viftelek med laken',           'inne', 10, { note: 'Vift et laken over barnene, eller la en ball trille på det.' }),
    A('a-teip',    'Teip på gulvet',               'inne', 10, { note: 'Maskeringsteip i striper som barnene kan dra av.' }),
    A('a-speil',   'Speillek',                     'inne', 10, { note: 'Pek og si navnet på øyne, nese og munn.' }),
    A('a-skog',    'Rusletur i skogen',            'ute',  60, { weather: 'dry', travel: 'gange', note: 'Kjenne på mose, kongler og blader. Bæreseler er lettere enn vogn.' }),
    A('a-blader',  'Lek med høstblader',           'ute',  30, { weather: 'dry', note: 'Samle blader og kast dem i lufta, like utenfor døren.' }),
    // Lagt til i v11: flere hjemme, for barn rundt ett år
    A('a-lykt',     'Lommelykt og skygger',        'inne', 10, { note: 'Dempet lys, og lommelykten mot veggen og i taket. Fint i mørketiden.' }),
    A('a-havre',    'Tørrbad med havregryn',       'inne', 20, { note: 'Havregryn i en balje med kopper og skjeer. Ufarlig om noe havner i munnen.' }),
    A('a-is',       'Frosne leker i balje',        'inne', 15, { note: 'Frys store leker i vann kvelden før. Håndkle under baljen.' }),
    A('a-sansepose','Sansepose på gulvet',         'inne', 15, { note: 'To tette fryseposer med vann, matolje og litt farge, teipet fast i gulvet.' }),
    A('a-kontakt',  'Kontaktpapir på veggen',      'inne', 15, { note: 'Klebesiden ut, i sittehøyde. Store, myke ting å feste og dra av.' }),
    A('a-torkle',   'Tørklær ut av boks',          'inne', 10, { note: 'Tynne skjerf i en boks med hull i lokket.' }),
    A('a-rulle',    'Rulleløype for baller',       'inne', 15, { note: 'Papprør eller en planke mot sofaen, og store baller.' }),
    A('a-gaa',      'Gåtrening',                   'inne', 15, { note: 'Skyve en stol, en fylt eske eller en gåvogn over gulvet.' }),
    A('a-trapp',    'Trappeklatring',              'inne', 10, { note: 'Alltid med en voksen rett bak. Øv på å krabbe baklengs ned.' }),
    A('a-bamse',    'Stelle bamsen',               'inne', 15, { note: 'Mate, stryke, vaske og legge bamsen. Si hva dere gjør.' }),
    A('a-album',    'Fotoalbum med kjente ansikter', 'inne', 10, { note: 'Pek og si navnene.' }),
    A('a-tegne',    'Tegne med tykke fargestifter', 'inne', 10, { note: 'Store ark teipet fast i bordet. Tykke voksfarger.' }),
    A('a-vindu',    'Se ut vinduet',               'inne', 10, { note: 'Biler, busser, fugler og regn. Si navnene på det dere ser.' }),
    A('a-toy',      'Hjelpe med tøyvasken',        'inne', 10, { note: 'Putte klær i maskinen og ta dem ut igjen.' }),
    A('a-rydde',    'Rydde i kurven sammen',       'inne', 10, { note: 'Putte leker i kurven, med klapp når den er full.' }),
    A('a-vannmal',  'Male med vann',               'ute',  15, { weather: 'dry', note: 'Pensel og en kopp vann på trappen eller veggen utenfor døren.' }),
    A('a-sno',      'Snølek utenfor døren',        'ute',  20, { weather: 'cold', note: 'Foreslås bare når det er kaldt nok til snø.' }),
    A('a-kongler',  'Samle kongler og pinner',     'ute',  20, { note: 'I en bøtte like utenfor huset. Passer i sansekurven etterpå.' }),
  ];
}

function defaultPartner() {
  return {
    enabled: false, name: T.partner.defaultName, commute: 30,
    codes: {
      D: { label: 'Dagvakt', kind: 'work', start: '07:00', end: '15:00' },
      A: { label: 'Aftenvakt', kind: 'work', start: '14:30', end: '22:00' },
      N: { label: 'Nattevakt', kind: 'night', start: '21:15', end: '07:30' },
      F: { label: 'Fri', kind: 'off', start: '', end: '' }
    },
    shifts: {}, custom: {}, source: '', acks: {}
  };
}

function seedTemplates() {
  const T_ = (key, name, rows) => ({
    id: key, name,
    blocks: rows.map(([slot, type, start, title, x = {}]) => ({
      id: key + '.' + slot, slot, type, start, title,
      items: (x.items || []).map((t, i) => ({ id: key + '.' + slot + '.' + i, text: t })),
      boys: x.boys || '', adults: x.adults || '', note: x.note || '', link: x.link || '', role: x.role || ''
    }))
  });
  const morning = [
    ['morgen',     'prep',    '06:30', 'Forberedelser',     { items: ['Trakte kaffe', 'Varme melk', 'Lage havregrøt til frokost'] }],
    ['mme-morgen', 'meal',    '07:00', 'Henting og MME',    { boys: 'MME (flaske)', items: ['Bleieskift', 'Påkledning'], role: 'wake' }],
    ['vaken1',     'awake',   '07:15', 'Våkentid',          { note: 'Aktivitet inne' }],
    ['frokost',    'meal',    '08:15', 'Frokost',           { boys: 'Havregrøt', adults: 'Havregrøt' }],
  ];
  const evening = [
    ['kvelds',     'meal',    '17:30', 'Kvelds og middag',  { boys: 'Ferdiglaget', adults: 'Middag', link: 'dinner' }],
    ['vaken4',     'awake',   '18:00', 'Våkentid',          { note: 'Rolig inne' }],
    ['legg',       'routine', '18:30', 'Leggeforberedelse', { items: ['Tannpuss', 'Pysj'] }],
    ['legging',    'meal',    '19:00', 'MME og legging',    { boys: 'MME (flaske)', role: 'bedtime' }],
    ['kveld',      'routine', '19:30', 'Nullstilling',      { items: ['Blande MME til i morgen', 'Rydde spisestuen', 'Ta oppvask', 'Se over morgendagen'], role: 'reset' }],
  ];
  return {
    'to-lurer': T_('to-lurer', 'To lurer', [...morning,
      ['vaken-kort', 'awake',   '08:45', 'Våkentid',          { note: 'Stell og rolig lek' }],
      ['lur1',       'sleep',   '09:15', 'Lur',               { items: ['Dusj'] }],
      ['opp1',       'routine', '10:45', 'Opp',               { items: ['Bleieskift'] }],
      ['lunsj',      'meal',    '11:00', 'Lunsj',             { boys: 'Ferdiglaget', adults: 'Egen lunsj', link: 'lunch' }],
      ['vaken2',     'awake',   '11:30', 'Våkentid',          { note: 'Ute eller tur mens det er lyst' }],
      ['middag',     'meal',    '13:30', 'Middag',            { boys: 'Ferdiglaget' }],
      ['lur2',       'sleep',   '14:15', 'Lur',               {}],
      ['vaken3',     'awake',   '15:30', 'Våkentid',          {}],
      ...evening]),
    'en-lur': T_('en-lur', 'Én lur', [...morning,
      ['vaken2',     'awake',   '08:45', 'Våkentid',          { note: 'Ute eller tur mens det er lyst' }],
      ['lunsj',      'meal',    '11:15', 'Lunsj',             { boys: 'Ferdiglaget', adults: 'Egen lunsj', link: 'lunch' }],
      ['lur1',       'sleep',   '12:00', 'Lur',               { items: ['Dusj'] }],
      ['opp1',       'routine', '14:30', 'Opp',               { items: ['Bleieskift'] }],
      ['middag',     'meal',    '14:45', 'Middag',            { boys: 'Ferdiglaget' }],
      ['vaken3',     'awake',   '15:15', 'Våkentid',          {}],
      ...evening]),
  };
}

function seed() {
  const L0 = todayISO();
  return {
    version: DATA_VERSION,
    leave: { start: L0, end: addDays(L0, 91) },
    kids: [{ id: 'b1', name: 'Barn 1' }, { id: 'b2', name: 'Barn 2' }],
    place: null,
    partner: defaultPartner(),
    templates: seedTemplates(),
    schedule: [{ from: L0, templateId: 'to-lurer' }],
    tasks: [
      { id: 't-stov-oppe', text: 'Støvsuge oppe',    slot: 'lur1', type: 'sleep',   rule: { kind: 'interval', every: 7,  start: addDays(L0, 0) } },
      { id: 't-stov-nede', text: 'Støvsuge nede',    slot: 'lur1', type: 'sleep',   rule: { kind: 'interval', every: 7,  start: addDays(L0, 2) } },
      { id: 't-bad-oppe',  text: 'Vaske badet oppe', slot: 'lur1', type: 'sleep',   rule: { kind: 'interval', every: 14, start: addDays(L0, 1) } },
      { id: 't-bad-nede',  text: 'Vaske badet nede', slot: 'lur1', type: 'sleep',   rule: { kind: 'interval', every: 14, start: addDays(L0, 8) } },
      { id: 't-bad',       text: 'Bad',              slot: 'legg', type: 'routine', rule: { kind: 'interval', every: 6,  start: addDays(L0, 3) } },
    ],
    dishes: seedDishes(),
    activities: seedActivities(),
    menu: {},
    menuWeeks: {},
    settings: { fishPerWeek: 2, show: { nowbar: true, tomorrow: true, gear: true }, packList: DEFAULT_PACK.slice(), theme: 'dark', textSize: 1, kidsWord: T.kids.word, kidsDinnerDays: [], shopDay: 0, due: '', autoMenu: false },
    shop: { checked: {}, extra: [], pantry: DEFAULT_PANTRY.slice(), staples: defaultStaples(), cats: {}, boughtThrough: '', fromTakt: [] },
    appts: [],
    days: {},
    meta: { created: todayISO(), lastExport: null, setupDone: false }
  };
}
