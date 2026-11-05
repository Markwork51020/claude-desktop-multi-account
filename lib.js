// Работа с папками данных Claude: общие настройки и общая история сессий.
const fs = require('fs');
const path = require('path');

// Файлы настроек, которые берём из основного Claude (MCP, пресеты, переключатели инструментов).
const SHARED_FILES = ['claude_desktop_config.json', 'mcp-user-tool-toggles.json', 'ccd-session-presets.json'];
// Папки вида <аккаунт>\<организация>, которые сводим в одну общую с основным Claude.
const SHARED_DIRS = ['claude-code-sessions'];

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

const hasSessionFiles = dir => fs.readdirSync(dir).some(n => n.startsWith('local_'));

// Своя папка сессий профиля -> ставим вместо неё junction на общую папку основного аккаунта,
// а её файлы переносим туда. live = копия сейчас запущена: тогда трогаем только папки без сессий
// (сразу после входа), чтобы не потерять то, что копия пишет прямо сейчас.
function mergeSessions(mainData, profileDir, { live = false } = {}) {
  const linked = [];
  for (const sub of SHARED_DIRS) {
    const target = mainOrgDir(mainData, sub);
    const base = path.join(profileDir, sub);
    if (!target || !fs.existsSync(base)) continue;
    for (const acc of fs.readdirSync(base)) {
      const accDir = path.join(base, acc);
      if (!fs.lstatSync(accDir).isDirectory()) continue;
      for (const org of fs.readdirSync(accDir)) {
        const p = path.join(accDir, org), st = fs.lstatSync(p);
        if (org.endsWith('.cm-old') || st.isSymbolicLink() || !st.isDirectory()) continue;
        if (live && hasSessionFiles(p)) continue;
        const old = p + '.cm-old';
        try { fs.renameSync(p, old); } catch { continue; }       // папка занята — попробуем в другой раз
        try { fs.symlinkSync(target, p, 'junction'); } catch (e) { fs.renameSync(old, p); throw e; }
        copyMissing(old, target);
        fs.rmSync(old, { recursive: true, force: true });
        linked.push(p);
      }
    }
  }
  return linked;
}

// Есть ли в профиле своя (ещё не общая) папка сессий.
function hasUnlinkedSessions(profileDir) {
  for (const sub of SHARED_DIRS) {
    const base = path.join(profileDir, sub);
    try {
      for (const acc of fs.readdirSync(base)) for (const org of fs.readdirSync(path.join(base, acc))) {
        const st = fs.lstatSync(path.join(base, acc, org));
        if (st.isDirectory() && !st.isSymbolicLink() && !org.endsWith('.cm-old')) return true;
      }
    } catch { }
  }
  return false;
}

// Перед удалением профиля снимаем junction'ы, чтобы не задеть данные основного Claude.
function unlinkShared(profileDir) {
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

module.exports = { mainOrgDir, mergeSessions, hasUnlinkedSessions, unlinkShared, syncSettings, isLoginLink, SHARED_FILES, SHARED_DIRS };
