/* پنل اعضا + نقش مدیر: آیتم بازشوندهٔ «پنل مدیریت» (تقویم، دوره‌ها، مسابقات، نتایج) — E2E هرمتیک.
 * همهٔ ترافیک Supabase با mock_cloud.cjs ریپوی golf-academy-pro پاسخ داده می‌شود؛ هیچ نوشتن زنده‌ای نیست.
 * اجرا:
 *   PRO=/path/to/golf-academy-pro  (پس از python3 source/build_standalone.py)
 *   NODE_PATH=…/node_modules CHROME=…/chrome node members-only/test/admin_nav_e2e.cjs
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const { chromium } = require('playwright-core');
const PRO = process.env.PRO || '/tmp/golf-academy-pro';
const { createMockCloud } = require(path.join(PRO, 'source/e2e/mock_cloud.cjs'));
const EXE = process.env.CHROME || undefined;
const BASE = 'https://qa.local/index.html';
const HERE = path.join(__dirname, '..');

/* همان مراحل گردش‌کار sync: ساخت برنامه + تزریق guard */
const RAW = path.join(PRO, 'source/GolfAcademy_PRO.html');
const GUARDED = path.join(os.tmpdir(), 'panel_admin_nav_index.html');
fs.copyFileSync(RAW, GUARDED);
execFileSync('python3', [path.join(HERE, 'inject.py'), GUARDED], { stdio: 'inherit' });
const ADMIN_TABS = JSON.parse(fs.readFileSync(path.join(HERE, 'admin.json'), 'utf8'));

const SUBS = [{ id: 'sqa-p1', plan: 'trial', user: 'p1', user_id: 101, status: 'trial', start_date: '2026-01-01', end_date: '2099-01-01', start_at: '2026-01-01', end_at: '2099-01-01', events: [] }];
const FIXTURE = () => ({
  ga_subscriptions: SUBS,
  ga_avatars: { p1: { v6: 1, gender: 'm', sel: {}, owned: [], lvl: 8 } },
  ga_coins: { p1: { total: 40, log: [], v7auto: 1 } },
});
const ACCOUNTS = [
  { id: 1, user: 'admin', pass: 'Admin-Pass-QA1', name: 'مدیر آکادمی', role: 'admin', main: true },
  { id: 101, user: 'p1', pass: 'Member-Pass-QA1', name: 'بازیکن یک', role: 'member', pid: 1 },
];

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else fail++; console.log((c ? 'PASS' : 'FAIL') + ' | ' + m); };
const IGNORE = /livePrep|Charts\.spark|sp-1/;

(async () => {
  const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  async function device(html) {
    const cloud = createMockCloud({ store: FIXTURE(), accounts: ACCOUNTS });
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 } });
    await cloud.attach(ctx, html);
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', e => { if (!IGNORE.test(e.message + (e.stack || ''))) errors.push(e.message); });
    await page.goto(BASE, { waitUntil: 'load', timeout: 60000 });
    return { cloud, ctx, page, errors };
  }
  async function login(page, u, p) {
    await page.waitForSelector('#login.on', { timeout: 20000 });
    await page.fill('#login-user', u);
    await page.fill('#login-pass', p);
    await page.click('#login-form button[type="submit"]');
    await page.waitForFunction(() => document.getElementById('app').classList.contains('on'), null, { timeout: 25000 }).catch(() => {});
    await page.waitForTimeout(2500);
  }
  const visible = (page, sel) => page.evaluate(s => { const e = document.querySelector(s); if (!e) return false; const r = e.getBoundingClientRect(); return getComputedStyle(e).display !== 'none' && r.width > 0 && r.height > 0; }, sel);
  const hash = page => page.evaluate(() => location.hash);
  const bodyText = page => page.evaluate(() => { const b = document.getElementById('mgmt-body'); return b ? b.innerText.replace(/\s+/g, ' ').trim() : ''; });

  /* ── ۱) عضو: هیچ تغییری ── */
  {
    const { ctx, page, errors } = await device(GUARDED);
    await login(page, 'p1', 'Member-Pass-QA1');
    ok(await page.evaluate(() => document.getElementById('app').classList.contains('on')), 'عضو p1 وارد شد');
    ok(!(await visible(page, '#putt-admin-nav')), 'عضو آیتم «پنل مدیریت» را نمی‌بیند');
    ok(!(await page.evaluate(() => document.documentElement.classList.contains('putt-admin'))), 'عضو حالت مدیر ندارد');
    await page.evaluate(() => APP.go('mgmt'));
    await page.waitForTimeout(500);
    ok(!(await page.evaluate(() => !!document.getElementById('mgmt-body'))) && (await hash(page)) !== '#mgmt', 'عضو با APP.go هم به «پنل مدیریت» نمی‌رسد');
    ok(errors.length === 0, 'بدون خطای صفحه (عضو) ' + errors.join(' | '));
    await ctx.close();
  }

  /* ── ۲) مدیر: آیتم بازشونده با ۴ زیرآیتم، هرکدام همان تب ادمین‌پنل ── */
  const guardedText = {};
  {
    const { cloud, ctx, page, errors } = await device(GUARDED);
    await login(page, 'admin', 'Admin-Pass-QA1');
    ok(await page.evaluate(() => document.getElementById('app').classList.contains('on')), 'مدیر وارد شد');
    ok(await visible(page, '#putt-admin-nav .putt-admin-toggle'), 'مدیر آیتم «پنل مدیریت» را در منو می‌بیند');
    ok(!(await visible(page, '#putt-admin-nav [data-admin-tab]')), 'زیرآیتم‌ها در ابتدا بسته‌اند');
    await page.click('#putt-admin-nav .putt-admin-toggle');
    const subs = await page.evaluate(() => Array.from(document.querySelectorAll('#putt-admin-nav [data-admin-tab]')).filter(n => n.getBoundingClientRect().height > 0).map(n => [n.getAttribute('data-admin-tab'), n.innerText.trim()]));
    ok(JSON.stringify(subs) === JSON.stringify(ADMIN_TABS), 'با کلیک باز شد: ' + subs.map(s => s[1]).join('، '));
    ok(await page.evaluate(() => document.querySelector('#putt-admin-nav .putt-admin-toggle').getAttribute('aria-expanded')) === 'true', 'aria-expanded=true');
    const hidden = await page.evaluate(() => ['users', 'subs', 'settings', 'backup', 'messages', 'mgmt'].filter(p => { const e = document.querySelector('#app .nav-item[data-page="' + p + '"]'); return e && e.getBoundingClientRect().height > 0; }));
    ok(hidden.length === 0, 'بقیهٔ بخش‌های مدیریتی همچنان فقط در ادمین‌پنل‌اند');
    for (const [tab, title] of ADMIN_TABS) {
      await page.click('#putt-admin-nav [data-admin-tab="' + tab + '"]');
      await page.waitForTimeout(700);
      const st = await page.evaluate(t => ({
        on: (document.querySelector('.mgmt-tab.on') || {}).getAttribute ? document.querySelector('.mgmt-tab.on').getAttribute('data-tab') : '',
        active: document.querySelector('#putt-admin-nav [data-admin-tab="' + t + '"]').classList.contains('active'),
        stripHidden: getComputedStyle(document.querySelector('.mgmt-tabs')).display === 'none',
        reseedHidden: !document.getElementById('mgmt-reseed') || getComputedStyle(document.getElementById('mgmt-reseed')).display === 'none',
      }), tab);
      const txt = await bodyText(page);
      guardedText[tab] = txt;
      ok((await hash(page)) === '#mgmt' && st.on === tab && txt.length > 40, '«' + title + '» باز شد (تب ' + tab + '، ' + txt.length + ' نویسه)');
      ok(st.active && st.stripHidden && st.reseedHidden, '«' + title + '»: زیرآیتم فعال، نوار تب‌ها و «بازنشانی فصل» پنهان');
    }
    // تب غیرمجاز از راه دیگر ← اولین تب مجاز
    await page.evaluate(() => { const t = document.querySelector('.mgmt-tab[data-tab="players"]'); if (t) t.click(); });
    await page.waitForTimeout(600);
    ok(await page.evaluate(() => document.querySelector('.mgmt-tab.on').getAttribute('data-tab')) === ADMIN_TABS[0][0], 'تبی که برای مدیرِ پنل باز نیست (بازیکنان) به «' + ADMIN_TABS[0][1] + '» برمی‌گردد');
    await page.evaluate(() => APP.go('users'));
    await page.waitForTimeout(400);
    ok((await hash(page)) !== '#users', 'یوزرها همچنان از پنل بسته است');

    /* ── ۳) قابلیت واقعی: ثبت رویداد در تقویم ← ذخیره در ابر با نقش مدیر ── */
    await page.click('#putt-admin-nav [data-admin-tab="calendar"]');
    await page.waitForTimeout(600);
    await page.fill('#me-name', 'رویداد آزمایشی مدیر پنل');
    await page.click('#me-add');
    await page.waitForTimeout(400);
    const okBtn = await page.$('.confirm-pop .btn, .cp-yes, [data-cp-yes]');
    if (okBtn) { await okBtn.click().catch(() => {}); }
    await page.waitForFunction(() => !JSON.parse(localStorage.getItem('ga_cloud_dirty') || '{}').ga_events, null, { timeout: 20000 }).catch(() => {});
    const ev = cloud.store.ga_events && JSON.stringify(cloud.store.ga_events.v);
    ok(!!ev && ev.includes('رویداد آزمایشی مدیر پنل'), 'رویداد ثبت‌شده در ابر ذخیره شد (ga_events)');
    const sent = cloud.log.filter(l => l.kind === 'sync' && l.keys && l.keys.includes('ga_events'));
    ok(sent.length > 0 && sent.every(l => l.status === 200 && l.user === 'admin'), 'ارسال با حساب مدیر و تأیید سرور (HTTP 200)');
    // ماندن در وضعیت باز پس از رفرش
    await page.reload({ waitUntil: 'load' });
    await page.waitForFunction(() => document.getElementById('app').classList.contains('on'), null, { timeout: 25000 }).catch(() => {});
    await page.waitForTimeout(2000);
    ok(await visible(page, '#putt-admin-nav [data-admin-tab="calendar"]'), 'پس از رفرش منو باز می‌ماند');
    ok(errors.length === 0, 'بدون خطای صفحه (مدیر) ' + errors.join(' | '));
    await ctx.close();
  }

  /* ── ۴) هم‌سانی با ادمین‌پنل: همان برنامه بدون guard (همان کدی که ادمین‌پنل باز می‌کند) ── */
  {
    const { ctx, page } = await device(RAW);
    await login(page, 'admin', 'Admin-Pass-QA1');
    for (const [tab, title] of ADMIN_TABS) {
      await page.evaluate(() => APP.go('mgmt'));
      await page.evaluate(t => { const e = document.querySelector('.mgmt-tab[data-tab="' + t + '"]'); if (e) e.click(); }, tab);
      await page.waitForTimeout(600);
      const txt = await bodyText(page);
      ok(txt === guardedText[tab], '«' + title + '» دقیقاً همان محتوای نسخهٔ کامل (ادمین‌پنل) را دارد');
    }
    await ctx.close();
  }

  await browser.close();
  console.log('\n' + pass + ' PASS, ' + fail + ' FAIL');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
