/* PUTT_MEMBERS_ONLY_V1 — panel.puttclub.ir فقط «داشبورد»؛ مدیریت به adminpanel.puttclub.ir منتقل شده.
   این اسکریپت در <head> و پیش از همهٔ اسکریپت‌های برنامه اجرا می‌شود (inject.py) و فقط
   بخش‌هایی را که در moved.json آمده‌اند از منو، میان‌برها و مسیرها برمی‌دارد.
   کد برنامه (golf-academy-pro) دست نمی‌خورد؛ اعضا دقیقاً همان رفتار قبلی را دارند. */
(function () {
  'use strict';
  var MOVED = __MOVED__;
  var ADMIN_URL = 'https://adminpanel.puttclub.ir/';
  var NAMES = { mgmt: 'پنل مدیریت', users: 'یوزرها', subs: 'اشتراک‌ها', settings: 'تنظیمات نمایش', backup: 'پشتیبان آکادمی', messages: 'ارسال پیام' };
  var ALL = ['mgmt', 'users', 'subs', 'settings', 'backup', 'messages'];
  var moved = {};
  MOVED.forEach(function (p) { moved[p] = 1; });
  var allMoved = ALL.every(function (p) { return moved[p] === 1; });
  window.PUTT_MEMBERS_ONLY = Object.freeze({ moved: MOVED.slice(), adminUrl: ADMIN_URL, complete: allMoved });
  if (!MOVED.length) return;

  /* 1) منو و میان‌برها: آیتم منو + هر دکمه‌ای که مستقیم به آن بخش می‌رود */
  var sel = [];
  MOVED.forEach(function (p) {
    sel.push('#app .nav-item[data-page="' + p + '"]');
    sel.push('[onclick*="APP.go(\'' + p + '\')"]');
  });
  if (allMoved) sel.push('#mgmt-group');
  var css = sel.join(',\n') + '{display:none!important}';
  try {
    var st = document.createElement('style');
    st.id = 'putt-members-only';
    st.textContent = css;
    (document.head || document.documentElement).appendChild(st);
  } catch (e) {}

  function notice(p) {
    var msg = '«' + (NAMES[p] || p) + '» به ادمین‌پنل منتقل شده است: adminpanel.puttclub.ir';
    try { if (window.APP && APP.toast) { APP.toast(msg, 'orange'); return; } } catch (e) {}
  }

  /* 2) آدرس مستقیم (#mgmt و …) هنگام باز شدن صفحه → فرماندهی */
  function pageFromHash() { return (location.hash || '').replace(/^#/, ''); }
  try {
    if (moved[pageFromHash()] === 1) history.replaceState(null, '', location.pathname + location.search + '#cmd');
  } catch (e) {}

  /* 3) دکمهٔ Back/Forward یا تایپ دستی hash: پیش از شنوندهٔ خود برنامه اجرا می‌شود */
  window.addEventListener('popstate', function (e) {
    var pg = (e.state && e.state.p) || pageFromHash();
    if (moved[pg] !== 1) return;
    e.stopImmediatePropagation();
    try { history.replaceState({ p: 'cmd' }, '', '#cmd'); } catch (e2) {}
    notice(pg);
    try { if (window.APP && APP.go) APP.go('cmd'); } catch (e3) {}
  });

  /* 4) هر فراخوانی APP.go به بخش منتقل‌شده (دکمه‌های داخل صفحات، چیپ اشتراک، …) */
  function wrap(app) {
    if (!app || typeof app.go !== 'function' || app.__puttMembersOnly) return app;
    var og = app.go;
    app.go = function (page) {
      if (moved[page] === 1) { notice(page); return; }
      return og.apply(this, arguments);
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
