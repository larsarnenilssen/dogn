"""Ende-til-ende-tester for Døgn.

Kjøres med:  python3 -m unittest discover -s tests -v
Krever:      pip install playwright  og  python -m playwright install chromium
Kjøres også automatisk på GitHub (Actions) ved hver endring.

Testene starter en lokal webserver for repoet, åpner appen i en mobilstørrelse
og bruker en fast klokke og simulert værmelding, slik at resultatene er stabile.
Testdataene er en oppdiktet familie – ingen personlige data ligger i repoet.
"""
import datetime
import functools
import http.server
import json
import os
import threading
import unittest

from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
READY = "() => typeof state !== 'undefined' && !!state && !!document.querySelector('#timeline')"
TZ = datetime.timezone(datetime.timedelta(hours=2))


class _Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a):
        pass


def _read(*parts):
    with open(os.path.join(ROOT, *parts), encoding='utf-8') as f:
        return f.read()


def _serve():
    handler = functools.partial(_Quiet, directory=ROOT)
    srv = http.server.ThreadingHTTPServer(('127.0.0.1', 0), handler)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    return srv


def fake_weather(first_day='2026-10-05', days=12, rainy_even_days=True, temp=6.0):
    """Timesverdier i Open-Meteo-format. Partallsdager regner mellom 09 og 16."""
    d0 = datetime.datetime.fromisoformat(first_day)
    out = {'time': [], 'temperature_2m': [], 'precipitation': [], 'weather_code': [], 'wind_speed_10m': []}
    for h in range(24 * days):
        dt = d0 + datetime.timedelta(hours=h)
        wet = rainy_even_days and dt.day % 2 == 0 and 9 <= dt.hour <= 16
        out['time'].append(dt.strftime('%Y-%m-%dT%H:00'))
        out['temperature_2m'].append(temp)
        out['precipitation'].append(1.2 if wet else 0.0)
        out['weather_code'].append(63 if wet else 2)
        out['wind_speed_10m'].append(5)
    return {'hourly': out}


# Oppsett av en testfamilie etter førstegangsoppsettet (kjøres i siden).
SETUP_JS = """() => {
  applySetup({ kids: [{ id: 'a', name: 'Ola' }, { id: 'b', name: 'Kari' }],
               place: { name: 'Bergen', lat: 60.39, lon: 5.32 },
               leave: { start: '2026-10-01', end: '2026-12-31' },
               templateId: 'to-lurer', partnerEnabled: true, partnerName: 'Partner' });
  state.partner.codes = Object.assign(state.partner.codes, { A: { label: 'Aftenvakt', kind: 'work', start: '14:30', end: '22:00' } });
  state.partner.shifts = { '2026-10-07': 'D', '2026-10-08': 'A', '2026-10-09': 'F' };
  state.activities.push({ id: 'x-sang', name: 'Babysang', kind: 'inne', minutes: 60, weather: 'any', travel: 'gange',
                          where: 'Kirken', note: '', url: '', days: [3], from: '11:00', to: '12:30' });
  state.activities.push({ id: 'x-park', name: 'Parktur', kind: 'ute', minutes: 90, weather: 'dry', travel: 'gange',
                          where: '', note: '', url: '', days: [], from: '', to: '' });
  persist(); render();
}"""


class DognTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.srv = _serve()
        cls.base = 'http://127.0.0.1:%d/index.html' % cls.srv.server_address[1]
        cls.pw = sync_playwright().start()
        exe = os.environ.get('PW_CHROMIUM')
        cls.browser = cls.pw.chromium.launch(executable_path=exe) if exe else cls.pw.chromium.launch()

    @classmethod
    def tearDownClass(cls):
        cls.browser.close()
        cls.pw.stop()
        cls.srv.shutdown()

    def open(self, when=(2026, 10, 7, 9, 5), setup=True, weather=None):
        ctx = self.browser.new_context(viewport={'width': 390, 'height': 844}, timezone_id='Europe/Oslo',
                                       locale='nb-NO', is_mobile=True, has_touch=True)
        self.addCleanup(ctx.close)
        pg = ctx.new_page()
        self.errors = []
        pg.on('pageerror', lambda e: self.errors.append(str(e)))
        body = json.dumps(weather or fake_weather())
        pg.route('https://api.open-meteo.com/**', lambda r: r.fulfill(
            status=200, body=body, headers={'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json'}))
        pg.route('https://fonts.googleapis.com/**', lambda r: r.fulfill(status=200, body='', headers={'Content-Type': 'text/css'}))
        pg.clock.install(time=datetime.datetime(*when, tzinfo=TZ))
        pg.goto(self.base)
        pg.wait_for_function(READY)
        if setup:
            pg.wait_for_selector('#sheet-root.open #p-kids')   # førstegangsoppsettet åpnes selv
            pg.evaluate('() => closeSheet()')
            pg.evaluate(SETUP_JS)
            pg.wait_for_timeout(300)
        return pg

    def tearDown(self):
        self.assertEqual(getattr(self, 'errors', []), [], 'JavaScript-feil i siden')

    def times(self, pg):
        return pg.eval_on_selector_all('.blk .tbtn', 'els => els.map(e => e.textContent.trim())')

    # ---------- tester ----------

    def test_first_run_setup(self):
        pg = self.open(setup=False)
        pg.wait_for_selector('#p-kids')
        inputs = pg.query_selector_all('#p-kids .item input')
        inputs[0].fill('Emil')
        inputs[1].fill('Ida')
        pg.fill('#p-ls', '2026-10-01')
        pg.fill('#p-le', '2026-12-31')
        pg.click('.sh-foot [data-save]')
        pg.wait_for_timeout(300)
        self.assertEqual(pg.evaluate('state.kids.map(k => k.name)'), ['Emil', 'Ida'])
        self.assertTrue(pg.evaluate('state.meta.setupDone'))

    def test_quick_shift_and_undo(self):
        pg = self.open()
        before = self.times(pg)
        pg.click('.blk[data-id="to-lurer.middag"] .tbtn')
        pg.click('.blk[data-id="to-lurer.middag"] [data-qshift="-30"]')
        after = self.times(pg)
        self.assertNotEqual(before, after)
        self.assertIn('13:00', after)
        pg.click('#undo')
        self.assertEqual(before, self.times(pg))

    def test_sleep_moves_only_the_boundary(self):
        pg = self.open(when=(2026, 10, 7, 14, 0))
        pg.click('.blk[data-id="to-lurer.lur2"] [data-act="sleep-now"][data-kid="all"]')
        self.assertIn('14:00', self.times(pg))
        pg.clock.set_system_time(datetime.datetime(2026, 10, 7, 15, 10, tzinfo=TZ))
        pg.evaluate('render()')
        pg.click('.blk[data-id="to-lurer.lur2"] [data-act="sleep-now"][data-kid="all"]')
        t = self.times(pg)
        self.assertIn('15:10', t)       # våkentiden starter når begge våknet
        self.assertIn('17:30', t)       # middagen står der den står

    def test_night_sleep_moves_reset_block(self):
        pg = self.open(when=(2026, 10, 7, 18, 52))
        pg.click('.blk[data-id="to-lurer.legging"] [data-act="night-now"][data-kid="all"]')
        self.assertIn('18:52', self.times(pg))

    def test_save_day_as_new_template_from_date(self):
        pg = self.open()
        pg.click('.blk[data-id="to-lurer.middag"] .tbtn')
        pg.click('.blk[data-id="to-lurer.middag"] [data-qshift="-30"]')
        pg.click('#menu')
        pg.click('[data-m="saveday"]')
        pg.fill('#sd-from', '2026-10-10')
        pg.click('.sh-foot [data-save]')
        pg.wait_for_timeout(200)
        self.assertEqual(pg.evaluate("templateFor('2026-10-09')"), 'to-lurer')
        self.assertNotEqual(pg.evaluate("templateFor('2026-10-10')"), 'to-lurer')
        self.assertEqual(pg.evaluate("blocksFor('2026-10-10').find(b => b.slot === 'middag').start"), '13:00')
        self.assertEqual(pg.evaluate("blocksFor('2026-10-08').find(b => b.slot === 'middag').start"), '13:30')

    def test_new_template_from_scratch(self):
        pg = self.open()
        pg.click('#menu')
        pg.click('[data-nav="templates"]')
        pg.click('[data-new-tpl]')
        pg.fill('#nt-name', 'Tom test')
        pg.select_option('#nt-base', '')
        pg.click('[data-create]')
        pg.click('[data-new-blk]')
        pg.fill('#f-title', 'Frokost')
        pg.fill('#f-start', '07:00')
        pg.click('.sh-foot [data-save="tpl"]')
        pg.wait_for_timeout(200)
        n = pg.evaluate("Object.values(state.templates).find(t => t.name === 'Tom test').blocks.length")
        self.assertEqual(n, 1)

    def test_week_menu_rules(self):
        pg = self.open()
        week = pg.evaluate("""() => [...Array(7)].map((_, i) => { const d = addDays('2026-10-12', i); const x = dishFor(d, 'dinner'); return x ? x.cat + '|' + x.id : ''; })""")
        self.assertTrue(week[4].endswith('d-pizza'))      # fredag
        self.assertTrue(week[5].endswith('d-taco'))       # lørdag
        self.assertGreaterEqual(sum(1 for w in week if w.startswith('fisk|')), 2)
        self.assertEqual(pg.evaluate("dishFor('2026-10-17', 'lunch').id"), 'l-risgrot')

    def test_weather_and_sick_mode_shape_suggestions(self):
        pg = self.open()
        pg.evaluate("go(0, '2026-10-08')")              # regnværsdag
        txt = pg.inner_text('.blk[data-id="to-lurer.vaken2"]')
        self.assertIn('regn', txt)
        self.assertNotIn('Parktur', txt)                  # trenger opphold
        pg.evaluate("go(0, '2026-10-07')")              # tørt, onsdag
        txt = pg.inner_text('.blk[data-id="to-lurer.vaken2"]')
        self.assertIn('Babysang', txt)                    # fast tilbud på onsdager
        pg.evaluate("(() => { const L = logRec('2026-10-07'); L.sick = { a: true }; persist(); render(); })()")
        sugg = pg.inner_text('.blk[data-id="to-lurer.vaken2"] .sugg')
        self.assertNotIn('Babysang', sugg)
        self.assertIn('hjemme', sugg)

    def test_nowbar_start_needs_two_taps(self):
        pg = self.open(when=(2026, 10, 7, 12, 40))
        before = self.times(pg)
        pg.click('[data-nb="start"]')
        self.assertEqual(before, self.times(pg))
        pg.click('[data-nb="start"]')
        self.assertNotEqual(before, self.times(pg))
        pg.click('#undo')
        self.assertEqual(before, self.times(pg))

    def test_reminder_and_appointment(self):
        pg = self.open()
        pg.click('#fab')
        pg.fill('#q-text', 'Kjøp bleier')
        pg.click('.sh-foot [data-save]')
        pg.wait_for_timeout(200)
        self.assertIn('Kjøp bleier', pg.inner_text('.blk[data-id="to-lurer.lur1"]'))
        pg.click('#fab')
        pg.click('[data-mode="avtale"]')
        pg.fill('#ap-title', 'Helsestasjon')
        pg.fill('#ap-date', '2026-10-07')
        pg.fill('#ap-start', '12:30')
        pg.click('.sh-foot [data-save]')
        pg.wait_for_timeout(200)
        self.assertIn('Helsestasjon', pg.inner_text('.appt'))

    def test_shopping_list(self):
        pg = self.open()
        pg.evaluate('openShopSheet("2026-10-12")')
        items = pg.eval_on_selector_all('.checks.shop li .main', 'els => els.map(e => e.textContent)')
        self.assertIn('Kjøttdeig', items)
        self.assertNotIn('Salt', items)

    def test_migration_from_version_1(self):
        pg = self.open(setup=False)
        pg.evaluate("""() => {
          const s = seed(); s.version = 1; s.meta.setupDone = undefined;
          delete s.dishes; delete s.menu; delete s.menuWeeks; delete s.settings; delete s.kids; delete s.partner; delete s.place; delete s.activities; delete s.shop;
          Object.values(s.templates).forEach(t => t.blocks.forEach(b => { delete b.link; delete b.role; }));
          localStorage.setItem('dogn-state', JSON.stringify(s)); indexedDB.deleteDatabase('dogn');
        }""")
        pg.reload()
        pg.wait_for_function(READY)
        pg.wait_for_timeout(300)
        v = pg.evaluate('state.version')
        self.assertEqual(v, pg.evaluate('DATA_VERSION'))
        self.assertEqual(pg.evaluate("state.templates['to-lurer'].blocks.find(b => b.slot === 'kvelds').link"), 'dinner')
        self.assertTrue(pg.evaluate('state.dishes.length > 10 && state.activities.length > 5'))
        # v7: roller i stedet for faste navn, og eksisterende brukere beholder «guttene»
        self.assertEqual(pg.evaluate("state.templates['to-lurer'].blocks.find(b => b.slot === 'kveld').role"), 'reset')
        self.assertEqual(pg.evaluate("state.templates['to-lurer'].blocks.find(b => b.slot === 'legging').role"), 'bedtime')
        self.assertEqual(pg.evaluate('state.settings.kidsWord'), 'guttene')

    def test_export_import_roundtrip(self):
        pg = self.open()
        data = pg.evaluate('JSON.stringify(state)')
        path = os.path.join(ROOT, 'tests', '.tmp-backup.json')
        with open(path, 'w', encoding='utf-8') as f:
            f.write(data)
        self.addCleanup(lambda: os.path.exists(path) and os.remove(path))
        pg.evaluate("state.kids[0].name = 'Endret'; persist(); render();")
        pg.click('#menu')
        pg.click('[data-nav="backup"]')
        pg.set_input_files('#m-import', path)
        pg.wait_for_timeout(300)
        self.assertEqual(pg.evaluate('state.kids[0].name'), 'Ola')

    def test_theme_and_text_size(self):
        pg = self.open()
        pg.evaluate("state.settings.theme = 'light'; state.settings.textSize = 1.2; applyTheme(); render();")
        self.assertEqual(pg.evaluate('document.documentElement.dataset.theme'), 'light')
        self.assertTrue(pg.evaluate('document.querySelector("#date").textContent.length > 0'))
        # Tekststørrelsen skalerer rem (bare tekst), ikke hele siden
        self.assertEqual(pg.evaluate('document.documentElement.style.fontSize'), '120%')
        self.assertEqual(pg.evaluate('document.body.style.zoom'), '')
        self.assertEqual(pg.evaluate('document.querySelector(\'meta[name="theme-color"]\').content'), '#FFFFFF')

    def test_roles_decide_reset_and_bedtime(self):
        pg = self.open(when=(2026, 10, 7, 18, 40))
        # Nullstillingen gjenkjennes på rollen, ikke på navnet
        pg.evaluate("""() => { const b = state.templates['to-lurer'].blocks.find(x => x.role === 'reset');
                                 b.slot = 'kveldsrutine'; b.title = 'Kveldsrutine'; persist(); render(); }""")
        self.assertTrue(pg.is_visible('.blk[data-id="to-lurer.kveld"] .tomorrow'))
        # Flytt rollen «legging» til leggeforberedelsen i bolkeditoren
        pg.evaluate("openBlockSheet('to-lurer.legg', 'to-lurer')")
        pg.select_option('#f-role', 'bedtime')
        pg.click('.sh-foot [data-save="tpl"]')
        pg.wait_for_timeout(200)
        roles = pg.evaluate("Object.fromEntries(state.templates['to-lurer'].blocks.filter(b => b.role).map(b => [b.slot, b.role]))")
        self.assertEqual(roles, {'legg': 'bedtime', 'kveldsrutine': 'reset'})
        pg.evaluate('closeSheet()')
        pg.wait_for_timeout(300)
        self.assertTrue(pg.is_visible('.blk[data-id="to-lurer.legg"] .log.night'))

    def test_kids_word(self):
        pg = self.open()
        self.assertIn('Barna', pg.inner_text('.blk[data-id="to-lurer.middag"]'))
        pg.evaluate("openProfileSheet(false)")
        pg.fill('#p-kw', 'tvillingene')
        pg.click('.sh-foot [data-save]')
        pg.wait_for_timeout(300)
        self.assertIn('Tvillingene', pg.inner_text('.blk[data-id="to-lurer.middag"]'))

    def test_import_is_escaped_and_sanitized(self):
        pg = self.open()
        data = json.loads(pg.evaluate('JSON.stringify(state)'))
        blk = data['templates']['to-lurer']['blocks'][0]
        blk['title'] = '<img src=x onerror="window.pwned=1">Frokost'
        blk['start'] = '25:99'
        data['activities'][0]['url'] = 'javascript:window.pwned=2'
        data['appts'] = [{'id': 'x', 'title': 'Feil', 'date': 'i morgen', 'start': '10:00'}]
        data['kids'][0]['name'] = '<b>Ola</b>'
        path = os.path.join(ROOT, 'tests', '.tmp-backup.json')
        with open(path, 'w', encoding='utf-8') as f:
            json.dump(data, f)
        self.addCleanup(lambda: os.path.exists(path) and os.remove(path))
        pg.click('#menu')
        pg.click('[data-nav="backup"]')
        pg.set_input_files('#m-import', path)
        pg.wait_for_timeout(400)
        self.assertIsNone(pg.evaluate('window.pwned'))
        self.assertEqual(pg.evaluate("state.templates['to-lurer'].blocks.find(b => b.title.includes('img')).start"), '12:00')
        self.assertEqual(pg.evaluate('state.activities[0].url'), '')
        self.assertEqual(pg.evaluate('state.appts.length'), 0)
        self.assertIn('<b>Ola</b>', pg.inner_text('#timeline'))      # vises som tekst, ikke som HTML

    def test_undo_keeps_only_changed_parts(self):
        pg = self.open()
        pg.click('.blk[data-id="to-lurer.middag"] .tbtn')
        pg.click('.blk[data-id="to-lurer.middag"] [data-qshift="15"]')
        keys = pg.evaluate('undoStack[undoStack.length - 1].parts.map(p => p[0])')
        self.assertEqual(keys, ['days/2026-10-07'])

    def test_offline_file_list_is_complete(self):
        import re
        html = _read('index.html')
        local = [x for x in re.findall(r'(?:src|href)="([^"]+)"', html) if not x.startswith('http')]
        version = _read('js', 'version.js')
        listed = re.findall(r"'\./([^']*)'", version)
        for f in local:
            self.assertIn(f, listed, f + ' mangler i APP_FILES i js/version.js')
        for f in listed:
            if f:
                self.assertTrue(os.path.exists(os.path.join(ROOT, f)), f + ' finnes ikke')
        self.assertIn("importScripts('js/version.js')", _read('sw.js'))


if __name__ == '__main__':
    unittest.main()
