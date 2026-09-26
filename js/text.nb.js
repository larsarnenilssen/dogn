'use strict';
/* ============================================================
   Døgn – all tekst som vises i appen (bokmål).
   Skal en tekst endres, endres den her. Tekster som tar inn
   verdier, er små funksjoner. Flertall: plural(n, T.n.dag).
   Språkregel: felleskjønn (-en) for hankjønn og hunkjønn.
   Startdata (retter, aktiviteter, maler) ligger i seed.js.
   ============================================================ */
const T = {
  app: { name: 'Døgn', version: v => 'Døgn ' + v },

  date: {
    wd: ['søndag', 'mandag', 'tirsdag', 'onsdag', 'torsdag', 'fredag', 'lørdag'],
    wdShort: ['Man', 'Tir', 'Ons', 'Tor', 'Fre', 'Lør', 'Søn'],          // ISO 1–7
    mo: ['januar', 'februar', 'mars', 'april', 'mai', 'juni', 'juli', 'august', 'september', 'oktober', 'november', 'desember'],
    moShort: ['jan', 'feb', 'mar', 'apr', 'mai', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'des'],
    today: 'i dag',
    at: t => 'kl. ' + t,
  },
  unit: { min: 'min', hour: 't', minShort: 'm', daysAgo: n => n + ' d siden' },

  // Flertall: [entall, flertall]
  n: {
    dag: ['dag', 'dager'], bolk: ['bolk', 'bolker'], rett: ['rett', 'retter'], aktivitet: ['aktivitet', 'aktiviteter'],
    gjoremal: ['gjøremål', 'gjøremål'], punkt: ['punkt', 'punkter'], enkeltdag: ['enkeltdag', 'enkeltdager'],
  },

  types: { prep: 'Forberedelse', meal: 'Måltid', sleep: 'Søvn', awake: 'Våkentid', routine: 'Rutine' },
  roles: { '': 'Ingen', bedtime: 'Legging', reset: 'Nullstilling' },
  cats: { fisk: 'fisk', kjott: 'kjøtt', kylling: 'kylling', vegetar: 'vegetar', annet: 'annet' },
  meals: { dinner: 'Middag', lunch: 'Lunsj' },
  rates: { godt: 'godt', middels: 'middels', lite: 'lite' },
  travel: { hjemme: 'hjemme', gange: 'gå/vogn', kollektiv: 'buss/bybane', bil: 'bil' },
  kinds: { inne: 'inne', ute: 'ute' },
  health: { temp: 'Temperatur', med: 'Medisin', sym: 'Symptom', other: 'Annet' },
  wmo: { 0: 'klart', 1: 'lettskyet', 2: 'delvis skyet', 3: 'overskyet', 45: 'tåke', 48: 'tåke', 51: 'lett yr', 53: 'yr', 55: 'tett yr', 56: 'underkjølt yr', 57: 'underkjølt yr',
    61: 'lett regn', 63: 'regn', 65: 'kraftig regn', 66: 'underkjølt regn', 67: 'underkjølt regn', 71: 'lett snø', 73: 'snø', 75: 'kraftig snø', 77: 'snøkorn',
    80: 'lette regnbyger', 81: 'regnbyger', 82: 'kraftige regnbyger', 85: 'snøbyger', 86: 'kraftige snøbyger', 95: 'torden', 96: 'torden og hagl', 99: 'torden og hagl' },

  common: {
    close: 'Lukk', back: 'Tilbake', later: 'Senere', save: 'Lagre', del: 'Slett', add: 'Legg til', remove: 'Fjern', undo: 'Angre',
    name: 'Navn', type: 'Type', note: 'Notat', from: 'Fra', to: 'Til', date: 'Dato', time: 'Klokken', none: 'Ingen', noneYet: 'Ingen ennå.',
    yes: 'Ja', no: 'Nei', fromDate: 'Fra dato', minutes: 'Varighet (min)', nameSaved: 'Navn lagret', saved: 'Lagret',
    undone: label => 'Angret: ' + label,
  },

  kids: {
    word: 'barna',                        // standard samlebetegnelse
    both: 'Begge', all: 'Alle', and: ' og ',
    forKids: w => 'Til ' + w + ': ',
    eat: w => cap(w) + ' spiser',
    adults: 'Voksne', adultsEat: 'Voksne spiser',
  },

  top: {
    prev: 'Forrige dag', next: 'Neste dag', menu: 'Meny', fab: 'Legg til husk, avtale eller bolk',
    startsIn: 'start om', leave: 'perm', leaveDone: 'ferdig', day: 'dag', template: 'mal', sun: 'sol', today: 'Til i dag',
  },

  banner: {
    noStorage: 'Lagring er ikke tilgjengelig i denne nettleseren. Endringer forsvinner når siden lukkes.',
    syncError: e => 'Automatisk backup: ' + e, retry: 'Prøv igjen',
    lastSync: when => 'Siste backup til GitHub ' + when + '.', saveNow: 'Lagre nå',
    lastExport: days => 'Siste backup for ' + plural(days, T.n.dag) + ' siden.', noBackup: 'Ingen backup ennå.', export: 'Eksporter',
  },

  tl: {
    sunrise: 'Soloppgang', sunset: 'Solnedgang', sunriseRow: '↑ soloppgang ', sunsetRow: '↓ solnedgang ',
    empty: 'Dagen har ingen rubrikker. Legg til den første.',
    log: 'Dagslogg', week: 'Ukemeny', acts: 'Aktiviteter',
    allDone: 'alt gjort', left: dur => dur + ' igjen',
    moveAria: (title, start) => 'Flytt ' + title + ', starter ' + start,
    showAria: title => 'Vis ' + title, editAria: title => 'Rediger ' + title,
    dishAria: (meal, name) => meal + ': ' + name + '. Trykk for å bytte', swap: 'bytt',
    pickDish: 'Velg rett fra banken',
    partnerEats: (name, home) => name + (home ? ' spiser med' : ' spiser ikke med'),
    clothes: 'klær', clothesToday: 'klær i dag', ate: 'spiste',
    rememberFrom: d => 'Husk fra ' + d, late: n => plural(n, T.n.dag) + ' på etterskudd',
    openLog: 'Åpne dagslogg', shareReport: 'Del dagsrapport', exportBackup: 'Eksporter backup',
    shiftHead: today => 'Flytt denne og resten av ' + (today ? 'i dag' : 'dagen') + ' (min)', startsNow: 'Starter nå',
    moved: (title, delta) => title + ' flyttet ' + signed(delta), block: 'Rubrikken', alreadyNow: title => title + ' starter allerede nå',
  },

  sleep: {
    napLog: 'søvnlogg', nightLog: 'nattesøvn', notLogged: 'ikke logget', asleepAt: t => 'sovnet ' + t,
    asleep: 'Sovnet', awake: 'Våknet', nowAsleep: who => who + ' sovnet nå', nowAwake: who => who + ' våknet nå',
    fellAsleep: (who, t) => who + ' sovnet ' + t + '.', wokeUp: (who, t) => who + ' våknet ' + t + '.',
    nextBlock: 'Neste bolk', shiftNote: (title, start, delta) => ' ' + title + ' starter ' + start + ' (' + signed(delta) + ').',
  },

  nowbar: {
    left: (title, dur) => title + ', ' + dur + ' igjen', dayStarts: t => 'Dagen starter ' + t, awakeFor: d => ', våken ' + d,
    next: (t, title) => 'neste ' + t + ' ' + title, last: 'siste bolk i dag',
    woke: who => who + ' våknet', slept: who => who + ' sovnet',
    start: 'start nå', again: 'trykk igjen', startAria: 'Start neste bolk nå og flytt resten av dagen',
    started: (title, delta) => title + ' starter nå, resten av dagen flyttet ' + signed(delta), blockFallback: 'Bolken',
  },

  sheet: { dialog: 'Ark' },

  block: {
    newInTpl: 'Ny bolk i malen', inTpl: 'Bolk i malen', new: 'Ny rubrikk', edit: 'Rediger rubrikk', group: 'Rubrikk',
    starts: 'Starter', fromBank: 'Rett fra middagsbanken',
    linkOpts: { '': 'Nei, bruk teksten under', dinner: 'Ja, dagens middag', lunch: 'Ja, dagens lunsj' },
    bankHint: 'Når en rett fra banken er valgt for dagen, vises den i stedet for tekstene over.',
    role: 'Rolle',
    roleOpts: { '': 'Ingen', bedtime: 'Legging – nattesøvnen logges her', reset: 'Nullstilling – i morgen, dagsrapport og backup' },
    roleHint: 'Hver rolle brukes av én bolk om gangen. Velger du en rolle her, fjernes den fra de andre bolkene.',
    checklist: 'Sjekkliste', addItem: 'Legg til punkt', itemAria: 'Punkt i sjekklisten', removeItem: 'Fjern punkt',
    tasksHere: list => 'Gjøremål som går igjen vises også her: ' + list + '. De endres under Meny.',
    today: 'i dag', thisDay: 'denne dagen',
    delBlock: 'Slett bolken', delConfirmTpl: (title, tpl) => 'Slette «' + title + '» fra malen «' + tpl + '»?', delFromTpl: 'Slett fra malen',
    shiftHead: dayLbl => 'Flytt denne og resten av ' + dayLbl, shiftHint: dayLbl => 'Tall i minutter. Gjelder bare ' + dayLbl + '.',
    del: 'Slett rubrikk', delConfirm: (title, dayLbl, tpl) => 'Slette «' + title + '» bare ' + dayLbl + ', eller fra malen «' + tpl + '»?',
    delDay: dayLbl => 'Slett ' + dayLbl, saveTpl: 'Lagre i malen', saveDay: dayLbl => 'Lagre for ' + dayLbl,
    deletedTpl: 'Slettet fra malen', deletedDay: dayLbl => 'Slettet ' + dayLbl,
    savedTpl: tpl => 'Lagret i malen «' + tpl + '»', savedDay: dayLbl => 'Lagret for ' + dayLbl,
  },

  menu: {
    title: 'Meny', newBlock: 'Ny rubrikk', add: 'Husk eller avtale', dayTpl: 'Mal for dagen',
    follow: name => 'Følg planen (' + name + ')', only: name => name + ' bare denne dagen',
    saveDay: 'Lagre dagen som mal', undo: label => 'Angre: ' + label, reset: 'Tilbakestill dagen til malen',
    resetHint: 'Dagen har egne endringer i rubrikkene. Lagre dem som mal, eller tilbakestill. Avkrysninger og logg beholdes uansett.',
    food: 'Mat', week: 'Ukemeny', todayDish: name => 'I dag: ' + name, shop: 'Handleliste', shopMeta: 'Neste 7 dager fra ukemenyen',
    bank: 'Middagsbank', bankMeta: (n, fish) => plural(n, T.n.rett) + ', fisk ' + fish + ' ganger i uken',
    acts: 'Aktiviteter', library: 'Aktivitetsbibliotek',
    libraryMeta: (n, place) => plural(n, T.n.aktivitet) + (place ? ', vær for ' + place : ', velg sted i Profil for vær'),
    log: 'Logg', dayLog: 'Dagslogg', history: 'Oversikt', historyMeta: 'Søvn og legging siste 14 dager',
    setup: 'Oppsett', profile: 'Profil', partner: 'Partner og turnus',
    partnerMeta: (name, n) => name + ', ' + plural(n, T.n.dag) + ' i turnusen', off: 'Av',
    tasks: 'Gjøremål og huskeliste', tasksMeta: n => plural(n, T.n.gjoremal) + ' som går igjen',
    templates: 'Maler', backup: 'Backup', backupAuto: last => 'Automatisk til GitHub' + (last ? ', sist ' + last : ''),
    backupFile: d => 'Siste fil ' + d, backupNone: 'Ingen backup ennå',
    toastReset: 'Dagen følger malen igjen', toastUses: name => 'Dagen bruker ' + name, toastFollows: 'Dagen følger planen',
  },

  week: {
    title: 'Ukemeny', from: d => 'Uke fra ' + d, prev: 'Forrige uke', next: 'Neste uke',
    noDinner: 'ingen middag valgt', manual: ', valgt selv', lunch: name => 'lunsj: ' + name,
    partnerInfo: (name, shift, home) => name + ': ' + (shift || 'ingen vakt registrert') + (home ? ', spiser med' : ', spiser ikke med'),
    partnerEats: name => name + ' spiser med',
    hint: 'Trykk på en dag for å bytte rett. Faste retter står på sine dager, fisk spres utover uken, og ellers kommer retten som er spist for lengst siden.',
    shop: 'Handleliste for uken', regenHead: 'Lag menyen på nytt',
    regenHint: d => 'Gjelder dager fra og med i morgen (' + d + '). Retter du har valgt selv, beholdes.',
    regen: 'Lag ny meny fra i morgen', regenToast: d => 'Ny meny fra ' + d,
  },

  swap: {
    title: (meal, d) => meal + ' ' + d, current: 'Valgt nå', prep: 'Forberedelse: ', dayBefore: 'Dagen før: ',
    editDish: 'Rediger retten', toAuto: 'Tilbake til auto', noDish: 'Ingen rett', noneChosen: 'Ingen rett valgt for dagen.',
    toAutoLong: 'Tilbake til automatisk meny', other: 'Velg en annen', isNew: 'ny',
    hint: 'Sortert etter hvor lenge siden retten sto på menyen.',
    picked: (meal, d, name) => meal + ' ' + d + ': ' + name, none: meal => 'Ingen ' + meal.toLowerCase() + ' valgt', auto: 'Automatisk meny for dagen',
  },

  dish: {
    meta: (min, cat, wd) => min + ' min, ' + cat + (wd ? ', fast ' + wd : ''),
    bankTitle: 'Middagsbank', dinners: 'Middager', newDinner: 'Ny middag', lunches: 'Lunsjer', newLunch: 'Ny lunsj',
    lunchHint: 'Lunsj kommer bare på menyen på faste dager, eller når du velger den selv.', none: 'Ingen retter ennå.',
    fish: 'Fisk', fishPerWeek: 'Fiskemiddager per uke',
    fishHint: 'Gjelder uker som lages etter endringen. Bruk «Lag ny meny» i ukemenyen for å oppdatere uker som allerede er laget.',
    fishToast: n => 'Fisk ' + n + ' ganger i uken',
    new: 'Ny rett', edit: 'Rediger rett', group: 'Rett', namePh: 'For eksempel Fiskepudding med potet', meal: 'Måltid', minutes: 'Tid (min)',
    weekday: 'Fast dag', ingredients: 'Ingredienser', ingAria: 'Ingredienser, én per linje', ingPh: 'Én vare per linje', ingHint: 'Brukes til handlelisten.',
    forKids: w => 'Til ' + w, kidsAria: w => 'Tilpasning til ' + w, kidsPh: 'For eksempel lite salt, ta ut porsjonen før krydder',
    prep: 'Forberedelse', prepNap: 'I luren før måltidet', prepPh: 'For eksempel skrell potet', dayBefore: 'Kvelden før', dayBeforePh: 'For eksempel tin fisken',
    del: 'Slett rett', delConfirm: name => 'Slette «' + name + '» fra banken? Dager der den står på menyen får ny rett neste gang menyen lages.',
    save: 'Lagre rett', deleted: 'Rett slettet', savedToast: 'Rett lagret',
    genPrep: (meal, name) => 'Forberede ' + meal.toLowerCase() + ': ' + name,
    ahead: text => 'Til i morgen: ' + text, aheadSub: (meal, name) => meal + ': ' + name,
  },

  backupTask: { text: 'Ta backup', sub: 'Eksporter fil og lagre den i iCloud Drive eller Filer' },

  log: {
    title: d => 'Dagslogg ' + d, naps: 'Lurer', total: d => 'totalt ' + d, ongoing: 'pågår', noNaps: 'ingen lurer logget',
    napsHint: 'Lurer logges med knappene i søvnbolkene. Trykk på en lur for å endre tidene.', napFallback: 'lur',
    night: 'Natt', asleepEve: 'Sovnet i kveld', wokeMorning: 'Våknet i morgen',
    health: 'Helse', isSick: name => name + ' er syk',
    healthHint: 'For temperatur, medisin og symptomer. Appen gir ikke råd om dosering. Når et barn er sykt, foreslås bare aktiviteter hjemme.',
    meals: 'Måltider', noMeals: 'Ingen måltider i dagens plan.', ratesHint: 'Trykk for å veksle mellom godt, middels og lite.',
    noteAria: 'Notat for dagen', notePh: 'Hva gikk bra, hva bør endres?', share: 'Del dagsrapport',
    healthToast: (kid, kind, value, time) => 'Helse: ' + kid + ', ' + kind.toLowerCase() + (value ? ' ' + value : '') + ' kl. ' + time,
  },

  nap: {
    title: (kid, blk) => kid + ', ' + blk, times: 'Tider', del: 'Slett luren fra loggen', saved: 'Lur lagret', deleted: 'Lur slettet fra loggen',
  },

  history: {
    title: 'Oversikt', chart: 'Lur per dag', avg: 'Snitt', last14: 'Siste 14 dager',
    thDay: 'dag', thNap: k => 'lur ' + k, thEve: k => 'kveld ' + k, sick: 'syk',
    hint: 'Trykk på en dag for å åpne dagsloggen. # betyr at dagen har notat. Grafen og snittene viser tendenser. Kortere lur 2, senere legging eller lang våkentid før 1. lur kan være tegn på at det nærmer seg én lur.',
    chartAria: n => 'Lur per dag, siste ' + n + ' dager. Se tabellen under for tallene.', axis: h => h + 't',
    statsHead: 'snitt', statNap: 'lur per dag', statCount: 'antall lurer', statFirst: 'våken før 1. lur', statBed: 'sovnet om kvelden',
    statsHint: 'Siste 7 dager, forrige 7 i parentes. «Våken før 1. lur» krever at du fører «våknet» for natten i dagsloggen.',
  },

  tasks: {
    title: 'Gjøremål', pending: 'Huskeliste', recurring: 'Går igjen', new: 'Nytt gjøremål', remember: 'Husk noe',
    once: d => 'Én gang, ' + d, daily: 'Hver dag', noDays: 'Ingen dager valgt', weekly: 'Hver uke', biweekly: 'Annenhver uke', every: n => 'Hver ' + n + '. dag',
    edit: 'Rediger gjøremål', group: 'Gjøremål', ph: 'For eksempel Skifte sengetøy', often: 'Hvor ofte',
    kinds: { once: 'Én gang', daily: 'Hver dag', interval: 'Med fast mellomrom', weekdays: 'Faste ukedager' },
    everyLabel: 'Antall dager mellom hver gang',
    everyHint: prev => 'Telleren starter på nytt når du krysser av. Blir det ikke gjort, står det igjen til neste dag.' + (prev ? ' Sist gjort ' + prev + '.' : ''),
    weekdays: 'Ukedager', firstTime: 'Første gang', validFrom: 'Gjelder fra',
    shownIn: 'Vises i', shownHint: 'Finnes ikke rubrikken i malen som brukes, vises gjøremålet i første rubrikk av samme type.',
    del: 'Slett gjøremål', delConfirm: text => 'Slette «' + text + '»? Tidligere avkrysninger forsvinner fra oversikten.',
    save: 'Lagre gjøremål', deleted: 'Gjøremål slettet', savedToast: 'Gjøremål lagret',
  },

  tpl: {
    meta: (n, sch, days) => plural(n, T.n.bolk) + (sch.length ? ', i planen fra ' + sch.join(' og ') : ', ikke i planen') + (days ? ', ' + plural(days, T.n.enkeltdag) : ''),
    title: 'Maler', plan: 'Plan', range: (a, b) => a + ' til ' + b, onwards: d => d + ' og utover', unknown: '?',
    switchTo: 'Bytt til', addSwitch: 'Legg til bytte', list: 'Maler', new: 'Ny mal',
    fromDayHint: 'Vil du heller ta utgangspunkt i en dag du allerede har justert, bruk «Lagre dagen som mal» i menyen for den dagen.',
    switchRemoved: 'Bytte fjernet', fromToast: (name, d) => name + ' fra ' + d,
    group: 'Mal', namePh: 'For eksempel To lurer uten morgen-MME', startWith: 'Start med', copyOf: name => 'Kopi av ' + name, empty: 'Tom mal',
    newHint: 'Malen påvirker ingen dager før du legger den inn i planen. Du kan jobbe med den i ro og mak.',
    create: 'Lag mal', created: name => 'Mal «' + name + '» laget',
    blocks: 'Bolker', fromBank: 'rett fra banken', roleMeta: r => T.roles[r].toLowerCase(),
    isEmpty: 'Malen er tom. Legg til den første bolken.', newBlock: 'Ny bolk',
    editHint: 'Endringer her lagres rett i malen og gjelder alle dager som bruker den.',
    use: 'Bruk malen', inPlan: list => 'I planen fra ' + list + '.', notInPlan: 'Ikke i planen ennå.',
    useFrom: 'Bruk fra denne datoen', try: 'Se malen på en dag',
    tryHint: '«Se malen på en dag» viser malen i tidslinjen for datoen over, bare den dagen. Du kan angre med Meny › Mal for dagen.',
    copy: 'Kopier malen', del: 'Slett malen', onlyOne: 'Den eneste malen kan ikke slettes.', inUse: 'Malen er i bruk og kan ikke slettes. Fjern den fra planen først.',
    tryToast: (name, d) => name + ' ' + d, copied: 'Kopi laget', deleted: 'Mal slettet',
    saveDayTitle: 'Lagre dagen som mal',
    saveDayHint: n => plural(n, T.n.bolk) + ' med tidene, sjekklistene og notatene slik de står denne dagen.',
    modeNew: 'Ny mal fra en dato', modeReplace: name => 'Erstatt «' + name + '»', defaultName: (name, d) => name + ' fra ' + d,
    validFrom: 'Gjelder fra',
    newFromHint: 'Dager før denne datoen beholder den gamle rytmen. Står det et senere bytte i planen, gjelder den nye malen fram til dit.',
    replaceHead: 'Erstatt malen',
    replaceHint: name => '«' + name + '» får dagens oppsett. Det gjelder alle dager som bruker malen, også tidligere dager uten egne endringer. Vil du beholde tidligere dager som de var, velg «Ny mal fra en dato».',
    save: 'Lagre mal', updated: name => '«' + name + '» oppdatert', validFromToast: (name, d) => '«' + name + '» gjelder fra ' + d,
  },

  file: {
    exported: 'Backup eksportert', downloaded: 'Backup lastet ned', exportFailed: 'Eksporten virket ikke i denne nettleseren.',
    imported: 'Backup importert', notReadable: 'Filen kunne ikke leses som backup.', readFailed: 'Filen kunne ikke leses.',
    notBackup: 'Filen er ikke en backup fra Døgn.', tooNew: 'Backupen er laget med en nyere versjon av Døgn.',
    rescued: 'Lagrede data kunne ikke leses. En kopi er tatt vare på. Hent inn siste backup under Meny › Backup.',
  },

  partner: {
    defaultName: 'Partner', off: ' fri', unknownCode: 'Ukjent kode',
    noShifts: 'Filen mangler vakter.', noLines: 'Fant ingen linjer med dato og vaktkode.', notRota: 'Filen kunne ikke leses som turnus.',
    imported: n => 'Turnus importert: ' + plural(n, T.n.dag), needTimes: list => 'Legg inn tider for: ' + list,
    title: 'Partner og turnus', group: 'Partner', on: 'Turnus er slått på', isOff: 'Turnus er slått av',
    nameInApp: 'Navn i appen', commute: 'Reisetid (min)', commuteHint: name => 'Reisetiden brukes til å avgjøre om ' + name + ' rekker middagen. Du kan alltid overstyre med knappen i middagsbolken.',
    importHead: 'Importer turnus', importBtn: 'Velg turnusfil',
    importHint: 'Tar imot en turnusfil fra Døgn, eller en tekstfil med én dag per linje, for eksempel «2026-10-01 D». Har du turnusen som PDF, kan Claude lage filen for deg. Dager i filen erstatter dager som allerede ligger inne.',
    codes: 'Vaktkoder', codeOff: 'fri', codeNight: 'natt ', noTimes: 'tider mangler', newCode: 'Ny vaktkode',
    next3: 'Neste tre uker', shiftAria: d => 'Vakt ' + d, emptyHint: 'Tom betyr ingen vakt registrert, og regnes som fri.',
    toastOff: 'Turnus slått av', toastOn: 'Turnus slått på', commuteSaved: 'Reisetid lagret', shiftToast: (d, v) => 'Vakt ' + d + ': ' + (v || 'ingen'),
    codeTitle: c => 'Vaktkode ' + c, code: 'Kode', kinds: { work: 'Vakt', night: 'Nattevakt', off: 'Fri' }, label: 'Beskrivelse',
    delCode: 'Slett vaktkode', saveCode: 'Lagre vaktkode', codeDeleted: c => 'Vaktkode ' + c + ' slettet', codeSaved: c => 'Vaktkode ' + c + ' lagret',
  },

  profile: {
    notChosen: 'Ikke valgt', welcome: 'Velkommen til Døgn', title: 'Profil',
    haveFile: 'Har du en backup eller startfil?', importFile: 'Importer fil', importHint: 'Ellers setter du opp appen under. Alt kan endres senere under Meny › Profil.',
    kids: 'Barn', addKid: 'Legg til barn',
    kidsWord: 'Samlebetegnelse', kidsWordHint: 'Brukes i teksten, for eksempel «Til barna» eller «Guttene spiser». Skriv for eksempel barna, guttene eller jentene.',
    place: 'Sted', searchPh: 'Søk etter sted, for eksempel Nesttun', searchAria: 'Søk etter sted', search: 'Søk', geo: 'Bruk posisjonen min',
    placeHint: 'Stedet brukes til værmelding, soloppgang og solnedgang.', home: 'Hjemme',
    searching: 'Søker …', notFound: 'Fant ikke stedet. Prøv et annet navn, eller bruk posisjonen din.', offline: 'Stedsøk virker ikke uten nett. Prøv igjen senere, eller bruk posisjonen din.',
    leave: 'Permisjon', first: 'Første dag', last: 'Siste dag',
    display: 'Visning', show: { nowbar: 'Nå-kort', tomorrow: 'I morgen i Nullstilling', gear: 'Klær og pakkeliste' },
    showHint: 'Slå av det du ikke bruker. Endringen lagres med en gang.',
    theme: 'Tema', themes: { dark: 'Mørkt', light: 'Lyst', auto: 'Følg telefonen' },
    textSize: 'Tekststørrelse', sizes: { 1: 'Normal', 1.1: 'Stor', 1.2: 'Ekstra stor' }, themeHint: 'Lyst tema er lettere å lese ute i dagslys.',
    rhythm: 'Dagsrytme', napsAria: 'Antall lurer', rhythmHint: 'Tidene i malen er et utgangspunkt. Juster dem i tidslinjen og lagre i malen.',
    partner: 'Partner med turnus', partnerHint: 'Med turnus vet appen hvilke dager dere spiser middag sammen. Selve turnusen importeres under Meny › Partner og turnus.',
    start: 'Start', save: 'Lagre profil',
    noGeo: 'Posisjon er ikke tilgjengelig her.', geoDenied: 'Fikk ikke tilgang til posisjonen. Søk etter stedet i stedet.',
    needName: 'Skriv inn minst ett navn.', checkDates: 'Sjekk permisjonsdatoene.', ready: 'Klar. God permisjon!', saved: 'Profil lagret',
  },

  sync: {
    commitMsg: stamp => 'Døgn backup ' + stamp,
    errors: { 401: 'Nøkkelen er ugyldig eller utløpt.', 403: 'Nøkkelen mangler tilgang til repoet.', 404: 'Fant ikke repoet eller filen. Sjekk eier, navn og at nøkkelen gjelder dette repoet.', 409: 'Konflikt ved lagring. Prøv igjen.', 422: 'GitHub avviste filen.' },
    errCode: c => 'GitHub svarte med feilkode ' + c + '.', noContact: 'Fikk ikke kontakt med GitHub. Prøver igjen senere.', noContactShort: 'Fikk ikke kontakt med GitHub.', unknown: 'Ukjent feil.',
    title: 'Backup', auto: 'Automatisk til GitHub', connectedTo: 'Koblet til ', file: path => ', fil ' + path + '.',
    lastSaved: s => 'Sist lagret ' + s + '.', notSaved: 'Ikke lagret ennå.', pending: ' Nye endringer venter.',
    saveNow: 'Lagre nå', pull: 'Hent backup fra GitHub', pullConfirm: 'Erstatte alt i appen med backupen fra GitHub?', replace: 'Erstatt', disconnect: 'Koble fra',
    intro: 'Valgfritt. Appen lagrer da en kopi i et privat GitHub-repo når du har gjort endringer, høyst én gang i timen, og når appen åpnes. Oppsett står i LESMEG.',
    owner: 'GitHub-bruker', repo: 'Repo', token: 'Tilgangsnøkkel', tokenHint: 'Nøkkelen lagres bare på denne telefonen og kommer ikke med i backupfiler.',
    connect: 'Koble til', connecting: 'Kobler til …', noSyncHint: 'Uten tilkobling står «Ta backup» som gjøremål hver søndag kveld.',
    fileHead: 'Backup til fil', lastFile: d => 'Siste fil ' + d + '.', noFile: 'Ingen fil eksportert ennå.', fileWhere: ' Lagre filen i iCloud Drive eller Filer.',
    export: 'Eksporter backup', import: 'Importer backup',
    saving: 'Lagrer …', saved: 'Lagret i GitHub', failed: 'Lagring feilet', pulled: 'Backup hentet fra GitHub', disconnected: 'Koblet fra GitHub',
    fillIn: 'Fyll inn bruker, repo og nøkkel.', publicRepo: 'Koblet til, men repoet er offentlig. Gjør det privat på GitHub.',
    connectedSaved: 'Koblet til og lagret', connectedFailed: 'Koblet til, men første lagring feilet',
  },

  wx: { deg: '°', mm: ' mm', wind: w => 'vind ' + w + ' m/s' },

  acts: {
    weather: 'vær', dark: ', mørkt', change: 'Bytt', more: 'Mer informasjon', suggestions: 'forslag', moreSugg: 'Flere forslag',
    suggestTitle: (s, e) => 'Forslag ' + s + '–' + e, noWeather: 'Ingen værmelding for dette tidspunktet.',
    fits: 'Passer nå', noHits: 'Ingen treff.', fitsLess: 'Passer mindre godt', fitsLessHint: 'Feil ukedag, for kort tid, mørkt eller for vått.',
    openLib: 'Åpne aktivitetsbiblioteket',
    title: 'Aktiviteter', inside: 'Inne', outside: 'Ute', new: 'Ny aktivitet',
    pack: 'Pakkeliste', packAria: 'Pakkeliste, ett punkt per linje', packHint: 'Ett punkt per linje. Listen dukker opp i bolken når du velger en aktivitet utenfor huset.',
    credit1: 'Forslagene i våkenbolkene velges ut fra været, dagslyset, faste tider og hva dere har gjort nylig. Værdata fra ', credit2: ' og MET Norge (CC BY 4.0).',
    packSaved: 'Pakkeliste lagret', packFor: name => 'Pakkeliste for ' + name,
    edit: 'Rediger aktivitet', group: 'Aktivitet', inOut: 'Inne eller ute', weatherLbl: 'Vær', anyWeather: 'Tåler regn', dry: 'Trenger opphold', travel: 'Reise',
    fixed: 'Faste tider', fixedHint: 'For tilbud med åpningstider, som babysang eller åpen barnehage. La stå tomt hvis aktiviteten passer når som helst.',
    details: 'Detaljer', where: 'Sted eller adresse', url: 'Lenke', del: 'Slett aktivitet', save: 'Lagre aktivitet', deleted: 'Aktivitet slettet', savedToast: 'Aktivitet lagret',
  },

  clothes: {
    warm: 'lett tøy og solhatt', mild: 'ull eller bomull innerst, fleece og tynn lue', cool: 'ull innerst, fleece, vindtett dress og lue',
    cold: 'ull innerst, ullgenser, vinterdress, lue, votter og ullsokker', frost: 'to lag ull, vinterdress, varm lue, votter og vognpose',
    wetFrost: 'vanntette votter og støvler', wet: 'regndress og støvler', pram: 'regntrekk på vognen', wind: 'vindtett ytterlag',
  },

  tomorrow: {
    head: d => 'i morgen, ' + d, weather: 'vær', light: 'lyst', lightRange: r => ', lyst ' + r, clothes: 'klær',
    home: ', spiser middag med dere', away: ', ikke hjemme til middag', lunch: 'lunsj', dinner: 'middag', tonight: text => '. ' + text + ' i kveld',
    firstNap: 'første lur', fixed: 'faste tilbud', appt: 'avtale', tasks: 'gjøremål', more: ' med flere',
  },

  report: {
    head: d => 'Døgn, ' + d, nap: list => 'lur ' + list, sleeping: s => 'fra ' + s + ', sover fortsatt', noNap: 'ingen lur logget', slept: t => '. Sovnet ' + t,
    food: 'Mat: ', did: 'Gjorde: ', dinner: 'Middag: ', appts: 'Avtaler: ', note: 'Notat: ',
    shareTitle: d => 'Døgn ' + d, copied: 'Dagsrapporten er kopiert', sheet: 'Dagsrapport', copyHint: 'Kopier teksten:',
  },

  appt: {
    tag: 'avtale', group: 'Avtale', what: 'Hva', whatPh: 'For eksempel Helsestasjonen', where: 'Sted',
    hint: 'Avtalen vises i tidslinjen og i «I morgen», uten å endre dagens bolker.',
    pickTime: 'Velg dato og klokkeslett.', saved: (d, t) => 'Avtale ' + d + ' kl. ' + t, save: 'Lagre avtale', del: 'Slett avtalen', deleted: 'Avtale slettet',
  },

  add: {
    title: 'Legg til', tabs: { husk: 'Husk', avtale: 'Avtale', helse: 'Helse', bolk: 'Bolk i dag' },
    healthHint: 'Barnet merkes som sykt for dagen. Dagsloggen viser alt.',
    remember: 'Husk', rememberAria: 'Hva skal du huske', rememberPh: 'For eksempel Kjøp bleier', when: 'Når',
    whenOpts: { lur: 'Neste lur', kveld: 'I kveld', morgen: 'I morgen' },
    rememberHint: 'Står som gjøremål til det er krysset av. Ligger også under Meny › Gjøremål.',
    blockHint: d => 'Legger til en ny bolk i tidslinjen for ' + d + '.', newBlock: 'Ny bolk',
    tonight: 'i kveld', inNap: t => 'i luren kl. ' + t, tomorrow: t => 'i morgen' + (t ? ' kl. ' + t : ''),
    remembered: (text, when) => 'Husk «' + text + '» ' + when,
  },

  shop: {
    title: 'Handleliste', range: (a, b) => a + ' til ' + b, prev: 'Forrige 7 dager', next: 'Neste 7 dager',
    empty: 'Ingen varer. Legg inn ingredienser på rettene i middagsbanken.', missing: list => 'Mangler ingredienser: ' + list + '.',
    other: 'Andre varer', addPh: 'For eksempel Bleier str. 4', addAria: 'Legg til vare', removeAria: name => 'Fjern ' + name,
    share: 'Del listen', clear: 'Nullstill avkrysninger', pantry: 'Har alltid hjemme', pantryAria: 'Varer som ikke skal på listen, én per linje',
    pantryHint: 'Én vare per linje. Disse kommer ikke på listen.', cleared: 'Avkrysninger nullstilt',
    text: (a, b) => 'Handleliste ' + a + '–' + b, copied: 'Listen er kopiert', cantShare: 'Kunne ikke dele listen her.',
  },

  sick: {
    who: names => 'Syk: ' + names, lastMed: t => 'Sist medisin ' + t, ago: d => ' (' + d + ' siden)', to: kid => ' til ' + kid,
    lastTemp: (v, t, kid) => 'Sist temperatur ' + v + ' kl. ' + t + ' (' + kid + ')', log: 'Logg',
    kid: 'Barn', what: 'Hva', value: 'Verdi eller notat', valuePh: '38,4 / Paracet 2,5 ml',
  },
};

/* Flertall: plural(3, T.n.dag) → «3 dager» */
function plural(n, forms) { return n + ' ' + forms[n === 1 ? 0 : 1]; }
