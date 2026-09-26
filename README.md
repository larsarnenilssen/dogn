# Døgn – oppsett

Døgn er en dagsplan for foreldrepermisjon. Appen er én nettside som legges på hjemskjermen og virker uten nett. Alt du legger inn, lagres på telefonen din. Andre som åpner samme adresse, får sin egen, tomme app.

## Filer som skal ligge i det offentlige repoet

| Fil | Hva den gjør |
|---|---|
| `index.html` | Selve appen |
| `sw.js` | Gjør at appen virker uten nett |
| `manifest.webmanifest` | Navn og ikon på hjemskjermen |
| `icon-192.png`, `icon-512.png`, `apple-touch-icon.png` | Ikoner |

Last aldri opp backupfiler, startfiler eller turnusfiler hit. Repoet er offentlig.

## 1. Legg ut appen med GitHub Pages

1. Logg inn på github.com og velg **New repository**. Kall det for eksempel `dogn` og velg **Public**.
2. I repoet: **Add file → Upload files**. Dra inn filene i tabellen over og trykk **Commit changes**.
3. **Settings → Pages**. Velg Source **Deploy from a branch**, Branch **main**, mappe **/(root)**, og trykk **Save**.
4. Etter et par minutter står adressen øverst, typisk `https://<brukernavn>.github.io/dogn/`.

## 2. Legg den på hjemskjermen

- iPhone: åpne adressen i **Safari**, trykk **Del → Legg til på Hjem-skjerm**, og bruk alltid appen fra ikonet.
- Android: åpne i Chrome, meny → **Installer app**.

Første gang du åpner appen, kommer oppsettet: barnas navn, sted, permisjonsdatoer, antall lurer og om partneren har turnus. Har du en startfil eller backup, velger du **Importer fil** i stedet.

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

## Oppdateringer

Last opp ny `index.html` (og eventuelt `sw.js`) i det offentlige repoet med **Upload files**. Appen henter ny versjon neste gang den åpnes med nett. Dataene dine berøres ikke.
