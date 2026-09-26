/* Døgn – versjon og filliste.
   Lastes både av appen og av service workeren (sw.js), slik at lageret
   for bruk uten nett får nytt navn hver gang versjonen endres.
   Legges det til en fil i appen, må den også stå i APP_FILES. */
const APP_VERSION = '2.0.0';
const APP_FILES = [
  './', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png', './apple-touch-icon.png',
  './styles/tokens.css', './styles/app.css',
  './js/version.js', './js/text.nb.js', './js/util.js', './js/seed.js', './js/migrate.js', './js/store.js',
  './js/domain/plan.js', './js/domain/tasks.js', './js/domain/menu.js', './js/domain/log.js', './js/domain/weather.js',
  './js/domain/activities.js', './js/domain/partner.js', './js/domain/sync.js',
  './js/views/sheet.js', './js/views/timeline.js', './js/views/plan.js', './js/views/food.js', './js/views/log.js', './js/views/setup.js', './js/views/calendar.js', './js/views/swipe.js',
  './js/app.js',
];
