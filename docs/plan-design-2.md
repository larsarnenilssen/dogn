# Plan: designrunde 2 (godkjent 26.09.2026, «hele pakken») – gjennomført i versjon 2.0.0

Rammer: terminalpreget beholdes. Ingen emojier eller bildesymboler. Bruk tegn som
passer uttrykket (›, –, ·, *, [x]) og korte, tydelige forkortelser. Alt nytt følger
tokens.css, text.nb.js, h`` og commit(). Felleskjønn (-en) i all ny tekst.

## Rekkefølge
1. Raske: «bolk» overalt (ikke «rubrikk»). Én hovedknapp om gangen (nå-kortet er
   hovedknapp; knapper i bolkene nøytrale). Etterskudd i aksentfarge, ikke rødt,
   samlet der det er flere. «Konen spiser med» som nøytral chip (med/ikke med).
   Hjelpetekster kortes til én linje; resten bak en liten «?»-knapp som folder ut.
   Fjern type-merkelapp (fargen viser typen).
2. Forsiden: bolken dere er i og neste vises fullt; resten én linje (tid, navn, rett
   eller «forslag: A · B · C»), utvides ved trykk. Forslag som én linje med tre valg.
   Topp som krymper ved blaing til dato + nå-kort; dag/vakt på én linje; sol ut av toppen.
3. Dagstripe øverst: tynn stripe med bolkene i typefarger og markør for nå; trykk hopper
   til bolken. Samme stripe i malredigeringen.
4. Skrift: IBM Plex Sans for brødtekst og hjelpetekst; Plex Mono for tider, tall,
   titler og etiketter. Nye tokens --sans/--mono.
5. Navigasjonslinje nederst: I dag · Uke · Logg · Mer, med + i midten (erstatter FAB
   og knappene nederst i tidslinjen). «Mer» = dagens meny.
6. Bolkeditor: tid og flytting øverst (ett sted), så sjekkliste, så notat; navn, type,
   rett fra banken og rolle i sammenfoldet «Mer».
7. Små: spiste-valg som tre korte valg per barn (godt/midd./lite); brytere for av/på og
   delt knapperad for tema/størrelse i Profil; ukemenyen med kort markering for middag
   med/uten partner og vakt bare når den påvirker; aktiviteter gruppert hjemme / gå /
   buss·bil; «i morgen» med én oppsummeringslinje og resten bak trykk.

## Sjekk før utgivelse
- Golden-sammenligning (tekst i alle visninger) og skjermbilder mørkt/lyst, 100/120 %.
- Alle tester grønne; nye tester for kompakt forside, dagstripe og navigasjonslinje.
- Migrering av siste backup fra dogn-data uten endringer i data.

## Tillegg: sveiping
- Dag: sveip finnes allerede (over 70 px vannrett). Gjør den synlig: tidslinjen følger
  fingeren og glir over til neste dag, med nabodagens dato i kanten. Kort gliding
  (under 0,2 s), ingen animasjon ved «reduser bevegelse».
- Kalender: sveip mellom måneder. Dagstripen: sveip bytter dag.
- Ark: dra ned for å lukke; sveip fra venstre kant = «Tilbake» der arket har det.
- Konflikter: loddrett blaing, dra-grep i lister og vannrett rulling i tabeller skal
  ikke utløse sveip. Test med berøring i Playwright.
