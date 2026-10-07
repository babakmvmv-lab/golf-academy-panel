#!/usr/bin/env python3
"""Inject the members-only guard into the built panel (idempotent).

    python3 members-only/inject.py index.html

Reads members-only/moved.json (page ids and «پنل مدیریت» tab ids `mgmt:<tab>` moved to
adminpanel.puttclub.ir)
and places guard.js inline right after <meta charset="UTF-8">, i.e. before every
app script. Re-running replaces the previous block, so the sync workflow and
manual stages can both call it safely.
"""
import json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
BEGIN, END = '<!--PUTT_MEMBERS_ONLY:BEGIN-->', '<!--PUTT_MEMBERS_ONLY:END-->'
TABS = ['academy', 'players', 'courses', 'tournaments', 'programs', 'results', 'calendar', 'reception',
        'contact', 'info', 'users', 'coins', 'honor', 'shop', 'battle', 'avatars', 'labels']
VALID = {'mgmt', 'users', 'subs', 'settings', 'backup', 'messages'} | {'mgmt:' + t for t in TABS}

def main(path):
    moved = json.load(open(os.path.join(HERE, 'moved.json'), encoding='utf-8'))
    if not isinstance(moved, list) or any(p not in VALID for p in moved) or len(set(moved)) != len(moved):
        sys.exit('moved.json: expected a list of unique ids from %s' % sorted(VALID))
    guard = open(os.path.join(HERE, 'guard.js'), encoding='utf-8').read()
    if '__MOVED__' not in guard:
        sys.exit('guard.js: __MOVED__ placeholder missing')
    guard = guard.replace('__MOVED__', json.dumps(moved))
    # نقش مدیر: تب‌های «پنل مدیریت» که مدیر در همین پنل می‌بیند (admin.json؛ [[tab, عنوان], …])
    admin_path = os.path.join(HERE, 'admin.json')
    admin = json.load(open(admin_path, encoding='utf-8')) if os.path.exists(admin_path) else []
    if not isinstance(admin, list) or any(not (isinstance(a, list) and len(a) == 2 and a[0] in TABS and isinstance(a[1], str) and a[1]) for a in admin) or len({a[0] for a in admin}) != len(admin):
        sys.exit('admin.json: expected [[tab, title], …] with unique tabs from %s' % TABS)
    if '__ADMIN__' not in guard:
        sys.exit('guard.js: __ADMIN__ placeholder missing')
    guard = guard.replace('__ADMIN__', json.dumps(admin, ensure_ascii=False))
    html = open(path, encoding='utf-8').read()
    html = re.sub(r'\n?' + re.escape(BEGIN) + r'.*?' + re.escape(END) + r'\n?', '', html, flags=re.S)
    marker = '<meta charset="UTF-8">'
    if html.count(marker) < 1:
        sys.exit('inject: <meta charset="UTF-8"> not found')
    block = BEGIN + '<script>' + guard + '</script>' + END + '\n'
    html = html.replace(marker, marker + '\n' + block, 1)
    open(path, 'w', encoding='utf-8').write(html)
    print('members-only guard:', moved or '(none moved yet)', '| admin tabs:', [a[0] for a in admin])

if __name__ == '__main__':
    main(sys.argv[1] if len(sys.argv) > 1 else 'index.html')
