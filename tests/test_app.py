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

    def expand(self, pg, block_id):
        """Fjerne bolker vises som én linje. Denne folder ut en bolk, som et trykk på den."""
        pg.evaluate("id => { expanded.add(id); renderTimeline(); }", block_id)

    def times(self, pg):
        return pg.eval_on_selector_all('.blk .tbtn', 'els => els.map(e => e.textContent.trim())')

    # ---------- tester ----------

    def test_first_run_setup(self):
        pg = self.open(setup=False)
        pg.wait_for_selector('#p-kids')
        inputs = pg.query_selector_all('#p-kids .item [data-kname]')
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

    def start_of(self, pg, slot):
        return pg.evaluate("blocksFor(view).find(b => b.slot === '%s').start" % slot)

    def assert_day_is_sane(self, pg):
        """Leggetid 19:00, alle måltider til stede og i rekkefølge, minst 10 min per bolk."""
        slots = pg.evaluate("blocksFor(view).map(b => b.slot)")
        mins = pg.evaluate("blocksFor(view).map(b => toMin(b.start))")
        self.assertEqual(self.start_of(pg, 'legging'), '19:00')
        for meal in ['mme-morgen', 'frokost', 'lunsj', 'middag', 'kvelds', 'legging']:
            self.assertIn(meal, slots)
        self.assertLess(slots.index('frokost'), slots.index('lunsj'))
        self.assertLess(slots.index('lunsj'), slots.index('middag'))
        self.assertLess(slots.index('middag'), slots.index('kvelds'))
        self.assertTrue(all(b - a >= 10 for a, b in zip(mins, mins[1:])), mins)

    def test_sleep_refits_until_bedtime(self):
        pg = self.open(when=(2026, 10, 7, 14, 0))
        pg.click('.blk[data-id="to-lurer.lur2"] [data-act="sleep-now"][data-kid="all"]')
        self.assertEqual(self.start_of(pg, 'lur2'), '14:00')
        pg.clock.set_system_time(datetime.datetime(2026, 10, 7, 15, 40, tzinfo=TZ))
        pg.evaluate('render()')
        pg.click('.blk[data-id="to-lurer.lur2"] [data-act="sleep-now"][data-kid="all"]')
        self.assertEqual(self.start_of(pg, 'vaken3'), '15:40')     # våkentiden starter når begge våknet
        self.assertEqual(self.start_of(pg, 'kvelds'), '17:30')     # forsinkelsen er tatt igjen før kvelds
        self.assert_day_is_sane(pg)

    def test_long_nap_keeps_wake_button(self):
        pg = self.open(when=(2026, 10, 7, 9, 20))
        pg.evaluate("commit(null, () => { logRec('2026-10-06').night = { a: { wake: '07:00' }, b: { wake: '07:00' } }; })")
        pg.click('.blk[data-id="to-lurer.lur1"] [data-act="sleep-now"][data-kid="all"]')
        pg.clock.set_system_time(datetime.datetime(2026, 10, 7, 11, 20, tzinfo=TZ))   # luren varer lenger enn planlagt
        pg.evaluate('render()')
        self.assertTrue(pg.is_visible('.blk[data-id="to-lurer.lur1"] [data-act="sleep-now"][data-kid="all"]'))
        self.assertIn('våknet', pg.inner_text('#nowbar [data-nb="act"]'))
        pg.click('#nowbar [data-nb="act"]')
        self.assertEqual(self.start_of(pg, 'opp1'), '11:20')
        self.assert_day_is_sane(pg)

    def test_long_first_nap_shifts_second_nap_a_little(self):
        pg = self.open(when=(2026, 10, 7, 9, 15))
        pg.evaluate("commit(null, () => { logRec('2026-10-06').night = { a: { wake: '07:00' }, b: { wake: '07:00' } }; })")
        pg.click('.blk[data-id="to-lurer.lur1"] [data-act="sleep-now"][data-kid="all"]')
        pg.clock.set_system_time(datetime.datetime(2026, 10, 7, 11, 45, tzinfo=TZ))   # én time for lenge
        pg.evaluate('render()')
        pg.click('#nowbar [data-nb="act"]')
        lur2 = self.start_of(pg, 'lur2')
        self.assertTrue('14:15' <= lur2 <= '14:45', lur2)
        self.assertEqual(self.start_of(pg, 'kvelds'), '17:30')
        self.assert_day_is_sane(pg)

    def test_early_dinner_does_not_move_nap(self):
        pg = self.open(when=(2026, 10, 7, 12, 40))
        pg.click('#nowbar [data-nb="start"]')
        pg.click('#nowbar [data-nb="start"]')
        self.assertEqual(self.start_of(pg, 'middag'), '12:40')
        self.assertEqual(self.start_of(pg, 'lur2'), '14:15')

    def test_explicit_move_changes_plan_for_the_day(self):
        pg = self.open(when=(2026, 10, 7, 9, 5))
        pg.click('.blk[data-id="to-lurer.middag"] .tbtn')
        pg.click('.blk[data-id="to-lurer.middag"] [data-qshift="30"]')
        self.assertEqual(self.start_of(pg, 'middag'), '14:00')
        self.assertEqual(pg.evaluate("blocksFor(view).find(b => b.slot === 'middag').plan"), '14:00')
        self.assertEqual(self.start_of(pg, 'kvelds'), '17:30')
        # En senere hendelse trekker ikke middagen tilbake til malen
        pg.evaluate("commit(null, () => { logRec('2026-10-06').night = { a: { wake: '07:00' }, b: { wake: '07:00' } }; })")
        pg.click('.blk[data-id="to-lurer.lur1"] [data-act="sleep-now"][data-kid="all"]')
        self.assertEqual(self.start_of(pg, 'middag'), '14:00')

    def test_night_sleep_never_moves_bedtime(self):
        pg = self.open(when=(2026, 10, 7, 18, 52))
        pg.click('.blk[data-id="to-lurer.legging"] [data-act="night-now"][data-kid="all"]')
        self.assertEqual(self.start_of(pg, 'legging'), '19:00')
        self.assertEqual(self.start_of(pg, 'kveld'), '19:10')      # nullstilling tidligst ti min etter leggetid

    def test_late_wake_refits_day_and_keeps_bedtime(self):
        pg = self.open(when=(2026, 10, 7, 8, 10))
        pg.click('#nowbar [data-nb="act"]')                         # «Begge våknet»
        self.assertEqual(self.start_of(pg, 'mme-morgen'), '08:10')
        self.assertEqual(self.start_of(pg, 'morgen'), '06:30')      # forberedelsen før står
        self.assertTrue('08:15' < self.start_of(pg, 'frokost') < '09:45')
        self.assertEqual(self.start_of(pg, 'middag'), '13:30')      # tatt igjen innen middag
        self.assertEqual(self.start_of(pg, 'lur2'), '14:15')
        self.assert_day_is_sane(pg)
        self.assertEqual(pg.evaluate("getLog('2026-10-06').night.a.wake"), '08:10')

    def test_night_is_shown_on_the_day_it_ends_and_can_be_edited(self):
        pg = self.open(when=(2026, 10, 7, 8, 10))
        pg.evaluate("commit(null, () => { logRec('2026-10-06').night = { a: { asleep: '19:05' } }; })")
        pg.click('#nowbar [data-nb="act"]')                         # «Begge våknet» 08:10
        self.expand(pg, 'to-lurer.mme-morgen')
        pg.click('.blk[data-id="to-lurer.mme-morgen"] [data-act="night-edit"][data-kid="a"]')
        pg.wait_for_selector('#sheet-root.open #nt-w-a')
        self.assertEqual(pg.input_value('#nt-w-a'), '08:10')
        self.assertIn('i dag', pg.text_content('label[for="nt-w-a"]'))
        pg.fill('#nt-w-a', '08:00')
        pg.click('.sh-foot [data-save]')
        pg.wait_for_timeout(300)
        self.assertEqual(pg.evaluate("getLog('2026-10-06').night.a"), {'asleep': '19:05', 'wake': '08:00'})
        # Dagsloggen for i dag viser natten som slutter i dag: sovnet i går, våknet i dag
        pg.evaluate("openLogSheet('2026-10-07')")
        pg.wait_for_selector('#sheet-root.open #n-w-a')
        self.assertEqual(pg.input_value('#n-a-a'), '19:05')
        self.assertEqual(pg.input_value('#n-w-a'), '08:00')
        self.assertIn('i går', pg.text_content('label[for="n-a-a"]'))
        self.assertIn('i dag', pg.text_content('label[for="n-w-a"]'))
        pg.fill('#n-a-a', '19:20')
        pg.dispatch_event('#n-a-a', 'change')
        self.assertEqual(pg.evaluate("getLog('2026-10-06').night.a.asleep"), '19:20')
        self.assertEqual(pg.evaluate("getLog('2026-10-07').night.a || null"), None)

    def test_night_wakings_from_nowbar_and_history(self):
        pg = self.open(when=(2026, 10, 6, 19, 5))
        pg.click('#nowbar [data-nb="act"]')                         # «Begge sovnet» 19:05
        pg.clock.set_system_time(datetime.datetime(2026, 10, 7, 2, 10, tzinfo=TZ))
        pg.evaluate('tick()')
        self.assertEqual(pg.text_content('#nowbar [data-nb="act"]').strip(), 'Oppvåkning')
        pg.click('#nowbar [data-nb="act"]')                         # to barn: velg hvem
        pg.click('#sheet-root.open [data-kc="a"]')
        self.assertEqual(pg.evaluate("getLog('2026-10-06').night.a.upAt"), '02:10')
        self.assertIn('våken', pg.text_content('#nowbar .nb-1'))
        pg.clock.set_system_time(datetime.datetime(2026, 10, 7, 2, 35, tzinfo=TZ))
        pg.evaluate('tick()')
        pg.click('#nowbar [data-nb="act"]')                         # «Trygve sovnet igjen»
        self.assertEqual(pg.evaluate("getLog('2026-10-06').night.a"), {'asleep': '19:05', 'wakes': 1, 'up': 25})
        # Lyder våkner 05:40 og blir oppe; «Begge våknet» 06:30 fører våknet 05:40 for ham
        pg.clock.set_system_time(datetime.datetime(2026, 10, 7, 5, 40, tzinfo=TZ))
        pg.evaluate("commit('', () => logNightWakeNow('2026-10-06', ['b']))")
        pg.clock.set_system_time(datetime.datetime(2026, 10, 7, 6, 30, tzinfo=TZ))
        pg.evaluate("commit('', () => logWakeNow('2026-10-07', ['a', 'b']))")
        self.assertEqual(pg.evaluate("getLog('2026-10-06').night.b"), {'asleep': '19:05', 'wake': '05:40'})
        self.assertEqual(pg.evaluate("nightLen(getLog('2026-10-06').night.a).net"), 11 * 60 + 25 - 25)
        # Dagsloggen: teller og minutter våken kan rettes
        pg.evaluate("openLogSheet('2026-10-07')")
        pg.wait_for_selector('#sheet-root.open #n-u-a')
        self.assertIn('sov 11t00', pg.text_content('[data-nsum="a"]'))
        pg.click('[data-stepper="a"] [data-step="1"]')
        pg.fill('#n-u-a', '40')
        pg.dispatch_event('#n-u-a', 'change')
        self.assertEqual(pg.evaluate("getLog('2026-10-06').night.a.wakes"), 2)
        self.assertIn('sov 10t45 · 2 oppv.', pg.text_content('[data-nsum="a"]'))
        # Oversikten har graf og snitt for natten
        pg.evaluate("closeSheet(); openHistorySheet()")
        pg.wait_for_selector('#sheet-root.open .ch-box + .ch-box, #sheet-root.open .grp .ch-box')
        self.assertEqual(pg.eval_on_selector_all('#sheet-root.open .ch-box', 'els => els.length'), 2)
        self.assertIn('nattesøvn', pg.text_content('#sheet-root.open'))
        self.assertIn('natt 10t45 (2 oppvåkninger)', pg.evaluate("dayReport('2026-10-07')"))

    def test_start_passed_block_offers_next_of_same_type(self):
        pg = self.open(when=(2026, 10, 7, 14, 0))
        pg.evaluate("expanded.add('to-lurer.lur1'); renderTimeline()")
        pg.click('.blk[data-id="to-lurer.lur1"] .tbtn')
        pg.click('.blk[data-id="to-lurer.lur1"] [data-qshift="now"]')
        pg.wait_for_selector('#sheet-root.open [data-sn="alt"]')
        self.assertEqual(self.start_of(pg, 'lur1'), '09:15')        # ingenting endret før brukeren velger
        pg.click('[data-sn="alt"]')
        pg.wait_for_timeout(300)
        self.assertEqual(self.start_of(pg, 'lur2'), '14:00')
        self.assertEqual(self.start_of(pg, 'lur1'), '09:15')
        self.assert_day_is_sane(pg)

    def test_start_far_ahead_never_skips_meals(self):
        pg = self.open(when=(2026, 10, 7, 9, 5))
        pg.click('.blk[data-id="to-lurer.lur2"] .tbtn')
        pg.click('.blk[data-id="to-lurer.lur2"] [data-qshift="now"]')
        pg.wait_for_selector('#sheet-root.open [data-sn="alt"]')
        self.assertEqual(pg.query_selector_all('[data-sn="skip"]'), [])
        pg.click('[data-sn="alt"]')
        pg.wait_for_timeout(300)
        self.assertEqual(self.start_of(pg, 'lur1'), '09:05')
        self.assertEqual(self.start_of(pg, 'lur2') > '13:30', True)
        self.assert_day_is_sane(pg)

    def test_reset_block_cannot_start_before_bedtime(self):
        pg = self.open(when=(2026, 10, 7, 9, 5))
        pg.click('.blk[data-id="to-lurer.kveld"] .tbtn')
        pg.click('.blk[data-id="to-lurer.kveld"] [data-qshift="now"]')
        pg.wait_for_selector('#sheet-root.open')
        self.assertEqual(pg.query_selector_all('[data-sn]'), [])
        self.assertEqual(self.start_of(pg, 'kveld'), '19:30')

    def test_bedtime_changes_only_when_moved_itself(self):
        pg = self.open(when=(2026, 10, 7, 9, 5))
        for slot, d in [('middag', '30'), ('kvelds', '30'), ('vaken4', '30')]:
            pg.click('.blk[data-id="to-lurer.%s"] .tbtn' % slot)
            pg.click('.blk[data-id="to-lurer.%s"] [data-qshift="%s"]' % (slot, d))
            pg.click('.blk[data-id="to-lurer.%s"] .tbtn' % slot)
        self.assert_day_is_sane(pg)
        # Leggetid flyttes bare når leggebolken selv flyttes, og dagen fram dit tilpasses
        pg.click('.blk[data-id="to-lurer.legging"] .tbtn')
        pg.click('.blk[data-id="to-lurer.legging"] [data-qshift="-30"]')
        self.assertEqual(self.start_of(pg, 'legging'), '18:30')
        self.assertEqual(self.start_of(pg, 'kveld'), '19:00')
        mins = pg.evaluate("blocksFor(view).map(b => toMin(b.start))")
        self.assertTrue(all(b - a >= 10 for a, b in zip(mins, mins[1:])), mins)
        self.assertEqual(self.start_of(pg, 'frokost'), '08:15')      # det som er passert, står

    def test_reset_rest_of_day(self):
        pg = self.open(when=(2026, 10, 7, 12, 40))
        pg.click('#nowbar [data-nb="start"]')
        pg.click('#nowbar [data-nb="start"]')
        self.assertEqual(self.start_of(pg, 'middag'), '12:40')
        pg.click('#menu')
        pg.click('[data-m="reset-rest"]')
        pg.wait_for_timeout(300)
        self.assertEqual(self.start_of(pg, 'middag'), '13:30')
        self.assertEqual(self.start_of(pg, 'lur2'), '14:15')

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
        self.expand(pg, 'to-lurer.vaken2')
        txt = pg.inner_text('.blk[data-id="to-lurer.vaken2"]')
        self.assertIn('regn', txt)
        self.assertNotIn('Parktur', txt)                  # trenger opphold
        pg.evaluate("go(0, '2026-10-07')")              # tørt, onsdag
        self.expand(pg, 'to-lurer.vaken2')
        txt = pg.inner_text('.blk[data-id="to-lurer.vaken2"]')
        self.assertIn('Babysang', txt)                    # fast tilbud på onsdager
        pg.evaluate("(() => { const L = logRec('2026-10-07'); L.sick = { a: true }; persist(); render(); })()")
        self.expand(pg, 'to-lurer.vaken2')
        sugg = pg.inner_text('.blk[data-id="to-lurer.vaken2"] .sugg')
        self.assertNotIn('Babysang', sugg)
        travel = pg.evaluate("""[...document.querySelectorAll('.blk[data-id="to-lurer.vaken2"] .sg[data-aid]')]
          .map(b => state.activities.find(a => a.id === b.dataset.aid).travel)""")
        self.assertTrue(travel and all(t == 'hjemme' for t in travel), travel)

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
        self.assertEqual(pg.evaluate("state.templates['to-lurer'].blocks.find(b => b.slot === 'mme-morgen').role"), 'wake')

    def test_new_dishes_and_activities_are_added_once(self):
        pg = self.open(setup=False)
        pg.evaluate("""() => {
          const s = seed(); s.version = 8; s.meta.setupDone = true;
          s.dishes = s.dishes.filter(d => !ADDED_V9.dishes.includes(d.id));
          s.activities = s.activities.filter(a => !ADDED_V9.activities.includes(a.id) && !ADDED_V11.includes(a.id) && a.id !== 'a-gulv');
          s.activities.push({ id: 'a-bobler', name: 'Mine bobler', kind: 'inne', minutes: 5 });
          s.activities.push({ id: 'a-egen', name: 'Babysang i kirken', kind: 'inne', minutes: 45 });
          localStorage.setItem('dogn-state', JSON.stringify(s)); indexedDB.deleteDatabase('dogn');
        }""")
        pg.reload()
        pg.wait_for_function(READY)
        ids = pg.evaluate('state.dishes.map(d => d.id)')
        acts = pg.evaluate('state.activities.map(a => a.id)')
        for d in ['d-laksepasta', 'd-linsesuppe', 'd-karbonader']:
            self.assertEqual(ids.count(d), 1)
        self.assertEqual(acts.count('a-bobler'), 1)
        self.assertEqual(pg.evaluate("state.activities.find(a => a.id === 'a-bobler').name"), 'Mine bobler')   # egne endringer beholdes
        self.assertNotIn('a-gulv', acts)                                   # slettede aktiviteter kommer ikke tilbake
        self.assertIn('a-sanse', acts)
        self.assertTrue(pg.evaluate("state.dishes.find(d => d.id === 'd-sei').ingredients.length > 0"))
        # v10: aktivitetene som fulgte med, får kategorier
        self.assertEqual(pg.evaluate("state.activities.find(a => a.id === 'a-skog').tags"), ['natur', 'bevegelse'])
        self.assertEqual(pg.evaluate("state.activities.find(a => a.id === 'a-egen').tags"), ['sprak', 'sosialt'])   # forslag ut fra navnet
        self.assertEqual(acts.count('a-lykt'), 1)                          # v11: nye aktiviteter hjemme

    def test_import_activities_from_file(self):
        pg = self.open(when=(2026, 10, 7, 11, 35))
        path = os.path.join(ROOT, 'tests', '.tmp-acts.json')
        with open(path, 'w', encoding='utf-8') as f:
            json.dump({'activities': [
                {'id': 'l-tur', 'name': 'Tur rundt vannet', 'kind': 'ute', 'minutes': 45, 'travel': 'gange', 'tags': ['natur', 'ukjent']},
                {'id': 'l-bibl', 'name': 'Babysang i kirken', 'kind': 'inne', 'minutes': 45, 'travel': 'gange'},
                {'id': 'l-dobbel', 'name': 'Såpebobler', 'kind': 'inne'},                    # finnes fra før
                {'id': 'l-farlig', 'name': '<img src=x onerror=alert(1)>', 'kind': 'inne', 'url': 'javascript:alert(1)'},
            ]}, f)
        try:
            pg.evaluate('openActivitiesSheet()'); pg.wait_for_selector('#sheet-root.open #a-import', state='attached')
            pg.set_input_files('#a-import', path)
            pg.wait_for_timeout(400)
        finally:
            os.remove(path)
        acts = pg.evaluate("Object.fromEntries(state.activities.map(a => [a.id, a]))")
        self.assertEqual(acts['l-tur']['tags'], ['natur'])
        self.assertEqual(acts['l-bibl']['tags'], ['sprak', 'sosialt'])
        self.assertNotIn('l-dobbel', acts)
        self.assertEqual(acts['l-farlig']['url'], '')
        self.assertEqual(pg.eval_on_selector_all('#sheet-root img', 'els => els.length'), 0)

    def test_kids_eat_dinner_on_chosen_days(self):
        pg = self.open(when=(2026, 10, 7, 17, 0))   # onsdag
        pg.evaluate("""commit(null, () => {
          state.dishes.push({ id: 'd-sterk', name: 'Sterk curry', meal: 'dinner', minutes: 30, cat: 'kylling', weekday: 0, for: 'voksne', kids: '', prep: '', dayBefore: '', ingredients: [] });
          state.settings.kidsDinnerDays = [2, 4]; state.menu = {}; state.menuWeeks = {};
        })""")
        for d in ['2026-10-06', '2026-10-08', '2026-10-13', '2026-10-15']:          # tirsdager og torsdager
            self.assertNotEqual(pg.evaluate("d => dishFor(d, 'dinner').id", d), 'd-sterk')
        pg.evaluate("commit(null, () => setMenu('2026-10-07', 'dinner', 'd-fiskekaker', true))")
        self.expand(pg, 'to-lurer.kvelds')
        blk = '.blk[data-id="to-lurer.kvelds"]'
        self.assertIn('Ferdiglaget', pg.inner_text(blk + ' .dk-line'))
        self.assertEqual(pg.get_attribute(blk + ' [data-act="kidsdin"]', 'aria-pressed'), 'false')
        pg.click(blk + ' [data-act="kidsdin"]')                        # i dag spiser de med
        self.assertTrue(pg.evaluate("kidsEat('2026-10-07')"))
        self.assertNotIn('Ferdiglaget', pg.inner_text(blk + ' .dk-line'))
        pg.click(blk + ' [data-act="kidsdin"]')                        # tilbake til vanlig: ingen overstyring lagret
        self.assertIsNone(pg.evaluate("state.days['2026-10-07'].kidsDin ?? null"))
        pg.click('#tab-week'); pg.wait_for_selector('#sheet-root.open [data-kd="3"]'); pg.wait_for_timeout(400)
        pg.click('[data-kd="3"]')
        self.assertEqual(pg.evaluate('state.settings.kidsDinnerDays'), [2, 3, 4])

    def test_shopping_list_by_aisle_with_staples(self):
        pg = self.open(when=(2026, 10, 9, 9, 5))    # fredag
        cats = pg.evaluate("['Eggnudler', 'Kokosmelk', 'Grøtris', 'Revet ost', 'Wokgrønnsaker', 'Laksefilet', 'Bleier', 'Paprika', 'Tortillalefser'].map(shopCat)")
        self.assertEqual(cats, ['torr', 'torr', 'torr', 'meieri', 'frys', 'kjott', 'baby', 'frukt', 'brod'])
        self.assertEqual(pg.evaluate("splitAmount('400 g Kjøttdeig')"), {'amount': '400 g', 'name': 'Kjøttdeig'})
        pg.evaluate("commit(null, () => { state.settings.shopDay = 5; })")
        has_task = "Object.values(genRows(view, blocksFor(view))).flat().some(r => r.id === 'gen-shop')"
        self.assertTrue(pg.evaluate(has_task))                          # gjøremål på handledagen
        pg.click('#tab-week'); pg.wait_for_selector('#sheet-root.open [data-food="shop"]'); pg.wait_for_timeout(400)
        pg.click('[data-food="shop"]'); pg.wait_for_selector('#sheet-root.open [data-shop-done]')
        groups = pg.eval_on_selector_all('.shop-grp > .lbl', 'els => els.map(e => e.textContent)')
        self.assertIn('Baby og hygiene', groups)
        self.assertEqual(groups, [g for g in ['Frukt og grønt', 'Kjøtt og fisk', 'Meieri og egg', 'Brød og bakst', 'Tørrvarer og hermetikk', 'Frys', 'Baby og hygiene', 'Annet'] if g in groups])
        period = pg.evaluate('shopPeriod()')
        self.assertEqual((period['start'], period['end']), ('2026-10-09', '2026-10-15'))
        bleier = pg.evaluate("state.shop.staples.find(x => x.text === 'Bleier').id")
        pg.check('[data-shop="st:%s"]' % bleier)
        vs = pg.evaluate("state.shop.staples.find(x => x.text === 'Våtservietter').id")
        pg.check('[data-shop="st:%s"]' % vs)
        first = pg.get_attribute('.shop-grp [data-shop]:not([data-shop^="st:"])', 'data-shop')
        pg.check('[data-shop="%s"]' % first)
        pg.click('[data-shop-done]'); pg.wait_for_timeout(300)
        self.assertEqual(pg.evaluate("state.shop.staples.find(x => x.text === 'Bleier').last"), '2026-10-09')
        self.assertEqual(pg.evaluate('state.shop.boughtThrough'), '2026-10-15')
        self.assertEqual(pg.evaluate('Object.keys(state.shop.checked).length'), 0)
        self.assertEqual(pg.evaluate('shopPeriod().start'), '2026-10-16')
        self.assertTrue(pg.evaluate('state.shop.extra.length > 0'))     # ukrysset middagsvare flyttet til andre varer
        nxt = pg.evaluate("shopList().staples.map(x => x.text)")
        self.assertIn('Bleier', nxt)                                    # hver uke: med igjen neste tur
        self.assertNotIn('Våtservietter', nxt)                          # annenhver uke: ikke neste tur
        self.assertFalse(pg.evaluate(has_task))
        # flytt en vare til en annen kategori
        pg.evaluate("openShopCatSheet('Paprika', () => openShopSheet())"); pg.wait_for_selector('#sheet-root.open [data-cat="annet"]')
        pg.click('[data-cat="annet"]'); pg.wait_for_timeout(300)
        self.assertEqual(pg.evaluate("shopCat('paprika')"), 'annet')
        # legg til fra +
        pg.evaluate('closeSheet()'); pg.wait_for_timeout(300)
        pg.evaluate("openAddSheet('handle')"); pg.wait_for_selector('#sheet-root.open #q-shop')
        pg.fill('#q-shop', 'Tannbørste'); pg.click('.sh-foot [data-save]'); pg.wait_for_timeout(300)
        self.assertIn('Tannbørste', pg.evaluate('state.shop.extra.map(x => x.text)'))

    def test_age_health_visits_and_nap_advice(self):
        pg = self.open(when=(2026, 10, 7, 9, 5))
        # Sju dager der andre lur uteble
        pg.evaluate("""commit(null, () => { for (let i = 1; i <= 7; i++) { const d = addDays('2026-10-07', -i);
          for (const k of ['a', 'b']) logRec(d).sleep.push({ id: 's-' + i + k, kid: k, blockId: 'to-lurer.lur1', start: '09:15', end: '10:30' }); } })""")
        pg.evaluate("openProfileSheet(false)"); pg.wait_for_selector('#sheet-root.open [data-kborn]')
        for el in pg.query_selector_all('[data-kborn]'):
            el.fill('2025-09-22')
        pg.click('.sh-foot [data-save]'); pg.wait_for_timeout(400)
        self.assertEqual(pg.evaluate("state.kids.map(k => k.born)"), ['2025-09-22', '2025-09-22'])
        tasks = pg.evaluate("state.tasks.filter(t => t.text.includes('helsestasjonen')).map(t => [t.text, t.rule.start])")
        self.assertIn(['Sjekk at 15-månederskontrollen med MMR-vaksine for barnene er avtalt med helsestasjonen', '2026-12-01'], tasks)
        self.assertEqual(len(tasks), 3)                                   # 12 mnd er passert
        pg.evaluate("openProfileSheet(false)"); pg.wait_for_selector('#sheet-root.open [data-kborn]')
        pg.click('.sh-foot [data-save]'); pg.wait_for_timeout(400)
        self.assertEqual(pg.evaluate("state.tasks.filter(t => t.text.includes('helsestasjonen')).length"), 3)   # ikke dobbelt
        banner = pg.inner_text('#timeline .banner.stack')
        self.assertIn('Andre lur var kort eller uteble 7 av de siste 7 dagene', banner)
        self.assertIn('1 år', banner)
        pg.click('[data-act="nap-later"]')
        self.assertEqual(pg.eval_on_selector_all('#timeline .banner.stack', 'els => els.length'), 0)
        # Et barn på sju måneder får ikke forslaget
        pg.evaluate("commit(null, () => { delete state.settings.napHintUntil; state.kids.forEach(k => { k.born = '2026-03-01'; }); })")
        self.assertIsNone(pg.evaluate("napAdvice('2026-10-07')"))

    def test_sheets_fit_the_screen(self):
        pg = self.open(when=(2026, 10, 7, 9, 5))
        pg.set_viewport_size({'width': 360, 'height': 780})
        pg.evaluate("commit(null, () => { state.settings.textSize = 1.2; state.settings.shopDay = 6; state.shop.extra.push({ id: 'x1', text: 'Et svært langt varenavn som ikke får plass på én linje i det hele tatt' }); }); applyTheme();")
        wide = """() => { const W = document.documentElement.clientWidth, b = document.querySelector('#sheet-root .sh-body');
          const out = [...document.querySelectorAll('#sheet-root .sheet *')].filter(e => !e.closest('.tblwrap, svg, .vh') && e.getBoundingClientRect().width && e.getBoundingClientRect().right > W + 1).map(e => e.className || e.tagName);
          return (b.scrollWidth > b.clientWidth + 1 ? ['sh-body'] : []).concat(out).slice(0, 5); }"""
        for code in ['openShopSheet()', 'openWeekSheet()', 'openLogSheet(view)', 'openProfileSheet(false)', "openSuggestSheet(view, 'to-lurer.vaken2')", 'openHistorySheet()']:
            pg.evaluate('closeSheet(); ' + code); pg.wait_for_timeout(450)
            self.assertEqual(pg.evaluate(wide), [], code)

    def test_snow_play_needs_cold(self):
        pg = self.open(when=(2026, 10, 7, 11, 35))
        self.assertNotIn('a-sno', pg.evaluate("suggest(view, 11*60+30, 13*60+30).list.map(a => a.id)"))

    def test_filter_activities_by_place_and_category(self):
        pg = self.open(when=(2026, 10, 7, 11, 35))
        pg.evaluate("openSuggestSheet(view, 'to-lurer.vaken2')"); pg.wait_for_selector('#sheet-root.open .act-filter')
        visible = lambda: pg.eval_on_selector_all('#sheet-root [data-pick]', 'els => els.filter(e => !e.hidden).map(e => e.dataset.pick)')
        allv = visible()
        pg.click('[data-fkind="ute"]')
        ute = visible()
        self.assertTrue(ute and len(ute) < len(allv))
        self.assertTrue(all(pg.evaluate("id => state.activities.find(a => a.id === id).kind", i) == 'ute' for i in ute))
        pg.click('[data-fkind=""]'); pg.click('[data-ftag="sanser"]')
        self.assertIn('a-sanse', visible()); self.assertNotIn('a-ball', visible())
        pg.click('[data-ftag="sanser"]')                                 # samme igjen viser alle
        self.assertEqual(visible(), allv)
        # kategorier settes i redigeringen
        pg.evaluate("openActivitySheet('a-ball')"); pg.wait_for_selector('#sheet-root.open [data-tag="rolig"]')
        pg.click('[data-tag="rolig"]'); pg.click('.sh-foot [data-save]'); pg.wait_for_timeout(300)
        self.assertEqual(pg.evaluate("state.activities.find(a => a.id === 'a-ball').tags"), ['rolig', 'bevegelse'])

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
        self.expand(pg, 'to-lurer.kveld')
        self.assertTrue(pg.is_visible('.blk[data-id="to-lurer.kveld"] .tomorrow'))
        # Flytt rollen «legging» til leggeforberedelsen i bolkeditoren
        pg.evaluate("openBlockSheet('to-lurer.legg', 'to-lurer')")
        pg.click('#sheet-root details.more-sec > summary')             # rollen ligger under «Mer»
        pg.select_option('#f-role', 'bedtime')
        pg.click('.sh-foot [data-save="tpl"]')
        pg.wait_for_timeout(200)
        roles = pg.evaluate("Object.fromEntries(state.templates['to-lurer'].blocks.filter(b => b.role).map(b => [b.slot, b.role]))")
        self.assertEqual(roles, {'mme-morgen': 'wake', 'legg': 'bedtime', 'kveldsrutine': 'reset'})
        pg.evaluate('closeSheet()')
        pg.wait_for_timeout(300)
        self.assertTrue(pg.is_visible('.blk[data-id="to-lurer.legg"] .log.night'))

    def test_kids_word(self):
        pg = self.open()
        self.expand(pg, 'to-lurer.middag')
        self.assertIn('Barnene', pg.inner_text('.blk[data-id="to-lurer.middag"]'))
        pg.evaluate("openProfileSheet(false)")
        pg.fill('#p-kw', 'tvillingene')
        pg.click('.sh-foot [data-save]')
        pg.wait_for_timeout(300)
        self.expand(pg, 'to-lurer.middag')
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

    def test_calendar_jumps_to_a_day(self):
        pg = self.open()
        pg.click('#date')
        pg.wait_for_selector('#sheet-root.open .cal')
        self.assertEqual(pg.get_attribute('.cal [aria-current="date"]', 'data-go'), '2026-10-07')
        self.assertEqual(pg.inner_text('.cal .day[data-go="2026-10-08"] .c'), 'A')       # partnerens vakt
        pg.click('[data-month="2026-11"]')
        pg.click('.cal .day[data-go="2026-11-20"]')
        pg.wait_for_timeout(300)
        self.assertEqual(pg.evaluate('view'), '2026-11-20')
        self.assertIn('20. nov', pg.inner_text('#date'))

    def test_reorder_tasks_by_drag_and_keyboard(self):
        pg = self.open()
        pg.evaluate('openTasksSheet()')
        pg.wait_for_selector('#sheet-root.open [data-sortlist]')
        pg.wait_for_timeout(400)                          # vent til arket har glidd på plass
        order = lambda: pg.evaluate("state.tasks.map(t => t.id)")
        before = order()
        first, second = before[0], before[1]
        # Dra det andre gjøremålet over det første
        h2 = pg.locator('[data-sort="%s"] [data-handle]' % second).bounding_box()
        h1 = pg.locator('[data-sort="%s"] [data-handle]' % first).bounding_box()
        pg.mouse.move(h2['x'] + h2['width'] / 2, h2['y'] + h2['height'] / 2)
        pg.mouse.down()
        for i in range(1, 6):
            pg.mouse.move(h2['x'] + h2['width'] / 2, h2['y'] + h2['height'] / 2 - (h2['y'] - h1['y'] + 10) * i / 5)
        pg.mouse.up()
        after = order()
        self.assertEqual(after[:2], [second, first])
        self.assertEqual(sorted(after), sorted(before))
        # Tastatur: pil ned flytter det tilbake
        pg.focus('[data-sort="%s"] [data-handle]' % second)
        pg.keyboard.press('ArrowDown')
        self.assertEqual(order(), before)
        pg.click('#undo')
        self.assertEqual(order()[:2], [second, first])

    def test_reorder_checklist_in_block_editor(self):
        pg = self.open()
        pg.evaluate("openBlockSheet('to-lurer.kveld')")
        pg.wait_for_selector('#sheet-root.open #f-items')
        texts = lambda: pg.eval_on_selector_all('#f-items input', 'els => els.map(e => e.value)')
        before = texts()
        pg.focus('#f-items .item:nth-child(3) [data-handle]')
        pg.keyboard.press('ArrowUp')
        pg.keyboard.press('ArrowUp')
        moved = texts()
        self.assertEqual(moved[0], before[2])
        pg.click('.sh-foot [data-save="day"]')
        pg.wait_for_timeout(200)
        self.assertEqual(pg.evaluate("blocksFor('2026-10-07').find(b => b.slot === 'kveld').items.map(i => i.text)"), moved)
        self.assertEqual(pg.evaluate("state.templates['to-lurer'].blocks.find(b => b.slot === 'kveld').items[0].text"), before[0])

    # ---------- designrunde 2 ----------
    def touch_swipe(self, pg, x0, y0, x1, y1, steps=8):
        cdp = pg.context.new_cdp_session(pg)
        cdp.send('Input.dispatchTouchEvent', {'type': 'touchStart', 'touchPoints': [{'x': x0, 'y': y0}]})
        for i in range(1, steps + 1):
            cdp.send('Input.dispatchTouchEvent', {'type': 'touchMove', 'touchPoints': [{'x': x0 + (x1 - x0) * i / steps, 'y': y0 + (y1 - y0) * i / steps}]})
        cdp.send('Input.dispatchTouchEvent', {'type': 'touchEnd', 'touchPoints': []})
        pg.wait_for_timeout(500)

    def test_compact_timeline(self):
        pg = self.open(when=(2026, 10, 7, 9, 5))
        full = pg.eval_on_selector_all('.blk:not(.compact):not(.past)', 'els => els.map(e => e.dataset.id)')
        self.assertIn('to-lurer.vaken-kort', full)                  # bolken dere er i
        self.assertIn('to-lurer.lur1', full)                        # neste
        self.assertIn('to-lurer.middag', pg.eval_on_selector_all('.blk.compact', 'els => els.map(e => e.dataset.id)'))
        self.assertIn('forslag:', pg.inner_text('.blk[data-id="to-lurer.vaken2"]'))
        pg.click('.blk[data-id="to-lurer.vaken2"] .head')           # trykk folder ut
        self.assertTrue(pg.is_visible('.blk[data-id="to-lurer.vaken2"] .sugg'))
        pg.click('.blk[data-id="to-lurer.vaken2"] .head')           # trykk på tittelen igjen: én linje
        self.assertIn('compact', pg.get_attribute('.blk[data-id="to-lurer.vaken2"]', 'class'))
        pg.click('.blk[data-id="to-lurer.lur1"] .head')              # også neste bolk kan gjøres kompakt
        self.assertIn('compact', pg.get_attribute('.blk[data-id="to-lurer.lur1"]', 'class'))
        pg.click('.blk[data-id="to-lurer.lur1"] .head')
        pg.click('.blk[data-id="to-lurer.lur1"] .edit-btn')          # blyanten redigerer
        pg.wait_for_selector('#sheet-root.open #f-start')
        pg.evaluate('closeSheet()'); pg.wait_for_timeout(300)
        pg.click('[data-act="toggle-all"]')
        self.assertEqual(pg.eval_on_selector_all('.blk.compact', 'els => els.length'), 0)

    def test_day_strip_and_bottom_bar(self):
        pg = self.open(when=(2026, 10, 7, 9, 5))
        self.assertEqual(pg.eval_on_selector_all('#strip .bar > span', 'els => els.length'), 17)
        self.assertTrue(pg.is_visible('#strip .mark'))
        box = pg.locator('#strip .strip').bounding_box()
        pg.mouse.click(box['x'] + box['width'] * 0.99, box['y'] + box['height'] / 2)   # helt til høyre: nullstillingen
        pg.wait_for_timeout(300)
        self.assertTrue(pg.evaluate("expanded.has('to-lurer.kveld')"))
        pg.click('#tab-week'); pg.wait_for_selector('#sheet-root.open')
        self.assertIn('Ukemeny', pg.inner_text('#sheet-root .sh-head'))
        pg.evaluate('closeSheet()'); pg.wait_for_timeout(300)
        pg.evaluate("go(1)")
        self.assertEqual(pg.get_attribute('#tab-today', 'aria-current'), 'false')
        pg.click('#tab-today')
        self.assertEqual(pg.evaluate('view'), '2026-10-07')

    def test_swipe_between_days(self):
        pg = self.open(when=(2026, 10, 7, 14, 10))
        self.touch_swipe(pg, 330, 600, 60, 610)
        self.assertEqual(pg.evaluate('view'), '2026-10-08')
        self.touch_swipe(pg, 60, 600, 330, 605)
        self.assertEqual(pg.evaluate('view'), '2026-10-07')
        self.touch_swipe(pg, 200, 700, 190, 300)                      # loddrett: ingen dagbytte
        self.assertEqual(pg.evaluate('view'), '2026-10-07')
        self.touch_swipe(pg, 330, 600, 290, 600)                      # for kort: blir på dagen
        self.assertEqual(pg.evaluate('view'), '2026-10-07')
        self.assertEqual(pg.evaluate("document.querySelector('#timeline').style.transform"), '')

    def test_swipe_in_sheets(self):
        pg = self.open(when=(2026, 10, 7, 14, 10))
        pg.click('#date'); pg.wait_for_selector('#sheet-root.open .cal'); pg.wait_for_timeout(400)
        box = pg.locator('.cal').bounding_box()
        y = box['y'] + box['height'] / 2
        self.touch_swipe(pg, box['x'] + box['width'] - 20, y, box['x'] + 20, y)
        self.assertIn('November', pg.inner_text('.cal-m'))
        head = pg.locator('.sh-head').bounding_box()
        self.touch_swipe(pg, 200, head['y'] + 20, 200, head['y'] + 260)   # dra ned lukker
        pg.wait_for_timeout(300)
        self.assertFalse(pg.evaluate('sheetOpen()'))
        pg.evaluate('openTasksSheet()'); pg.wait_for_selector('#sheet-root.open'); pg.wait_for_timeout(400)
        self.touch_swipe(pg, 8, 500, 200, 505)                            # fra venstre kant: tilbake til menyen
        self.assertIn('Meny', pg.inner_text('#sheet-root .sh-head'))
        body = pg.locator('.sh-body').last.bounding_box()
        self.touch_swipe(pg, 200, body['y'] + 60, 200, body['y'] + 320)   # dra ned fra innholdet øverst lukker
        pg.wait_for_timeout(300)
        self.assertFalse(pg.evaluate('sheetOpen()'))

    def test_page_does_not_scroll_past_the_ends(self):
        pg = self.open(when=(2026, 10, 7, 14, 10))
        pg.evaluate("window.scrollTo(0, 0); window._pd = []; window.addEventListener('touchmove', e => _pd.push(e.defaultPrevented))")
        self.touch_swipe(pg, 200, 400, 200, 700)                       # dra ned fra toppen: ingenting skjer
        self.assertTrue(all(pg.evaluate('_pd')) and pg.evaluate('_pd.length') > 0)
        pg.evaluate("_pd = []")
        self.touch_swipe(pg, 200, 700, 200, 400)                       # oppover er det mer innhold
        self.assertFalse(any(pg.evaluate('_pd')))
        pg.evaluate("openLogSheet(view)"); pg.wait_for_selector('#sheet-root.open'); pg.wait_for_timeout(400)
        pg.evaluate("_pd = []")
        head = pg.locator('.sh-head').bounding_box()
        self.touch_swipe(pg, 300, head['y'] + 20, 300, head['y'] - 200)   # toppen av arket kan ikke blas
        self.assertTrue(all(pg.evaluate('_pd')))

    def test_rates_and_switches(self):
        pg = self.open(when=(2026, 10, 7, 13, 40))
        pg.click('.blk[data-id="to-lurer.middag"] [data-act="rate"][data-kid="a"][data-val="godt"]')
        self.assertEqual(pg.evaluate("getLog('2026-10-07').meals['to-lurer.middag'].a"), 'godt')
        pg.click('.blk[data-id="to-lurer.middag"] [data-act="rate"][data-kid="a"][data-val="godt"]')   # samme igjen fjerner
        self.assertIsNone(pg.evaluate("getLog('2026-10-07').meals['to-lurer.middag'].a ?? null"))
        pg.evaluate('openProfileSheet(false)'); pg.wait_for_selector('#sheet-root.open [data-show="nowbar"]')
        pg.click('[data-show="nowbar"]')
        self.assertEqual(pg.get_attribute('[data-show="nowbar"]', 'aria-checked'), 'false')
        self.assertTrue(pg.evaluate('!showOn("nowbar")'))

    def test_block_editor_time_first(self):
        pg = self.open()
        pg.evaluate("openBlockSheet('to-lurer.middag')"); pg.wait_for_selector('#sheet-root.open #f-start')
        order = pg.evaluate("[...document.querySelectorAll('#bf > *')].map(e => e.querySelector('h3, summary') && e.querySelector('h3, summary').textContent)")
        self.assertEqual(order[0], 'Tid')
        self.assertFalse(pg.is_visible('#f-role'))                     # under «Mer»
        self.assertEqual(pg.evaluate("[...document.querySelectorAll('.sh-body')].pop().innerText.includes('rubrikk')"), False)


    # ---------- deling med Takt ----------
    def _fake_github(self, pg, files):
        """Et privat repo i minnet som svarer som GitHubs API."""
        import base64, re as _re

        def handle(route):
            req = route.request
            m = _re.match(r'https://api\.github\.com/repos/[^/]+/[^/]+(/contents/(.+))?$', req.url.split('?')[0])
            if not m or not m.group(1):
                return route.fulfill(status=200, content_type='application/json', body=json.dumps({'private': True}))
            path = m.group(2)
            if req.method == 'PUT':
                files[path] = base64.b64decode(json.loads(req.post_data)['content']).decode('utf-8')
                return route.fulfill(status=200, content_type='application/json', body='{}')
            if path not in files:
                return route.fulfill(status=404, body='{}')
            if 'raw' in (req.headers.get('accept') or ''):
                return route.fulfill(status=200, content_type='text/plain', body=files[path])
            return route.fulfill(status=200, content_type='application/json', body=json.dumps({'sha': 'x'}))
        pg.route('https://api.github.com/**', handle)
        pg.evaluate("""() => { sync.cfg = { owner: 't', repo: 'd', token: 'x', path: 'dogn-backup.json', lastPush: '', lastError: '', dirty: false }; }""")

    TAKT_FILE = {
        'format': 'takt-deling', 'v': 1, 'updated': '2026-10-07T05:00:00Z', 'name': 'Kari',
        'rota': {'codes': {'D': {'label': 'Dagvakt', 'kind': 'work', 'start': '07:00', 'end': '15:00'},
                           'A14': {'label': 'Aftenvakt', 'kind': 'work', 'start': '14:30', 'end': '22:00'},
                           'N': {'label': 'Natt', 'kind': 'night', 'start': '21:15', 'end': '07:30'}},
                 'shifts': {'2026-10-07': 'D', '2026-10-08': 'A14', '2026-10-09': 'N'},
                 'custom': {'2026-10-10': {'start': '08:00', 'end': '12:00', 'label': 'Kurs'}}},
        'away': {'2026-10-07': {'leave': '06:00', 'back': '15:48', 'backDay': 0, 'chosenTo': True, 'chosenHome': False, 'basis': 'fastest'},
                 '2026-10-08': {'leave': '13:40', 'back': '22:40', 'backDay': 0, 'chosenTo': False, 'chosenHome': False, 'basis': 'fastest'},
                 '2026-10-09': {'leave': '20:25', 'back': '08:20', 'backDay': 1, 'chosenTo': False, 'chosenHome': False, 'basis': 'set'},
                 '2026-10-11': {'leave': '<b>', 'back': '99:99'}},
        'items': [{'id': 't1', 'kind': 'todo', 'date': '2026-10-07', 'time': '', 'title': 'Ringe <legen>', 'note': '', 'done': False},
                  {'id': 't2', 'kind': 'appt', 'date': '2026-10-07', 'time': '13:00', 'title': 'Frisør', 'note': '', 'done': False},
                  {'id': 't3', 'kind': 'shop', 'date': '', 'time': '', 'title': 'Bleier', 'note': '', 'done': False}],
    }

    def test_takt_rota_absence_and_items(self):
        pg = self.open()
        files = {'takt-deling.json': json.dumps(self.TAKT_FILE)}
        self._fake_github(pg, files)
        pg.evaluate('() => pullTakt()')
        pg.wait_for_function('() => state.partner.source === "takt"')
        P = pg.evaluate('() => state.partner')
        self.assertEqual(P['shifts'], self.TAKT_FILE['rota']['shifts'])
        self.assertIn('A14', P['codes'])
        self.assertEqual(P['custom']['2026-10-10']['label'], 'Kurs')
        # Fraværet vises i toppen, med * for valgt reise og ~ for beregnet
        self.assertIn('borte 06:00* – ~15:48', pg.inner_text('#sub'))
        # Middagen: hjemme 15:48 før middag. Aftenvakt: borte fra 13:40, ikke hjemme. Natt: går 20:25, hjemme til middag.
        self.assertEqual(pg.evaluate("() => ['2026-10-07', '2026-10-08', '2026-10-09'].map(d => partnerHome(d).home)"), [True, False, True])
        self.assertEqual(pg.evaluate("() => awayText(taktAway('2026-10-09'))"), '~20:25 – ~08:20 (+1)')
        self.assertIsNone(pg.evaluate("() => taktAway('2026-10-11')"), 'ugyldige tider forkastes')
        self.assertIn('Kurs', pg.evaluate("() => shiftText(partnerStatus('2026-10-10'))"))
        # Delte punkter: gjøremål kan krysses av, avtaler vises, handling havner på handlelisten én gang
        banner = pg.inner_text('.banner.takt')
        self.assertIn('Ringe <legen>', banner)
        self.assertIn('13:00 Frisør', banner)
        pg.check('input[data-tk="t1"]')
        self.assertTrue(pg.evaluate('() => state.partner.acks.t1'))
        self.assertEqual(pg.evaluate("() => state.shop.extra.filter(x => x.text === 'Bleier').length"), 1)
        pg.evaluate('() => pullTakt()')
        pg.wait_for_timeout(200)
        self.assertEqual(pg.evaluate("() => state.shop.extra.filter(x => x.text === 'Bleier').length"), 1)
        # Dagen hjemme sendes til Takt, med avkryssingen
        pg.evaluate('() => pushShare()')
        pg.wait_for_function('() => !sync.cfg.shareDirty && !!sync.cfg.lastShare')
        share = json.loads(files['dogn-deling.json'])
        self.assertEqual(share['format'], 'dogn-deling')
        self.assertEqual(sorted(share['days']), ['2026-10-06', '2026-10-07', '2026-10-08'])
        self.assertTrue(share['acks']['t1']['done'])
        self.assertIn('Bleier', share['shop'])
        self.assertEqual([k['name'] for k in share['kids']], ['Ola', 'Kari'])
        self.assertNotIn('token', json.dumps(share))

    def test_share_file_shows_who_sleeps(self):
        pg = self.open()
        pg.evaluate("""() => { commit('', () => logNightNow('2026-10-06', roleBlock(blocksFor('2026-10-06'), 'bedtime').id, ['a', 'b']));
          commit('', () => { const n = logRec('2026-10-06').night; n.a.wake = '06:40'; }); }""")
        day = pg.evaluate("() => shareFile().days['2026-10-06']")
        night = {e['kid']: e for e in day['sleep'] if e['night']}
        self.assertEqual(night['a']['end'], '06:40')
        self.assertEqual(night['b']['end'], '', 'Kari sover fortsatt')
        blocks = pg.evaluate("() => shareFile().days['2026-10-07'].blocks")
        self.assertTrue(all(b['start'] and b['end'] for b in blocks))


if __name__ == '__main__':
    unittest.main()
