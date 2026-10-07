/* PUTT_MEMBERS_ONLY_V2 — panel.puttclub.ir فقط «داشبورد»؛ مدیریت به adminpanel.puttclub.ir منتقل شده.
   این اسکریپت در <head> و پیش از همهٔ اسکریپت‌های برنامه اجرا می‌شود (inject.py) و فقط
   بخش‌هایی را که در moved.json آمده‌اند از منو، میان‌برها و مسیرها برمی‌دارد.
   شناسه‌ها:  صفحه‌ها  users | subs | settings | backup | messages | mgmt
              تب‌های «پنل مدیریت»  mgmt:<tab>  (مثلاً mgmt:players)
   وقتی همهٔ ۱۷ تب منتقل شوند، خودِ «پنل مدیریت» (mgmt) هم منتقل‌شده حساب می‌شود.
   کد برنامه (golf-academy-pro) دست نمی‌خورد؛ داده‌ها و رفتار اعضا دقیقاً مثل قبل است. */
(function () {
  'use strict';
  var MOVED = __MOVED__;
  var ADMIN_URL = 'https://adminpanel.puttclub.ir/';
  var GROUP_PAGES = ['users', 'subs', 'settings', 'backup', 'messages'];
  var TABS = ['academy', 'players', 'courses', 'tournaments', 'programs', 'results', 'calendar', 'reception',
              'contact', 'info', 'users', 'coins', 'honor', 'shop', 'battle', 'avatars', 'labels'];
  var NAMES = { mgmt: 'پنل مدیریت', users: 'یوزرها', subs: 'اشتراک‌ها', settings: 'تنظیمات نمایش', backup: 'پشتیبان آکادمی', messages: 'ارسال پیام' };

  var moved = {}, movedTabs = {};
  MOVED.forEach(function (p) {
    if (p.indexOf('mgmt:') === 0) movedTabs[p.slice(5)] = 1; else moved[p] = 1;
  });
  if (TABS.every(function (t) { return movedTabs[t] === 1; })) moved.mgmt = 1;
  if (moved.mgmt === 1) TABS.forEach(function (t) { movedTabs[t] = 1; });
  var groupGone = moved.mgmt === 1 && GROUP_PAGES.every(function (p) { return moved[p] === 1; });
  window.PUTT_MEMBERS_ONLY = Object.freeze({ moved: MOVED.slice(), adminUrl: ADMIN_URL, complete: groupGone });
  if (!MOVED.length) return;

  /* 1) منو، تب‌ها و میان‌برها */
  var sel = [];
  Object.keys(moved).forEach(function (p) {
    sel.push('#app .nav-item[data-page="' + p + '"]');
    sel.push('[onclick*="APP.go(\'' + p + '\')"]');
  });
  Object.keys(movedTabs).forEach(function (t) { sel.push('.mgmt-tab[data-tab="' + t + '"]'); });
  if (groupGone) sel.push('#mgmt-group');
  try {
    var st = document.createElement('style');
    st.id = 'putt-members-only';
    st.textContent = sel.join(',\n') + '{display:none!important}';
    (document.head || document.documentElement).appendChild(st);
  } catch (e) {}

  function notice(name) {
    var msg = '«' + name + '» به ادمین‌پنل منتقل شده است: adminpanel.puttclub.ir';
    try { if (window.APP && APP.toast) APP.toast(msg, 'orange'); } catch (e) {}
  }

  /* 2) تبِ فعالِ «پنل مدیریت» اگر منتقل شده باشد → اولین تبِ باقی‌مانده */
  var fixing = false;
  function fixTab() {
    if (fixing || moved.mgmt === 1) return;
    var on = document.querySelector('.mgmt-tab.on');
    if (!on || movedTabs[on.getAttribute('data-tab')] !== 1) return;
    var rest = Array.prototype.filter.call(document.querySelectorAll('.mgmt-tab'), function (t) {
      return movedTabs[t.getAttribute('data-tab')] !== 1;
    });
    fixing = true;
    try { if (rest[0]) rest[0].click(); else if (window.APP && APP.go) APP.go('cmd'); } finally { fixing = false; }
  }
  var pending = false;
  function schedule() {
    if (pending) return;
    pending = true;
    (window.requestAnimationFrame || setTimeout)(function () { pending = false; fixTab(); });
  }
  if (Object.keys(movedTabs).length && moved.mgmt !== 1) {
    var startObs = function () {
      var view = document.getElementById('view');
      if (!view) return setTimeout(startObs, 200);
      new MutationObserver(schedule).observe(view, { childList: true });
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', startObs); else startObs();
  }

  /* 3) آدرس مستقیم (#users و …) هنگام باز شدن صفحه → فرماندهی */
  function pageFromHash() { return (location.hash || '').replace(/^#/, ''); }
  try {
    if (moved[pageFromHash()] === 1) history.replaceState(null, '', location.pathname + location.search + '#cmd');
  } catch (e) {}

  /* 4) دکمهٔ Back/Forward یا تایپ دستی hash: پیش از شنوندهٔ خود برنامه اجرا می‌شود */
  window.addEventListener('popstate', function (e) {
    var pg = (e.state && e.state.p) || pageFromHash();
    if (moved[pg] !== 1) return;
    e.stopImmediatePropagation();
    try { history.replaceState({ p: 'cmd' }, '', '#cmd'); } catch (e2) {}
    notice(NAMES[pg] || pg);
    try { if (window.APP && APP.go) APP.go('cmd'); } catch (e3) {}
  });

  /* 5) هر فراخوانی APP.go به بخش منتقل‌شده (دکمه‌های داخل صفحات، چیپ اشتراک، …) */
  function wrap(app) {
    if (!app || typeof app.go !== 'function' || app.__puttMembersOnly) return app;
    var og = app.go;
    app.go = function (page) {
      if (moved[page] === 1) { notice(NAMES[page] || page); return; }
      var r = og.apply(this, arguments);
      if (page === 'mgmt') schedule();
      return r;
    };
    try { Object.defineProperty(app, '__puttMembersOnly', { value: true }); } catch (e) { app.__puttMembersOnly = true; }
    return app;
  }
  var current;
  try {
    Object.defineProperty(window, 'APP', {
      configurable: true,
      enumerable: true,
      get: function () { return current; },
      set: function (v) { current = wrap(v); }
    });
  } catch (e) {}
})();
