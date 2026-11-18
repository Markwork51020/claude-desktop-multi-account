// Работа с папками данных Claude: общие настройки и общая история сессий.
const fs = require('fs');
const path = require('path');

// Файлы настроек, которые берём из основного Claude (MCP, пресеты, переключатели инструментов).
const SHARED_FILES = ['claude_desktop_config.json', 'mcp-user-tool-toggles.json', 'ccd-session-presets.json'];
// Папки вида <аккаунт>\<организация>, которые синхронизируем с общей папкой основного Claude.
const SHARED_DIRS = ['claude-code-sessions'];
// Папки, которые целиком делаем общими с основным Claude (связи сессий с их субсессиями).
const SHARED_FLAT = ['side-session-notes'];

// Самая свежая папка аккаунт\организация в основном Claude — это текущий основной аккаунт.
function mainOrgDir(mainData, sub) {
  const base = path.join(mainData, sub);
  let best = null;
  try {
    for (const acc of fs.readdirSync(base)) {
      if (!fs.statSync(path.join(base, acc)).isDirectory()) continue;
      for (const org of fs.readdirSync(path.join(base, acc))) {
        const p = path.join(base, acc, org), st = fs.statSync(p);
        if (st.isDirectory() && (!best || st.mtimeMs > best.t)) best = { p, t: st.mtimeMs };
      }
    }
  } catch { }
  return best && best.p;
}

function copyMissing(from, to) {
  fs.mkdirSync(to, { recursive: true });
  for (const name of fs.readdirSync(from)) {
    const s = path.join(from, name), d = path.join(to, name);
    if (fs.statSync(s).isDirectory()) copyMissing(s, d);
    else if (!fs.existsSync(d)) fs.copyFileSync(s, d);
  }
}

// Файлы сессий, которые держим одинаковыми: описания сессий и метки удаления.
const SYNC_RE = /^(local_.*\.json|deleted_[0-9a-f-]+)$/;

function copyFile(s, d, st) {
  const tmp = d + '.cm-tmp';
  fs.writeFileSync(tmp, fs.readFileSync(s));
  fs.utimesSync(tmp, st.atime, st.mtime);   // тот же mtime — иначе файл гонялся бы туда-обратно
  fs.renameSync(tmp, d);
}

// Две папки сессий -> одинаковые: более новый файл копируем в другую сторону,
// а по метке удаления deleted_<id> убираем local_<id>.json и там, где его ещё не удалили.
function syncDirs(a, b) {
  const list = dir => { const m = new Map(); for (const n of fs.readdirSync(dir)) if (SYNC_RE.test(n)) { try { m.set(n, fs.statSync(path.join(dir, n))); } catch { } } return m; };
  const A = list(a), B = list(b);
  let n = 0;
  for (const name of new Set([...A.keys(), ...B.keys()])) {
    const x = A.get(name), y = B.get(name);
    try {
      if (x && (!y || x.mtimeMs - y.mtimeMs > 1)) { copyFile(path.join(a, name), path.join(b, name), x); n++; }
      else if (y && (!x || y.mtimeMs - x.mtimeMs > 1)) { copyFile(path.join(b, name), path.join(a, name), y); n++; }
    } catch { }   // файл заняли или удалили прямо сейчас — в следующий раз
  }
  for (const name of new Set([...A.keys(), ...B.keys()])) {
    if (!name.startsWith('deleted_')) continue;
    const f = 'local_' + name.slice(8) + '.json';
    for (const dir of [a, b]) try { fs.unlinkSync(path.join(dir, f)); n++; } catch { }
  }
  return n;
}

// Папки сессий профиля (<аккаунт>\<организация>) держим настоящими папками: Claude отказывается
// сохранять сессии в junction. Старый junction меняем на папку с копией общих сессий, затем
// синхронизируем её с общей папкой основного Claude. Работает и при запущенной копии.
function syncSessions(mainData, profileDir) {
  let n = 0;
  for (const sub of SHARED_DIRS) {
    const target = mainOrgDir(mainData, sub);
    const base = path.join(profileDir, sub);
    if (!target || !fs.existsSync(base)) continue;
    for (const acc of fs.readdirSync(base)) {
      const accDir = path.join(base, acc);
      if (!fs.lstatSync(accDir).isDirectory()) continue;
      for (const org of fs.readdirSync(accDir)) {
        const p = path.join(accDir, org);
        if (org.endsWith('.cm-old')) continue;
        let st = fs.lstatSync(p);
        if (st.isSymbolicLink()) {
          fs.unlinkSync(p);                 // снимаем только ссылку, общая папка цела
          copyMissing(target, p);
          st = fs.lstatSync(p);
        }
        if (st.isDirectory()) n += syncDirs(p, target);
      }
    }
  }
  return n;
}

// Папки из SHARED_FLAT профиля -> junction на такие же папки основного Claude (только пока копия закрыта).
function linkFlat(mainData, profileDir) {
  for (const sub of SHARED_FLAT) {
    const target = path.join(mainData, sub), p = path.join(profileDir, sub);
    fs.mkdirSync(target, { recursive: true });
    let st = null; try { st = fs.lstatSync(p); } catch { }
    if (st && st.isSymbolicLink()) continue;
    if (st) {
      const old = p + '.cm-old';
      fs.renameSync(p, old);
      try { fs.symlinkSync(target, p, 'junction'); } catch (e) { fs.renameSync(old, p); throw e; }
      copyMissing(old, target);
      fs.rmSync(old, { recursive: true, force: true });
    } else fs.symlinkSync(target, p, 'junction');
  }
}

// Перед удалением профиля снимаем junction'ы, чтобы не задеть данные основного Claude.
function unlinkShared(profileDir) {
  for (const sub of SHARED_FLAT) {
    const p = path.join(profileDir, sub);
    try { if (fs.lstatSync(p).isSymbolicLink()) fs.unlinkSync(p); } catch { }
  }
  for (const sub of SHARED_DIRS) {
    const base = path.join(profileDir, sub);
    try {
      for (const acc of fs.readdirSync(base)) for (const org of fs.readdirSync(path.join(base, acc))) {
        const p = path.join(base, acc, org);
        if (fs.lstatSync(p).isSymbolicLink()) fs.unlinkSync(p);
      }
    } catch { }
  }
}

function syncSettings(mainData, profileDir) {
  fs.mkdirSync(profileDir, { recursive: true });
  for (const f of SHARED_FILES) {
    const s = path.join(mainData, f);
    if (fs.existsSync(s)) fs.copyFileSync(s, path.join(profileDir, f));
  }
}

// Ссылки входа (письмо, Google, SSO) — их надо отдать той копии, что ждёт входа.
function isLoginLink(link) {
  let u; try { u = new URL(link); } catch { return false; }
  if (u.protocol !== 'claude:') return false;
  if (u.host === 'claude.ai') return /^\/(magic-link|sso-callback)(\/|$)/.test(u.pathname);
  return u.host === 'login' && u.pathname === '/google-auth';
}

// Чаты Code, открытые сейчас в копиях Claude. Берём процессы Claude Code, которые запустил
// Claude Desktop (папка claude-code, --resume=<id чата>), и смотрим, из чьей папки данных каждый.
// Возвращает [{ chat, owners: ['main' | id аккаунта, ...] }].
function liveChats(cmdLines, accountIds) {
  const owners = new Map();
  for (const line of cmdLines) {
    const low = line.toLowerCase();
    if (!low.includes('\\claude-code\\') || !low.includes('stream-json')) continue;
    const m = /--resume[= ]"?([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/.exec(low);
    if (!m) continue;
    let owner = 'main';
    const p = /\\profiles\\([0-9a-z]+)\\claude-code\\/.exec(low);
    if (p) { owner = accountIds.find(id => id.toLowerCase() === p[1]); if (!owner) continue; }
    if (!owners.has(m[1])) owners.set(m[1], new Set());
    owners.get(m[1]).add(owner);
  }
  return [...owners].map(([chat, s]) => ({ chat, owners: [...s] }));
}

// Те же чаты, но только открытые сразу в 2+ копиях.
const sharedChats = (cmdLines, accountIds) => liveChats(cmdLines, accountIds).filter(d => d.owners.length > 1);

// Названия чатов по их id из описаний сессий основного Claude (общих для всех копий).
function chatTitles(mainData, chats) {
  const want = new Set(chats), titles = {};
  if (!want.size) return titles;
  const base = path.join(mainData, 'claude-code-sessions');
  try {
    for (const acc of fs.readdirSync(base)) for (const org of fs.readdirSync(path.join(base, acc))) {
      const dir = path.join(base, acc, org);
      for (const f of fs.readdirSync(dir)) {
        if (!/^local_.*\.json$/.test(f)) continue;
        try {
          const s = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
          if (want.has(s.cliSessionId) && s.title) titles[s.cliSessionId] = s.title;
        } catch { }
      }
    }
  } catch { }
  return titles;
}

// Последний замер лимитов, который Claude пишет в plan-usage-history.json:
// fh — % пятичасового лимита, sd — % недельного, t — время замера.
function usage(dataDir) {
  try {
    const j = JSON.parse(fs.readFileSync(path.join(dataDir, 'plan-usage-history.json'), 'utf8'));
    const s = j.samples && j.samples[j.samples.length - 1];
    if (s && s.u) return { t: s.t, fh: s.u.fh, sd: s.u.sd };
  } catch { }
  return null;
}

module.exports = { usage, mainOrgDir, syncSessions, syncDirs, linkFlat, liveChats, unlinkShared, syncSettings, isLoginLink, sharedChats, chatTitles, SHARED_FILES, SHARED_DIRS, SHARED_FLAT };
