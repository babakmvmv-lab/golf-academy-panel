/* PUTT_MEMBERS_ONLY_V2 — panel.puttclub.ir فقط «داشبورد»؛ مدیریت به adminpanel.puttclub.ir منتقل شده.
   این اسکریپت در <head> و پیش از همهٔ اسکریپت‌های برنامه اجرا می‌شود (inject.py) و فقط
   بخش‌هایی را که در moved.json آمده‌اند از منو، میان‌برها و مسیرها برمی‌دارد.
   شناسه‌ها:  صفحه‌ها  users | subs | settings | backup | messages | mgmt
              تب‌های «پنل مدیریت»  mgmt:<tab>  (مثلاً mgmt:players)
   وقتی همهٔ ۱۷ تب منتقل شوند، خودِ «پنل مدیریت» (mgmt) هم منتقل‌شده حساب می‌شود.
   کد برنامه (golf-academy-pro) دست نمی‌خورد؛ داده‌ها و رفتار اعضا دقیقاً مثل قبل است.
   استثنای مدیر (admin.json): یوزری که با نقش «مدیر» وارد می‌شود یک آیتم بازشوندهٔ «پنل مدیریت» در منو می‌بیند
   با همان تب‌های فهرست‌شده (تقویم، دوره‌ها، مسابقات، نتایج) — همان کد و همان داده‌ای که ادمین‌پنل باز می‌کند. */
(function () {
  'use strict';
  var MOVED = __MOVED__;
  var ADMIN_TABS = __ADMIN__;   // [[tab, عنوان], …] به ترتیب منو
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
  window.PUTT_MEMBERS_ONLY = Object.freeze({ moved: MOVED.slice(), adminUrl: ADMIN_URL, complete: groupGone, adminTabs: ADMIN_TABS.map(function (t) { return t[0]; }) });
  /* نقش مدیر: فقط پس از ورود و از پروفایل ابری (ga_accounts.role) — نه از حافظهٔ دستگاه */
  var adminOn = false;
  var adminTab = {}; ADMIN_TABS.forEach(function (t) { adminTab[t[0]] = 1; });
  function blockedPage(pg) { return moved[pg] === 1 && !(adminOn && pg === 'mgmt' && ADMIN_TABS.length); }
  function blockedTab(t) { return movedTabs[t] === 1 && !(adminOn && adminTab[t] === 1); }
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
    markAdminNav();
    if (fixing || (moved.mgmt === 1 && !adminOn)) return;
    var on = document.querySelector('.mgmt-tab.on');
    if (!on || !blockedTab(on.getAttribute('data-tab'))) return;
    var rest = adminOn
      ? ADMIN_TABS.map(function (t) { return document.querySelector('.mgmt-tab[data-tab="' + t[0] + '"]'); }).filter(Boolean)
      : Array.prototype.filter.call(document.querySelectorAll('.mgmt-tab'), function (t) { return !blockedTab(t.getAttribute('data-tab')); });
    fixing = true;
    try { if (rest[0]) rest[0].click(); else if (window.APP && APP.go) APP.go('cmd'); } finally { fixing = false; }
  }
  var pending = false;
  function schedule() {
    if (pending) return;
    pending = true;
    (window.requestAnimationFrame || setTimeout)(function () { pending = false; fixTab(); });
  }
  if (Object.keys(movedTabs).length && (moved.mgmt !== 1 || ADMIN_TABS.length)) {
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
    if (!blockedPage(pg)) return;
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
      if (blockedPage(page)) { notice(NAMES[page] || page); return; }
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

  /* 6) منوی بازشوندهٔ «پنل مدیریت» برای نقش مدیر */
  if (!ADMIN_TABS.length) return;
  var SVG = function (d) { return '<svg class="si" viewBox="0 0 24 24" aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg">' + d + '</svg>'; };
  var ICONS = {
    mgmt: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
    calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>',
    programs: '<path d="M22 10 12 5 2 10l10 5 10-5z"/><path d="M6 12v5c3 2 9 2 12 0v-5"/>',
    tournaments: '<path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0z"/><path d="M17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3"/>',
    results: '<path d="M3 3v18h18"/><path d="M7 15l4-4 3 3 5-6"/>',
    chevron: '<path d="M6.5 9.5 12 15l5.5-5.5"/>'
  };
  var OPEN_KEY = 'putt_admin_nav_open';
  try {
    var st2 = document.createElement('style');
    st2.id = 'putt-admin-nav-style';
    st2.textContent = [
      '#putt-admin-nav{display:none}',
      'html.putt-admin #putt-admin-nav{display:block}',
      'html.putt-admin .mgmt-tabs,html.putt-admin #mgmt-reseed{display:none!important}',
      '#putt-admin-nav .putt-admin-toggle .putt-chev{margin-inline-start:auto;display:inline-flex;transition:transform .2s}',
      '#putt-admin-nav .putt-admin-toggle .putt-chev svg{width:16px;height:16px}',
      '#putt-admin-nav.open .putt-admin-toggle .putt-chev{transform:rotate(180deg)}',
      '#putt-admin-nav.has-active .putt-admin-toggle{color:var(--gold-l)}',
      '#putt-admin-nav .putt-admin-sub{display:none;margin:2px 0 6px;padding-inline-start:14px;border-inline-start:1px solid var(--line-soft,rgba(212,175,55,.18));margin-inline-start:22px}',
      '#putt-admin-nav.open .putt-admin-sub{display:block}',
      '#putt-admin-nav .putt-admin-sub .nav-item{font-size:13px;padding-top:8px;padding-bottom:8px}'
    ].join('\n');
    (document.head || document.documentElement).appendChild(st2);
  } catch (e) {}

  function isAdminUser() {
    try {
      var p = window.GA_AUTH && GA_AUTH.profile && GA_AUTH.profile();
      return !!(p && p.active !== false && p.role === 'admin');
    } catch (e) { return false; }
  }
  function appOn() { var a = document.getElementById('app'); return !!(a && a.classList.contains('on')); }
  function onMgmt() { return (location.hash || '').replace(/^#/, '') === 'mgmt' && !!document.querySelector('.mgmt-tabs'); }
  function markAdminNav() {
    var nav = document.getElementById('putt-admin-nav');
    if (!nav) return;
    var on = onMgmt() ? document.querySelector('.mgmt-tab.on') : null, cur = on ? on.getAttribute('data-tab') : '';
    Array.prototype.forEach.call(nav.querySelectorAll('[data-admin-tab]'), function (n) { n.classList.toggle('active', n.getAttribute('data-admin-tab') === cur); });
    nav.classList.toggle('has-active', !!cur && adminTab[cur] === 1);
    if (cur && adminTab[cur] === 1) nav.classList.add('open');
  }
  function openAdminTab(tab) {
    if (!window.APP || typeof APP.go !== 'function' || adminTab[tab] !== 1) return;
    APP.go('mgmt');
    var t = document.querySelector('.mgmt-tab[data-tab="' + tab + '"]');
    if (t && !t.classList.contains('on')) t.click();
    var v = document.getElementById('view'); if (v) v.scrollTop = 0;
    try { window.scrollTo(0, 0); } catch (e) {}
    document.body.classList.remove('nav-open');
    markAdminNav();
  }
  function ensureNav() {
    if (document.getElementById('putt-admin-nav')) return;
    var anchor = document.getElementById('mgmt-group');
    var side = anchor ? anchor.parentNode : document.querySelector('#app .nav-item') && document.querySelector('#app .nav-item').parentNode;
    if (!side) return;
    var wrap = document.createElement('div');
    wrap.id = 'putt-admin-nav';
    var open = false; try { open = sessionStorage.getItem(OPEN_KEY) === '1'; } catch (e) {}
    if (open) wrap.className = 'open';
    var html = '<div class="nav-item putt-admin-toggle" role="button" tabindex="0" aria-expanded="' + open + '"><span class="ico">' + SVG(ICONS.mgmt) + '</span><span>' + NAMES.mgmt + '</span><span class="putt-chev">' + SVG(ICONS.chevron) + '</span></div><div class="putt-admin-sub" role="group" aria-label="' + NAMES.mgmt + '">';
    ADMIN_TABS.forEach(function (t) {
      html += '<div class="nav-item putt-admin-link" role="button" tabindex="0" data-admin-tab="' + t[0] + '"><span class="ico">' + SVG(ICONS[t[0]] || ICONS.mgmt) + '</span><span>' + t[1] + '</span></div>';
    });
    wrap.innerHTML = html + '</div>';
    if (anchor) side.insertBefore(wrap, anchor); else side.appendChild(wrap);
    var tog = wrap.querySelector('.putt-admin-toggle');
    var toggle = function () {
      var isOpen = wrap.classList.toggle('open');
      tog.setAttribute('aria-expanded', String(isOpen));
      try { sessionStorage.setItem(OPEN_KEY, isOpen ? '1' : '0'); } catch (e) {}
    };
    tog.addEventListener('click', toggle);
    tog.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); } });
    Array.prototype.forEach.call(wrap.querySelectorAll('[data-admin-tab]'), function (n) {
      var go = function () { openAdminTab(n.getAttribute('data-admin-tab')); };
      n.addEventListener('click', go);
      n.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } });
    });
    markAdminNav();
  }
  function refreshRole() {
    var a = appOn() && isAdminUser();
    if (a !== adminOn) {
      adminOn = a;
      document.documentElement.classList.toggle('putt-admin', a);
      if (!a && onMgmt() && window.APP && APP.go) { try { APP.go('cmd'); } catch (e) {} }
    }
    if (a) ensureNav();
  }
  window.addEventListener('ga-auth-changed', function () { setTimeout(refreshRole, 0); });
  var watchApp = function () {
    var app = document.getElementById('app');
    if (!app) return setTimeout(watchApp, 200);
    new MutationObserver(refreshRole).observe(app, { attributes: true, attributeFilter: ['class'] });
    refreshRole();
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', watchApp); else watchApp();
})();
