'use strict';
/* ---------- startdata: det en ny bruker får før noe er endret ----------
   Dette er innhold, ikke grensesnitt. Brukeren kan endre alt i appen. */
const DEFAULT_PACK = ['Bleier, fire per barn', 'Våtservietter og stelleunderlag', 'Skift til alle', 'Mat, vann og smekker', 'Regntrekk og ullteppe', 'Ekstra lue og votter'];
const DEFAULT_PANTRY = ['Salt', 'Pepper', 'Olivenolje', 'Hvetemel', 'Kanel', 'Soyasaus'];
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
  'l-risgrot': ['Grøtris', 'Helmelk', 'Kanel', 'Smør']
};

function seedDishes() {
  const D = (id, name, meal, minutes, cat, x = {}) => ({ id, name, meal, minutes, cat, weekday: x.weekday || 0, kids: x.kids || '', prep: x.prep || '', dayBefore: x.dayBefore || '', ingredients: (SEED_INGREDIENTS[id] || []).slice() });
  return [
    D('d-pizza',       'Pizza',                                   'dinner', 40, 'annet',   { weekday: 5, kids: 'Mindre ost og skinke på barnas del. Skjær i strimler.', prep: 'Lag deigen og la den heve' }),
    D('d-taco',        'Taco',                                    'dinner', 25, 'kjott',   { weekday: 6, kids: 'Ta ut barnas kjøttdeig før tacokrydderet. Grønnsaker i små biter, lefse i strimler.', prep: 'Kutt grønnsaker' }),
    D('d-fiskekaker',  'Fiskekaker med potet og gulrot',          'dinner', 25, 'fisk',    { kids: 'Velg fiskekaker med lite salt. Mos potet og gulrot.', prep: 'Skrell potet og gulrot' }),
    D('d-fiskeboller', 'Fiskeboller i hvit saus med potet',       'dinner', 25, 'fisk',    { kids: 'Del fiskebollene i små biter.', prep: 'Skrell potet og gulrot' }),
    D('d-laks',        'Laks i ovn med potet og brokkoli',        'dinner', 30, 'fisk',    { kids: 'Sjekk for bein. Mos laks og potet med litt smør.', prep: 'Skrell potet', dayBefore: 'Tin laks i kjøleskapet' }),
    D('d-torsk',       'Torsk i ovn med ris og grønnsaker',       'dinner', 30, 'fisk',    { kids: 'Sjekk for bein.', prep: 'Kutt grønnsaker', dayBefore: 'Tin torsk i kjøleskapet' }),
    D('d-fiskegrateng','Fiskegrateng med revet gulrot',           'dinner', 50, 'fisk',    { kids: 'Passer godt som den er.', prep: 'Kok makaroni og gjør gratengen klar til ovnen' }),
    D('d-kjottkaker',  'Kjøttkaker med potet og ertestuing',      'dinner', 40, 'kjott',   { kids: 'Lite salt i farsen. Lag noen små kaker til barna.', prep: 'Skrell potet, lag farse' }),
    D('d-bolognese',   'Spaghetti bolognese med revet gulrot',    'dinner', 30, 'kjott',   { kids: 'Kutt spaghettien i biter. Lite salt.', prep: 'Riv gulrot og hakk løk' }),
    D('d-kyllinggryte','Mild kyllinggryte med ris',               'dinner', 30, 'kylling', { kids: 'Kutt kyllingen i små biter.', prep: 'Kutt kylling og grønnsaker' }),
    D('d-kyllingovn',  'Kyllinglår i ovn med søtpotet',           'dinner', 45, 'kylling', { kids: 'Fjern skinn og bein. Mos søtpoteten.', prep: 'Skrell og kutt søtpotet' }),
    D('d-kyllingwok',  'Mild kyllingwok med nudler',              'dinner', 20, 'kylling', { kids: 'Klipp nudlene. Ta ut barnas porsjon før soyasaus.', prep: 'Kutt grønnsaker' }),
    D('d-omelett',     'Grønnsaksomelett med grovbrød',           'dinner', 15, 'vegetar', { kids: 'Stek eggene helt gjennom.' }),
    D('d-tomatsuppe',  'Tomatsuppe med makaroni og egg',          'dinner', 20, 'vegetar', { kids: 'La suppen kjøle seg. Kutt egget i biter.' }),
    D('d-pannekaker',  'Pannekaker med blåbær',                   'dinner', 30, 'vegetar', { kids: 'Lite sukker. Blåbærene moses eller deles.', prep: 'Rør røren og la den svelle' }),
    D('l-risgrot',     'Risgrynsgrøt',                            'lunch',  60, 'vegetar', { weekday: 6, kids: 'Lite eller ikke sukker og kanel på barnas porsjon.', prep: 'Sett på grøten, den koker i ca. 45 min og må røres i' }),
  ];
}

function seedActivities() {
  const A = (id, name, kind, minutes, x = {}) => Object.assign({ id, name, kind, minutes, weather: 'any', travel: 'hjemme', where: '', note: '', url: '', days: [], from: '', to: '' }, x);
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
    shifts: {}
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
    ['mme-morgen', 'meal',    '07:00', 'Henting og MME',    { boys: 'MME (flaske)', items: ['Bleieskift', 'Påkledning'] }],
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
    settings: { fishPerWeek: 2, show: { nowbar: true, tomorrow: true, gear: true }, packList: DEFAULT_PACK.slice(), theme: 'dark', textSize: 1, kidsWord: T.kids.word },
    shop: { checked: {}, extra: [], pantry: DEFAULT_PANTRY.slice() },
    appts: [],
    days: {},
    meta: { created: todayISO(), lastExport: null, setupDone: false }
  };
}
