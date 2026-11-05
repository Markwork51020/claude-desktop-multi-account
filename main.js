// Claude Multi — запускалка нескольких копий Claude Desktop, у каждой свой вход.
const { app, BrowserWindow, ipcMain, dialog, shell, Menu } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const crypto = require('crypto');
const { spawn, execFile, execFileSync } = require('child_process');
const lib = require('./lib');

const LOCAL = process.env.LOCALAPPDATA;
const MAIN_DATA = path.join(process.env.APPDATA, 'Claude');           // данные основного Claude
const ALIAS = path.join(LOCAL, 'Microsoft', 'WindowsApps', 'claude-desktop.exe');
// Не в AppData: Claude из Microsoft Store прячет всё новое, что создаёт в AppData, в своё закрытое
// хранилище, и обычные программы (в том числе этот лаунчер) его не видят.
const ROOT = path.join(os.homedir(), '.claude-multi');
const PROFILES = path.join(ROOT, 'profiles');
const STORE = path.join(ROOT, 'accounts.json');
const OLD_ROOT = path.join(LOCAL, 'ClaudeMulti');                     // место до версии 1.1
const COLORS = ['#6a9bcc', '#788c5d', '#b07cc6', '#c9a227', '#4fa3a5', '#c46a8a', '#d97757', '#8a8f98'];
const LOGIN_WAIT = 60 * 60e3;      // сколько копия считается «ждущей входа» после открытия
const HISTORY_WAIT = 30 * 60e3;    // сколько после входа ждём, когда у копии появится папка сессий
const COLD_START_WAIT = 15e3;      // сколько закрытой копии даём на запуск, прежде чем отдать ссылку
const PROGID = 'ClaudeMulti.Link';
// Ярлык Microsoft Store — особая точка повторной обработки, fs.existsSync её не видит.
const hasClaude = () => { try { fs.lstatSync(ALIAS); return true; } catch { return false; } };

let win = null;
let state = { accounts: [], shareSettings: true, shareSessions: true };
let linkMode = 'none';             // кто открывает ссылки claude://: ours | other | none

const readJson = f => JSON.parse(fs.readFileSync(f, 'utf8').replace(/^﻿/, ''));
function load() { try { state = Object.assign(state, readJson(STORE)); } catch { } }
function save() { fs.mkdirSync(ROOT, { recursive: true }); fs.writeFileSync(STORE, JSON.stringify(state, null, 2)); }
// legacy: профиль ещё лежит в старом месте; путь передаём Claude в том виде, в каком он его видит.
const dirOf = a => a.legacy ? path.join(OLD_ROOT, 'profiles', a.id) : path.join(PROFILES, a.id);

// Старые места: обычная папка и закрытое хранилище Claude из Microsoft Store.
function oldRoots() {
  const roots = [OLD_ROOT];
  try {
    for (const p of fs.readdirSync(path.join(LOCAL, 'Packages')))
      if (/^Claude_/.test(p)) roots.push(path.join(LOCAL, 'Packages', p, 'LocalCache', 'Local', 'ClaudeMulti'));
  } catch { }
  return roots;
}
function migrate() {
  if (fs.existsSync(STORE)) return;
  for (const root of oldRoots()) {
    let old; try { old = readJson(path.join(root, 'accounts.json')); } catch { continue; }
    for (const a of old.accounts || []) {
      const phys = path.join(root, 'profiles', a.id);
      if (!state.accounts.some(x => x.id === a.id) && fs.existsSync(phys)) state.accounts.push({ ...a, legacy: phys });
    }
    for (const k of ['shareSettings', 'shareSessions']) if (k in old) state[k] = old[k];
  }
  save();
}
// Переносим профиль из старого места, пока копия закрыта (вход и данные сохраняются).
function moveLegacy(a) {
  if (!a.legacy) return;
  try {
    fs.mkdirSync(PROFILES, { recursive: true });
    fs.renameSync(a.legacy, path.join(PROFILES, a.id));
    delete a.legacy; save();
  } catch (e) { console.error('move failed', e.code); }
}

// Какие профили сейчас запущены: ищем процессы Claude с нашим --user-data-dir.
function runningDirs() {
  try {
    const out = execFileSync('powershell.exe', ['-NoProfile', '-Command',
      "Get-CimInstance Win32_Process -Filter \"Name='claude.exe'\" | ForEach-Object { $_.CommandLine }"],
      { encoding: 'utf8', windowsHide: true, timeout: 15000 });
    return out.toLowerCase();
  } catch { return ''; }
}
const isRunning = (a, procs) => procs.includes(`\\profiles\\${a.id}`.toLowerCase());

function noClaude() {
  dialog.showErrorBox('Claude не найден', 'Не найден claude-desktop.exe. Установите Claude Desktop из Microsoft Store или с claude.ai/download.');
}
const runClaude = args => spawn(ALIAS, args, { detached: true, stdio: 'ignore' }).unref();

function launch(id) {
  if (!hasClaude()) { noClaude(); return false; }
  if (id === 'main') { runClaude([]); return true; }
  const a = state.accounts.find(x => x.id === id); if (!a) return false;
  // Пока копия не запущена — переносим из старого места, обновляем общие настройки и связываем историю.
  if (!isRunning(a, runningDirs())) {
    moveLegacy(a);
    if (!a.legacy) {
      fs.mkdirSync(dirOf(a), { recursive: true });
      try { if (state.shareSettings) lib.syncSettings(MAIN_DATA, dirOf(a)); } catch (e) { console.error(e); }
      try { if (state.shareSessions) lib.mergeSessions(MAIN_DATA, dirOf(a)); } catch (e) { console.error(e); }
    }
  }
  runClaude(['--user-data-dir=' + dirOf(a)]);
  a.lastOpened = Date.now(); save(); sendState();
  return true;
}

// ---- Ссылки claude:// ----
// Windows отдаёт ссылки Claude Multi (если пользователь выбрал его). Ссылку входа отправляем копии,
// которая ждёт входа, всё остальное — основному Claude. Сами ссылки нигде не записываем.
function waitingAccount() {
  return state.accounts.filter(a => a.needsLogin && !a.legacy && Date.now() - (a.lastOpened || 0) < LOGIN_WAIT)
    .sort((x, y) => y.lastOpened - x.lastOpened)[0];
}
function handleLink(link) {
  if (!hasClaude()) { noClaude(); return; }
  load();
  const a = lib.isLoginLink(link) && waitingAccount();
  if (!a) { runClaude([link]); return; }
  const send = () => runClaude(['--user-data-dir=' + dirOf(a), link]);
  // Закрытая копия при запуске ссылку теряет: сначала открываем её, ссылку отдаём, когда она готова.
  if (isRunning(a, runningDirs())) send();
  else { launch(a.id); setTimeout(send, COLD_START_WAIT); }
  a.needsLogin = false; a.historyUntil = Date.now() + HISTORY_WAIT; save(); sendState();
  watchHistory();
}
const linkArg = argv => argv.find(x => /^claude:/i.test(x));

function reg(args) {
  return new Promise(res => execFile('reg.exe', args, { windowsHide: true, encoding: 'utf8' }, (e, out) => res(e ? '' : out)));
}
// Регистрируем Claude Multi как ещё одну программу для ссылок claude:// (только для этого пользователя).
// Значение по умолчанию не меняем: при первом клике Windows сама спросит, чем открыть.
async function registerLinks() {
  if (!app.isPackaged) return;
  const cls = 'HKCU\\Software\\Classes\\' + PROGID, cap = 'HKCU\\Software\\ClaudeMulti\\Capabilities';
  const cmd = `"${process.execPath}" --link "%1"`;
  if (!(await reg(['query', cls + '\\shell\\open\\command', '/ve'])).includes(cmd)) {
    await reg(['add', cls, '/ve', '/d', 'URL:Claude link', '/f']);
    await reg(['add', cls + '\\DefaultIcon', '/ve', '/d', `"${process.execPath}",0`, '/f']);
    await reg(['add', cls + '\\shell\\open\\command', '/ve', '/d', cmd, '/f']);
    await reg(['add', cap, '/v', 'ApplicationName', '/d', 'Claude Multi', '/f']);
    await reg(['add', cap, '/v', 'ApplicationDescription', '/d', 'Отдаёт ссылки входа нужной копии Claude', '/f']);
    await reg(['add', cap + '\\URLAssociations', '/v', 'claude', '/d', PROGID, '/f']);
    await reg(['add', 'HKCU\\Software\\RegisteredApplications', '/v', 'Claude Multi', '/d', 'Software\\ClaudeMulti\\Capabilities', '/f']);
  }
  await checkLinkMode();
}
async function checkLinkMode() {
  const out = await reg(['query', 'HKCU\\Software\\Microsoft\\Windows\\Shell\\Associations\\UrlAssociations\\claude\\UserChoice', '/v', 'ProgId']);
  const m = out.match(/ProgId\s+REG_SZ\s+(\S+)/i);
  const mode = !m ? 'none' : m[1] === PROGID ? 'ours' : 'other';
  if (mode !== linkMode) { linkMode = mode; sendState(); }
}

// ---- История сессий сразу после входа ----
// После входа у копии появляется своя папка сессий; как только она есть — меняем её на общую.
let historyTimer = null;
function watchHistory() {
  if (historyTimer) return;
  historyTimer = setInterval(() => {
    const now = Date.now(), list = state.accounts.filter(a => a.historyUntil > now);
    if (state.shareSessions) for (const a of list) {
      try {
        if (lib.mergeSessions(MAIN_DATA, dirOf(a), { live: true }).length) { delete a.historyUntil; save(); }
      } catch (e) { console.error(e); }
    }
    if (!state.accounts.some(a => a.historyUntil > now)) {
      clearInterval(historyTimer); historyTimer = null;
      if (!win) app.quit();
    }
  }, 5000);
}
const busy = () => state.accounts.some(a => a.historyUntil > Date.now());

function sendState() {
  if (!win || win.isDestroyed()) return;
  load();   // список могли изменить снаружи — всегда берём с диска
  const procs = runningDirs();
  win.webContents.send('state', {
    accounts: state.accounts.map(a => ({ ...a, running: isRunning(a, procs), waiting: a === waitingAccount() })),
    shareSettings: state.shareSettings, shareSessions: state.shareSessions,
    hasClaude: hasClaude(), linkMode, canRoute: app.isPackaged
  });
}

function createWindow() {
  win = new BrowserWindow({
    width: 420, height: 640, minWidth: 360, minHeight: 440, title: 'Claude Multi', backgroundColor: '#1f1e1d',
    icon: path.join(__dirname, 'icon.ico'), autoHideMenuBar: true,
    webPreferences: { preload: path.join(__dirname, 'preload.js') }
  });
  Menu.setApplicationMenu(null);
  win.loadFile('launcher.html');
  win.webContents.on('did-finish-load', sendState);
  win.on('focus', () => { checkLinkMode(); sendState(); });
  win.on('closed', () => { win = null; });
}

ipcMain.on('refresh', () => { checkLinkMode(); sendState(); });
ipcMain.on('open', (e, id) => launch(id));
ipcMain.on('add', (e, name) => {
  const a = { id: crypto.randomBytes(5).toString('hex'), name: (name || '').trim() || 'Аккаунт ' + (state.accounts.length + 2),
    color: COLORS[state.accounts.length % COLORS.length], needsLogin: true };
  state.accounts.push(a); save(); launch(a.id);
});
ipcMain.on('relogin', (e, id) => {
  const a = state.accounts.find(x => x.id === id); if (!a) return;
  a.needsLogin = true; save(); launch(id);
});
ipcMain.on('link-settings', () => shell.openExternal('ms-settings:defaultapps'));
ipcMain.on('rename', (e, id, name) => {
  const a = state.accounts.find(x => x.id === id);
  if (a && name && name.trim()) { a.name = name.trim(); save(); } sendState();
});
ipcMain.on('toggle', (e, key, val) => { if (key in state) { state[key] = !!val; save(); } sendState(); });
ipcMain.on('shortcut', (e, id) => {
  const a = state.accounts.find(x => x.id === id); if (!a) return;
  const lnk = path.join(app.getPath('desktop'), `Claude — ${a.name.replace(/[\\/:*?"<>|]/g, '')}.lnk`);
  const ok = shell.writeShortcutLink(lnk, { target: process.execPath, args: app.isPackaged ? `--open=${a.id}` : `"${app.getAppPath()}" --open=${a.id}`,
    icon: process.execPath, iconIndex: 0, description: 'Claude: ' + a.name });
  dialog.showMessageBox(win, { message: ok ? 'Ярлык создан на рабочем столе' : 'Не удалось создать ярлык', detail: ok ? path.basename(lnk) : '' });
});
ipcMain.on('remove', async (e, id) => {
  const a = state.accounts.find(x => x.id === id); if (!a) return;
  if (isRunning(a, runningDirs())) {
    dialog.showMessageBox(win, { type: 'info', message: `«${a.name}» сейчас открыт`, detail: 'Закройте эту копию Claude (и в трее тоже), потом удалите.' });
    return;
  }
  const r = await dialog.showMessageBox(win, { type: 'warning', buttons: ['Удалить', 'Отмена'], defaultId: 1, cancelId: 1,
    message: `Удалить «${a.name}»?`,
    detail: 'С этого компьютера сотрётся вход и данные этой копии Claude. Аккаунт на сервере и общая история сессий останутся.' });
  if (r.response !== 0) return;
  const dir = a.legacy || dirOf(a);
  lib.unlinkShared(dir);   // сначала снимаем ссылки на общие папки
  fs.rmSync(dir, { recursive: true, force: true });
  state.accounts = state.accounts.filter(x => x.id !== id); save(); sendState();
});
ipcMain.on('menu', (e, id) => {
  Menu.buildFromTemplate([
    { label: 'Переименовать', click: () => win.webContents.send('ask-rename', id) },
    { label: 'Войти заново (следующий вход — сюда)', click: () => ipcMain.emit('relogin', {}, id) },
    { label: 'Ярлык на рабочий стол', click: () => ipcMain.emit('shortcut', {}, id) },
    { label: 'Открыть папку данных', click: () => { const a = state.accounts.find(x => x.id === id); if (a) shell.openPath(a.legacy || dirOf(a)); } },
    { type: 'separator' },
    { label: 'Удалить', click: () => ipcMain.emit('remove', {}, id) },
  ]).popup({ window: win });
});

function openArg(argv) { const m = argv.find(x => x.startsWith('--open=')); return m && m.slice(7); }
// Запуск без окна (ярлык копии или ссылка): делаем дело и выходим, если не ждём историю.
function headless(argv) {
  const link = linkArg(argv), id = openArg(argv);
  if (link) handleLink(link); else if (id) launch(id); else return false;
  return true;
}

if (!app.requestSingleInstanceLock()) { app.quit(); }
else {
  app.on('second-instance', (e, argv) => {
    if (headless(argv)) return;
    if (win) { if (win.isMinimized()) win.restore(); win.focus(); } else createWindow();
  });
  app.whenReady().then(() => {
    migrate(); load();
    registerLinks();
    if (busy()) watchHistory();
    if (headless(process.argv)) { setTimeout(() => { if (!win && !busy()) app.quit(); }, 2000); return; }
    createWindow();
  });
  app.on('window-all-closed', () => { if (!busy()) app.quit(); });
}
