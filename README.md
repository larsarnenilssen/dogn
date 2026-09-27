# Døgn – oppsett

Døgn er en dagsplan for foreldrepermisjon. Appen er en nettside som legges på hjemskjermen og virker uten nett. Alt du legger inn, lagres på telefonen din. Andre som åpner samme adresse, får sin egen, tomme app.

## Filer som skal ligge i det offentlige repoet

| Fil eller mappe | Hva den gjør |
|---|---|
| `index.html` | Siden som åpnes. Laster stilene og skriptene under |
| `styles/tokens.css` | Alle farger, tekststørrelser, avstander og hjørner |
| `styles/app.css` | Oppsett og utseende, bygget på verdiene i `tokens.css` |
| `js/text.nb.js` | All tekst som vises i appen |
| `js/version.js` | Versjonsnummer og listen over filer som lagres for bruk uten nett |
| `js/seed.js` | Startdata: maler, retter og aktiviteter en ny bruker får |
| `js/migrate.js`, `js/store.js` | Oppgradering og kontroll av data, lagring og angre |
| `js/domain/` | Regler: dagsplan, gjøremål, meny, logg, vær, aktiviteter, turnus og backup |
| `js/views/` | Det som vises: tidslinjen og arkene |
| `js/app.js` | Knapper, sveiping og oppstart |
| `sw.js` | Gjør at appen virker uten nett |
| `manifest.webmanifest`, ikonene | Navn og ikon på hjemskjermen |
| `tests/` | Automatiske tester (se nederst) |

Last aldri opp backupfiler, startfiler eller turnusfiler hit. Repoet er offentlig.

## 1. Legg ut appen med GitHub Pages

1. Logg inn på github.com og velg **New repository**. Kall det for eksempel `dogn` og velg **Public**.
2. I repoet: **Add file → Upload files**. Dra inn filene og mappene i tabellen over og trykk **Commit changes**.
3. **Settings → Pages**. Velg Source **Deploy from a branch**, Branch **main**, mappe **/(root)**, og trykk **Save**.
4. Etter et par minutter står adressen øverst, typisk `https://<brukernavn>.github.io/dogn/`.

## 2. Legg den på hjemskjermen

- iPhone: åpne adressen i **Safari**, trykk **Del → Legg til på Hjem-skjerm**, og bruk alltid appen fra ikonet.
- Android: åpne i Chrome, meny → **Installer app**.

Første gang du åpner appen, kommer oppsettet: barnas navn og hva appen skal kalle dem samlet (for eksempel «barnene» eller «guttene»), sted, permisjonsdatoer, antall lurer og om partneren har turnus. Har du en startfil eller backup, velger du **Importer fil** i stedet.

## 3. Backup

Du velger selv én av to måter under **Meny → Backup**.

### A. Automatisk til et privat GitHub-repo (anbefalt)

1. Lag et nytt repo, for eksempel `dogn-data`, og velg **Private**. Huk av for **Add a README** slik at repoet ikke er tomt.
2. Lag en tilgangsnøkkel: klikk på profilbildet → **Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token**.
   - Navn: `Døgn`. Utløp: for eksempel 1 år.
   - **Repository access → Only select repositories** → velg `dogn-data`.
   - **Permissions → Repository permissions → Contents → Read and write**.
   - Trykk **Generate token** og kopier nøkkelen (starter med `github_pat_`).
3. I appen: **Meny → Backup**. Fyll inn GitHub-brukernavn, repo (`dogn-data`) og nøkkelen, og trykk **Koble til**.

Appen lagrer da `dogn-backup.json` i repoet når du har gjort endringer, høyst én gang i timen, og når appen åpnes. Nøkkelen lagres bare på telefonen og kommer ikke med i backupfiler. Mister du telefonen, sletter du nøkkelen på GitHub under samme meny.

På ny telefon: legg appen på hjemskjermen, velg **Senere** i oppsettet, gå til **Meny → Backup**, koble til med en nøkkel og trykk **Hent backup fra GitHub**.

### B. Backup til fil

Uten GitHub står **Ta backup** som gjøremål i Nullstilling hver søndag. **Eksporter backup** lagrer en fil du legger i iCloud Drive eller Filer. **Importer backup** henter den inn igjen.

## 4. Partnerens turnus (valgfritt)

**Meny → Partner og turnus.** Slå på turnus, gi partneren et navn og legg inn reisetid. Appen bruker turnusen til å vise dagens vakt i toppen og til å avgjøre om partneren rekker middagen. Knappen i middagsbolken kan alltid overstyres.

Turnus importeres fra fil. To formater fungerer:

- Tekst, én dag per linje:
  ```
  2026-10-01 D
  2026-10-02 A14
  03.10.2026 F1
  ```
  Nye koder dukker opp under Vaktkoder, der du legger inn tidene.
- En turnusfil fra Døgn (JSON) med både koder og dager.

Har du turnusen som PDF, kan du be Claude om å lese den og lage filen.

## 5. Vær og aktiviteter

Stedet i **Meny → Profil** brukes til værmelding. Været hentes fra Open-Meteo, som i Norden bruker MET Norges modell, og oppdateres hver time når appen er i bruk. Uten nett vises siste værmelding.

Hver våkenbolk viser været for tidsrommet og tre forslag fra **Meny → Aktivitetsbibliotek**. Forslagene tar hensyn til regn og vind, dagslys, faste tider (for eksempel babysang onsdager 11:00) og hva dere har gjort nylig. Trykk på et forslag for å velge det. Legg til egne aktiviteter med sted, lenke og faste tider i biblioteket.

## 6. Maler og varige endringer

En mal er en fast dagsrytme. **Meny → Maler** viser hvilken mal som gjelder når, og alle malene dine.

- **Lagre en dag som mal:** Juster en dag i tidslinjen (flytt bolker, endre tekst), og velg **Meny → Lagre dagen som mal**. Velg **Ny mal fra en dato** for å la dager før datoen beholde den gamle rytmen, eller **Erstatt** for å endre malen for alle dager.
- **Planlegge en mal i ro og mak:** **Meny → Maler → Ny mal**. Start med en kopi eller en tom mal, og rediger bolkene. Malen påvirker ingen dager før du trykker **Bruk fra denne datoen**. **Se malen på en dag** viser den i tidslinjen for én dag.
- Trinnvise overganger, som å fase ut MME eller gå over til én lur, gjøres som flere maler etter hverandre i planen.
- **Roller:** Tre bolker har en rolle. **Morgen** er bolken der dagen starter når barnene har våknet. **Legging** har fast leggetid, og nattesøvnen logges der. **Nullstilling** er kveldsbolken som viser «i morgen», dagsrapporten, ukentlig backup og det som skal gjøres dagen før. Rollen velges under **Mer** når du redigerer en bolk, så bolkene kan hete hva du vil. Hver rolle brukes av én bolk om gangen.

### Når dagen ikke går etter planen

Målet er at tvillingene er sultne og trøtte til vanlig tid, og at planen holder dag for dag. Leggetiden er fast og endres bare når du flytter leggebolken selv.

- Hver bolk har en planlagt tid (fra malen, eller det du selv har satt for dagen) og en faktisk tid.
- Når en bolk starter tidligere eller senere enn planlagt (våknet, sovnet, våknet fra lur, «start nå»), går de neste bolkene tilbake til planlagt tid så fort det lar seg gjøre. Bolkene imellom kan krympe til tre fjerdedeler av planlagt lengde (stell og forberedelser til halvparten). Lurer strekkes lite, mens måltider og våkentid kan vare lenger, fordi trøttheten følger tiden siden forrige søvn.
- Eksempel: Våkner barnene 08:10 i stedet for 07:00, blir frokost 09:10, første lur 10:00 og lunsj 11:20, mens middag, andre lur og resten av dagen står som planlagt. En lur som varer én time for lenge, gir middag 20 minutter senere og andre lur litt senere, og så er dagen tilbake i planen.
- Flytter du selv en bolk med ±15/30 eller i bolkeditoren, blir det dagens nye plan for den bolken, og de neste tilpasses som over.
- Våkner barnene sent, trykk **Begge våknet**. Dagen starter da, og resten tas igjen så fort det går.
- **Nattesøvnen** føres på dagen den slutter: dagsloggen for en dag viser «Sovnet i går» og «Våknet i dag». Trykk på et logget klokkeslett i morgen- eller leggebolken for å rette det. Å rette tiden i etterkant endrer ikke planen; det gjør bare knappene.
- **Oppvåkninger:** Når barnene sover om natten, har nå-kortet knappen **Oppvåkning**. Med to barn velger du hvem. Knappen blir til «… sovnet igjen», og tiden imellom føres som våken i natt. Antall oppvåkninger og minutter våken kan også føres eller rettes i dagsloggen. Blir et barn oppe for dagen, gir «våknet» om morgenen våknetid fra oppvåkningen.
- **Nattesøvn** er tiden fra sovnet til våknet, minus tiden våken i natt. Den vises i morgenbolken, i dagsloggen og i dagsrapporten. Oversikten har graf for nattesøvn, nattesøvn og oppvåkninger per dag i tabellen, og snitt for våknetid, nattesøvn, oppvåkninger og tid våken om natten.
- Flytter du leggetid (på leggebolken), følger nullstillingen med, og bolkene før tilpasses fra nå fram til den nye leggetiden.
- Er det ikke plass innenfor grensene, fordeles bolkene jevnt fram til leggetid.
- «Start nå» virker direkte på bolken dere er i og den neste. På andre bolker får du et valg: Er bolken passert, foreslås neste bolk av samme type, eller en kopi nå. Ligger den langt fram, foreslås neste bolk av samme type, og måltider kan aldri hoppes over. Nullstilling kan ikke startes før leggetid.
- Sovner barnene før leggetid, logges tiden, men leggetiden står. Nullstillingen starter tidligst ti minutter etter leggetid.
- En lur som varer lenger enn planlagt, forsvinner ikke fra tidslinjen, og «våknet» står i nå-kortet til den er logget.
- **Meny → Tilbakestill resten av dagen** setter alt fra nå tilbake til tidene i malen. Det som er gjort og logget, beholdes.

## 7. Daglig bruk

- **Linjen nederst:** «i dag» går til i dag (eller til nå, om du allerede er der), «uke» åpner ukemenyen, «+» legger til noe å huske, en avtale, helse eller en bolk, «logg» åpner dagsloggen og «mer» åpner menyen.
- **Toppen** viser datoen, dag i permisjonen og partnerens vakt, dagstripen og nå-kortet. Når du blar ned, krymper den til dato, stripe og nå-kort.
- **Dagstripen** viser dagens bolker i typefargene, med en strek for nå. Trykk på et sted i stripen for å gå til bolken der.
- **Nå-kortet** viser bolken dere er i, hva som kommer og hvor lenge barnene har vært våkne, og har én hovedknapp: sovnet, våknet eller «Begge våknet» om morgenen. Ved siden av neste bolk står en liten «start nå» som krever to trykk.
- **Aktiviteter** har kategorier: rolig, bevegelse, sanser, sang og språk, natur, sosialt, hverdag og utflukt. I forslagsarket filtrerer du på inne eller ute og én kategori; «passer nå» står som før, bare filtrert. Kategoriene settes når du redigerer en aktivitet. Egne aktiviteter fikk et forslag til kategorier ut fra navnet ved oppdateringen.
- **Flere aktiviteter:** 18 nye aktiviteter hjemme følger med (v11). «Snølek» foreslås bare når det er kaldt nok. Under Meny › Aktiviteter kan du legge til aktiviteter fra en fil, for eksempel turer og lekeplasser i nærområdet; de som finnes fra før, hoppes over.
- **Tidslinjen:** Bolken dere er i og den neste vises fullt. De andre er én linje med tid, navn og det viktigste (rett, forslag eller hvor mye som er gjort). Trykk på linjen for å folde den ut, og på tittelen igjen for å gjøre den til én linje. Det gjelder alle bolker, også den dere er i. Blyanten til høyre redigerer bolken, og klokkeslettet flytter den. «Vis alle detaljer» nederst viser alt.
- **Sveip:** Sveip til siden på tidslinjen eller dagstripen for å bytte dag, i kalenderen for å bytte måned. Dra et ark ned for å lukke det, fra toppen eller fra innholdet når det står øverst, og sveip fra venstre kant for å gå tilbake.
- **Fast skall:** Siden og arkene blar bare når det er mer innhold i den retningen. Drar du forbi toppen eller bunnen, står alt stille.
- **Hopp til en dag:** Trykk på datoen i toppen. Kalenderen viser ukenummer, partnerens vakter, avtaler og huskepunkter (prikk) og dager med egne endringer (stjerne).
- **Rekkefølge:** Sjekklister i bolkene, gjøremål, huskelisten, barnene i Profil og «Andre varer» i handlelisten kan sorteres. Dra i grepet (⋮⋮) til venstre, eller velg grepet og bruk pil opp og ned.
- **Spiste:** Velg godt, midd. eller lite for hvert barn. Trykk på valget igjen for å fjerne det.
- **Av og på** vises som [x] og [ ]. Hjelpetekster viser første setning; trykk «?» for resten.
- **Bolkeditoren** har tid og flytting øverst, så sjekkliste og notat. Navn, type, rett fra banken og rolle ligger under «Mer».
- **Nullstilling** viser «i morgen» som én linje. Trykk på den for alt: vær, klær, vakt, middag, første lur, faste tilbud, avtaler og gjøremål. Der kan du også dele en kort dagsrapport.
- **Klær og pakkeliste** vises når dere skal ut. Pakkelisten redigeres under Meny › Aktivitetsbibliotek.
- **Angre** står i meldingen nederst og i menyen, og går opptil 15 steg tilbake.
- Nå-kort, «i morgen» og klær/pakkeliste kan slås av under Meny › Profil › Visning.

## 8. Handleliste, søvnoversikt, helse og visning

- **Handleliste:** Meny → Handleliste (eller knappen i ukemenyen) samler ingrediensene fra rettene de neste sju dagene. Legg til egne varer, kryss av i butikken og del listen. Varer du alltid har hjemme, holdes utenfor. Ingrediensene redigeres på hver rett i middagsbanken.
- **Søvnoversikt:** Meny → Oversikt viser en graf over lur per dag for hvert barn, og snitt for de siste sju dagene mot uken før.
- **Helse:** I dagsloggen, eller med pluss-knappen → Helse, fører du temperatur, medisin og symptomer. Når et barn er merket som sykt, vises et varsel øverst med siste medisin og temperatur, og forslagene holder seg hjemme. Appen gir ikke råd om dosering.
- **Visning:** Meny → Profil → Visning har lyst tema (lettere å lese ute), «følg telefonen» og større tekst. Større tekst gjør bare teksten større, ikke knapper og luft.

## Oppdateringer

Last opp endrede filer i det offentlige repoet med **Upload files** (mappene kan dras inn som de er). Appen henter ny versjon neste gang den åpnes med nett. Dataene dine berøres ikke. Endres datastrukturen, oppgraderes dataene automatisk første gang den nye versjonen åpnes.

## For den som vil endre appen

- **Tekst:** All tekst står i `js/text.nb.js`, ordnet etter hvor den vises. Tekster som tar inn verdier, er små funksjoner. Bruk felleskjønn (-en) for hankjønn og hunkjønn.
- **Farger og størrelser:** Står bare i `styles/tokens.css`, med et mørkt og et lyst sett. `app.css` bruker bare disse variablene.
- **Endringer i data** går alltid gjennom `commit()` i `js/store.js`. Den lagrer, merker for backup, tegner på nytt og gjør endringen mulig å angre.
- **HTML** lages med `h`…`` fra `js/util.js`, som escaper alle verdier som settes inn. Innleste filer kontrolleres av `sanitize()` i `js/migrate.js`.
- **Ny fil:** Legg den inn i `index.html` og i `APP_FILES` i `js/version.js`. Øk `APP_VERSION` ved hver utgivelse, så får lageret for bruk uten nett nytt navn.
- **Tester:** `python3 -m unittest discover -s tests -v` (krever `pip install playwright` og `python -m playwright install chromium`). Testene kjøres også automatisk på GitHub under **Actions** ved hver endring.
