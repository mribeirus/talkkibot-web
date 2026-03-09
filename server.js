const http = require('http');
const { URL } = require('url');

const PORT = Number(process.env.PORT || 3000);
const VIKUNJA_URL = (process.env.VIKUNJA_URL || 'https://ops.talkki.pro').replace(/\/$/, '');
const APP_NAME = process.env.APP_NAME || 'TalkkiBot OPS';
const NODE_ENV = process.env.NODE_ENV || 'production';
const COOKIE_NAME = 'talkki_session';

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';

    req.on('data', (chunk) => {
      data += chunk;

      if (data.length > 1_000_000) {
        req.destroy();
        reject(new Error('Payload muito grande'));
      }
    });

    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

function parseCookies(req) {
  const header = req.headers.cookie || '';

  if (!header) return {};

  const pairs = header
    .split(';')
    .map((v) => v.trim())
    .filter(Boolean)
    .map((v) => {
      const idx = v.indexOf('=');

      if (idx === -1) {
        return [decodeURIComponent(v), ''];
      }

      return [
        decodeURIComponent(v.slice(0, idx)),
        decodeURIComponent(v.slice(idx + 1)),
      ];
    });

  return Object.fromEntries(pairs);
}

function sendJson(res, status, payload, extraHeaders = {}) {
  const body = JSON.stringify(payload);

  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
    ...extraHeaders,
  });

  res.end(body);
}

function sendHtml(res, html) {
  res.writeHead(200, {
    'Content-Type': 'text/html; charset=utf-8',
    'Content-Length': Buffer.byteLength(html),
    'Cache-Control': 'no-store',
  });

  res.end(html);
}

function sendText(res, status, text) {
  res.writeHead(status, {
    'Content-Type': 'text/plain; charset=utf-8',
    'Content-Length': Buffer.byteLength(text),
    'Cache-Control': 'no-store',
  });

  res.end(text);
}

function cookieHeader(token) {
  const secure = NODE_ENV !== 'development' ? '; Secure' : '';
  return `${COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${60 * 60 * 24 * 30}${secure}`;
}

function clearCookieHeader() {
  const secure = NODE_ENV !== 'development' ? '; Secure' : '';
  return `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`;
}

async function vikunjaFetch(path, options = {}) {
  const url = `${VIKUNJA_URL}${path}`;

  const response = await fetch(url, options);
  const contentType = response.headers.get('content-type') || '';

  let payload;

  if (contentType.includes('application/json')) {
    payload = await response.json().catch(() => ({}));
  } else {
    payload = await response.text().catch(() => '');
  }

  return {
    ok: response.ok,
    status: response.status,
    headers: response.headers,
    payload,
  };
}

function appHtml() {
  return `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>${APP_NAME}</title>
  <meta name="color-scheme" content="dark" />
  <style>
    :root {
      --bg: #0b0d10;
      --bg-soft: #0f1115;
      --panel: #12151b;
      --panel-2: #171b22;
      --panel-3: #1d232d;
      --border: #272d38;
      --border-soft: #1e232c;
      --text: #f3f4f6;
      --muted: #98a2b3;
      --muted-2: #6b7280;
      --button: #262c36;
      --button-hover: #313846;
      --sidebar-active: #1f2530;
      --shadow: 0 20px 50px rgba(0, 0, 0, .35);
      --success: #52c07a;
      --warning: #e7a11a;
      --danger: #ef5a5a;
      --info: #5f7cff;
      --radius: 18px;
    }

    * { box-sizing: border-box; }

    html, body {
      margin: 0;
      padding: 0;
      min-height: 100%;
      background: radial-gradient(circle at top, rgba(255,255,255,.03), transparent 18%), var(--bg);
      color: var(--text);
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif;
    }

    button, input, textarea, select {
      font: inherit;
    }

    .hidden {
      display: none !important;
    }

    .login-screen {
      min-height: 100vh;
      display: grid;
      place-items: center;
      padding: 24px;
    }

    .login-card {
      width: 100%;
      max-width: 460px;
      background: rgba(18, 21, 27, .96);
      border: 1px solid var(--border);
      border-radius: 28px;
      box-shadow: var(--shadow);
      padding: 30px;
    }

    .brand {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .brand-mark {
      width: 40px;
      height: 40px;
      border-radius: 12px;
      display: grid;
      place-items: center;
      background: #f4f4f5;
      color: #111827;
      font-weight: 900;
      font-size: 18px;
      flex: 0 0 auto;
    }

    .brand-text {
      font-size: 20px;
      font-weight: 800;
      letter-spacing: -.03em;
    }

    .brand-sub {
      color: var(--muted);
      font-size: 13px;
      margin-top: 4px;
    }

    .login-title {
      margin: 28px 0 8px;
      font-size: 42px;
      line-height: 1;
      letter-spacing: -.04em;
    }

    .login-copy {
      margin: 0 0 22px;
      color: var(--muted);
      line-height: 1.6;
    }

    .field {
      display: grid;
      gap: 8px;
      margin-top: 14px;
    }

    .field label {
      color: var(--muted);
      font-size: 14px;
    }

    .field input,
    .field textarea,
    .toolbar-input,
    .top-search input {
      width: 100%;
      background: #0d1014;
      border: 1px solid var(--border);
      color: var(--text);
      border-radius: 16px;
      padding: 14px 16px;
      outline: none;
      transition: .15s ease;
    }

    .field input:focus,
    .field textarea:focus,
    .toolbar-input:focus,
    .top-search input:focus {
      border-color: #4b5563;
      box-shadow: 0 0 0 4px rgba(75, 85, 99, .18);
    }

    .field textarea {
      resize: vertical;
      min-height: 110px;
    }

    .error {
      color: #fca5a5;
      font-size: 14px;
      margin-top: 12px;
      min-height: 20px;
    }

    .btn {
      border: 0;
      border-radius: 14px;
      padding: 12px 16px;
      background: var(--button);
      color: var(--text);
      cursor: pointer;
      transition: .15s ease;
    }

    .btn:hover {
      background: var(--button-hover);
    }

    .btn-primary {
      background: #2c323d;
      color: #fff;
      font-weight: 700;
    }

    .btn-primary:hover {
      background: #383f4b;
    }

    .btn-ghost {
      background: transparent;
      border: 1px solid var(--border);
    }

    .btn-danger {
      background: rgba(239, 90, 90, .12);
      color: #fecaca;
      border: 1px solid rgba(239, 90, 90, .15);
    }

    .btn-block {
      width: 100%;
    }

    .app {
      display: grid;
      grid-template-columns: 300px 1fr;
      min-height: 100vh;
    }

    .sidebar {
      border-right: 1px solid var(--border);
      background: rgba(13, 16, 20, .88);
      backdrop-filter: blur(18px);
      padding: 22px 18px;
      display: flex;
      flex-direction: column;
      gap: 18px;
    }

    .sidebar-brand {
      padding: 10px 10px 14px;
      border-bottom: 1px solid var(--border-soft);
    }

    .sidebar-brand .brand-text {
      font-size: 24px;
    }

    .sidebar-group-title {
      font-size: 12px;
      letter-spacing: .08em;
      text-transform: uppercase;
      color: var(--muted-2);
      margin: 0 10px 8px;
    }

    .nav-list,
    .condominio-list {
      display: grid;
      gap: 8px;
    }

    .nav-item,
    .condominio-item {
      width: 100%;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 12px 14px;
      border-radius: 14px;
      background: transparent;
      color: var(--text);
      border: 1px solid transparent;
      cursor: pointer;
      text-align: left;
    }

    .nav-item:hover,
    .condominio-item:hover {
      background: rgba(255,255,255,.03);
    }

    .nav-item.active,
    .condominio-item.active {
      background: var(--sidebar-active);
      border-color: var(--border);
    }

    .nav-left,
    .condominio-left {
      display: flex;
      align-items: center;
      gap: 12px;
      min-width: 0;
    }

    .nav-icon,
    .condominio-dot {
      width: 10px;
      height: 10px;
      border-radius: 999px;
      background: #6b7280;
      flex: 0 0 auto;
    }

    .condominio-dot {
      width: 12px;
      height: 12px;
      background: #9ca3af;
    }

    .nav-badge,
    .condominio-badge,
    .count-badge {
      min-width: 24px;
      height: 24px;
      display: inline-grid;
      place-items: center;
      padding: 0 8px;
      border-radius: 999px;
      background: rgba(255,255,255,.06);
      color: var(--muted);
      font-size: 12px;
      flex: 0 0 auto;
    }

    .sidebar-footer {
      margin-top: auto;
      border-top: 1px solid var(--border-soft);
      padding-top: 14px;
      display: grid;
      gap: 10px;
    }

    .sidebar-user {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 10px;
      border-radius: 14px;
      background: rgba(255,255,255,.02);
      border: 1px solid var(--border-soft);
    }

    .avatar {
      width: 38px;
      height: 38px;
      border-radius: 999px;
      display: grid;
      place-items: center;
      background: #2f3742;
      color: #fff;
      font-weight: 700;
      flex: 0 0 auto;
    }

    .main {
      min-width: 0;
      display: flex;
      flex-direction: column;
    }

    .topbar {
      position: sticky;
      top: 0;
      z-index: 20;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      padding: 16px 24px;
      border-bottom: 1px solid var(--border);
      background: rgba(11, 13, 16, .84);
      backdrop-filter: blur(16px);
    }

    .top-search {
      flex: 1;
      max-width: 640px;
      position: relative;
    }

    .top-search input {
      padding-left: 16px;
    }

    .top-actions {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .workspace {
      padding: 24px;
    }

    .screen {
      display: grid;
      gap: 22px;
    }

    .section-head {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 16px;
      flex-wrap: wrap;
    }

    .section-head h1 {
      margin: 0;
      font-size: 32px;
      line-height: 1;
      letter-spacing: -.04em;
    }

    .section-head p {
      margin: 8px 0 0;
      color: var(--muted);
    }

    .toolbar-row {
      display: flex;
      gap: 12px;
      flex-wrap: wrap;
      align-items: center;
    }

    .toolbar-input {
      min-width: 280px;
    }

    .cards-grid {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 16px;
    }

    .stat-card {
      background: var(--panel);
      border: 1px solid var(--border);
      border-radius: 22px;
      padding: 18px;
      box-shadow: var(--shadow);
    }

    .stat-card .label {
      color: var(--muted);
      font-size: 13px;
    }

    .stat-card .value {
      margin-top: 10px;
      font-size: 36px;
      font-weight: 800;
      letter-spacing: -.03em;
    }

    .stat-card .delta {
      margin-top: 8px;
      color: var(--muted);
      font-size: 13px;
    }

    .panel {
      background: var(--panel);
      border: 1px solid var(--border);
      border-radius: 22px;
      padding: 18px;
      box-shadow: var(--shadow);
    }

    .panel h3 {
      margin: 0 0 16px;
      font-size: 18px;
    }

    .recent-list {
      display: grid;
      gap: 12px;
    }

    .recent-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 14px;
      border-radius: 16px;
      border: 1px solid var(--border-soft);
      background: rgba(255,255,255,.02);
    }

    .recent-meta {
      color: var(--muted);
      font-size: 13px;
      margin-top: 4px;
    }

    .board {
      display: grid;
      grid-template-columns: repeat(4, minmax(280px, 1fr));
      gap: 16px;
      overflow-x: auto;
      padding-bottom: 6px;
    }

    .column {
      min-width: 280px;
      background: transparent;
      display: grid;
      gap: 12px;
      align-content: start;
    }

    .column-head {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 2px 4px;
    }

    .status-dot {
      width: 10px;
      height: 10px;
      border-radius: 999px;
      flex: 0 0 auto;
    }

    .status-dot.pendente { background: #94a3b8; }
    .status-dot.andamento { background: var(--info); }
    .status-dot.aguardando { background: var(--warning); }
    .status-dot.concluida { background: var(--success); }

    .column-title {
      font-size: 18px;
      font-weight: 700;
      letter-spacing: -.02em;
    }

    .task-list {
      display: grid;
      gap: 12px;
    }

    .task-card {
      background: var(--panel);
      border: 1px solid var(--border);
      border-radius: 20px;
      padding: 16px;
      box-shadow: var(--shadow);
      cursor: pointer;
      transition: .15s ease;
    }

    .task-card:hover {
      transform: translateY(-1px);
      border-color: #3a4453;
    }

    .task-card.pendente { box-shadow: inset 3px 0 0 #94a3b8; }
    .task-card.andamento { box-shadow: inset 3px 0 0 var(--info); }
    .task-card.aguardando { box-shadow: inset 3px 0 0 var(--warning); }
    .task-card.concluida { box-shadow: inset 3px 0 0 var(--success); }

    .chip-row {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      margin-bottom: 12px;
    }

    .chip {
      display: inline-flex;
      align-items: center;
      padding: 6px 10px;
      border-radius: 999px;
      font-size: 12px;
      border: 1px solid rgba(255,255,255,.08);
      background: rgba(255,255,255,.04);
      color: var(--muted);
    }

    .chip.priority-urgente {
      color: #fecaca;
      background: rgba(239, 90, 90, .10);
      border-color: rgba(239, 90, 90, .18);
    }

    .chip.priority-alta {
      color: #fed7aa;
      background: rgba(249, 115, 22, .10);
      border-color: rgba(249, 115, 22, .18);
    }

    .chip.priority-media {
      color: #fde68a;
      background: rgba(234, 179, 8, .10);
      border-color: rgba(234, 179, 8, .18);
    }

    .chip.priority-baixa {
      color: #bbf7d0;
      background: rgba(34, 197, 94, .10);
      border-color: rgba(34, 197, 94, .18);
    }

    .task-title {
      margin: 0;
      font-size: 16px;
      line-height: 1.4;
      letter-spacing: -.01em;
    }

    .task-desc {
      margin-top: 8px;
      color: var(--muted);
      font-size: 14px;
      line-height: 1.5;
      min-height: 42px;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }

    .task-meta {
      display: grid;
      gap: 8px;
      margin-top: 14px;
      color: var(--muted);
      font-size: 13px;
    }

    .task-meta-line {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
    }

    .task-footer {
      margin-top: 14px;
      padding-top: 12px;
      border-top: 1px solid var(--border-soft);
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
    }

    .task-assignee {
      display: flex;
      align-items: center;
      gap: 8px;
      min-width: 0;
    }

    .task-assignee .avatar {
      width: 28px;
      height: 28px;
      font-size: 12px;
      background: #202734;
    }

    .task-assignee-name {
      color: var(--muted);
      font-size: 13px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .column-add {
      width: 100%;
      background: transparent;
      border: 1px dashed var(--border);
      color: var(--muted);
    }

    .column-add:hover {
      border-color: #3a4350;
      color: #d1d5db;
      background: rgba(255,255,255,.02);
    }

    .empty-state {
      background: rgba(255,255,255,.02);
      border: 1px dashed var(--border);
      color: var(--muted);
      border-radius: 18px;
      padding: 26px 18px;
      text-align: center;
    }

    .modal-backdrop {
      position: fixed;
      inset: 0;
      z-index: 50;
      background: rgba(0,0,0,.62);
      backdrop-filter: blur(6px);
      display: grid;
      place-items: center;
      padding: 22px;
    }

    .modal {
      width: 100%;
      max-width: 980px;
      background: #101318;
      border: 1px solid var(--border);
      border-radius: 24px;
      box-shadow: var(--shadow);
      overflow: hidden;
    }

    .modal.small {
      max-width: 640px;
    }

    .modal-head {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 16px;
      padding: 22px 22px 0;
    }

    .modal-title {
      margin: 0;
      font-size: 28px;
      letter-spacing: -.03em;
    }

    .modal-sub {
      margin-top: 10px;
      color: var(--muted);
      line-height: 1.6;
      white-space: pre-wrap;
    }

    .modal-close {
      background: transparent;
      border: 0;
      color: var(--muted);
      font-size: 26px;
      line-height: 1;
      cursor: pointer;
    }

    .modal-body {
      display: grid;
      grid-template-columns: 1.4fr .8fr;
      gap: 0;
      margin-top: 18px;
    }

    .modal-main,
    .modal-side {
      padding: 22px;
    }

    .modal-side {
      border-left: 1px solid var(--border-soft);
      background: rgba(255,255,255,.02);
    }

    .detail-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 14px;
      margin-top: 18px;
    }

    .detail-card {
      background: rgba(255,255,255,.02);
      border: 1px solid var(--border-soft);
      border-radius: 16px;
      padding: 14px;
    }

    .detail-card .k {
      color: var(--muted);
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: .08em;
      margin-bottom: 8px;
    }

    .detail-card .v {
      font-size: 15px;
      line-height: 1.5;
    }

    .modal-actions {
      display: grid;
      gap: 10px;
      margin-top: 12px;
    }

    .fab {
      position: fixed;
      right: 28px;
      bottom: 28px;
      z-index: 30;
      width: 60px;
      height: 60px;
      border-radius: 999px;
      border: 0;
      background: #323946;
      color: #fff;
      font-size: 30px;
      box-shadow: var(--shadow);
      cursor: pointer;
    }

    .fab:hover {
      background: #3d4655;
    }

    .loading-bar {
      height: 2px;
      background: linear-gradient(90deg, transparent, #d1d5db, transparent);
      animation: slide 1.2s linear infinite;
      opacity: .85;
    }

    @keyframes slide {
      from { transform: translateX(-100%); }
      to { transform: translateX(100%); }
    }

    @media (max-width: 1280px) {
      .cards-grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
    }

    @media (max-width: 1120px) {
      .app {
        grid-template-columns: 1fr;
      }

      .sidebar {
        display: none;
      }

      .workspace {
        padding: 18px;
      }

      .topbar {
        padding: 14px 18px;
      }

      .modal-body {
        grid-template-columns: 1fr;
      }

      .modal-side {
        border-left: 0;
        border-top: 1px solid var(--border-soft);
      }
    }

    @media (max-width: 760px) {
      .cards-grid {
        grid-template-columns: 1fr;
      }

      .toolbar-input {
        min-width: 100%;
      }

      .topbar {
        flex-wrap: wrap;
      }

      .top-search {
        max-width: none;
        width: 100%;
      }

      .detail-grid {
        grid-template-columns: 1fr;
      }
    }
  </style>
</head>
<body>
  <section id="loginScreen" class="login-screen hidden">
    <div class="login-card">
      <div class="brand">
        <div class="brand-mark">T</div>
        <div>
          <div class="brand-text">${APP_NAME}</div>
          <div class="brand-sub">Gestão operacional de condomínios</div>
        </div>
      </div>

      <h1 class="login-title">Entrar</h1>
      <p class="login-copy">Seu painel operacional com identidade própria, conectado ao backend do Vikunja.</p>

      <form id="loginForm">
        <div class="field">
          <label for="username">Usuário</label>
          <input id="username" name="username" autocomplete="username" placeholder="seu usuário" required />
        </div>

        <div class="field">
          <label for="password">Senha</label>
          <input id="password" name="password" type="password" autocomplete="current-password" placeholder="sua senha" required />
        </div>

        <button class="btn btn-primary btn-block" style="margin-top:18px" type="submit">Entrar</button>
        <div id="loginError" class="error"></div>
      </form>
    </div>
  </section>

  <section id="appScreen" class="app hidden">
    <aside class="sidebar">
      <div class="sidebar-brand">
        <div class="brand">
          <div class="brand-mark">T</div>
          <div>
            <div class="brand-text">${APP_NAME}</div>
            <div class="brand-sub">Gestão de Condomínios</div>
          </div>
        </div>
      </div>

      <div>
        <div class="sidebar-group-title">Menu</div>
        <div class="nav-list" id="navList"></div>
      </div>

      <div>
        <div class="sidebar-group-title">Condomínios</div>
        <div class="condominio-list" id="condominioList"></div>
        <button id="newCondominioBtn" class="btn btn-primary" style="width:100%;margin-top:10px">Novo condomínio</button>
      </div>

      <div class="sidebar-footer">
        <div class="sidebar-user">
          <div class="avatar" id="sidebarAvatar">TB</div>
          <div style="min-width:0">
            <div id="sidebarUserName" style="font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis"></div>
            <div id="sidebarUserSub" class="brand-sub">Usuário conectado</div>
          </div>
        </div>
      </div>
    </aside>

    <div class="main">
      <header class="topbar">
        <div class="top-search">
          <input id="globalSearch" type="text" placeholder="Buscar tarefas, condomínio, responsável..." />
        </div>

        <div class="top-actions">
          <button id="openCreateBtn" class="btn btn-primary">Nova tarefa</button>
          <button id="refreshBtn" class="btn">Atualizar</button>
          <button id="logoutBtn" class="btn btn-ghost">Sair</button>
        </div>
      </header>

      <div id="globalLoading" class="loading-bar hidden"></div>

      <main class="workspace">
        <section id="dashboardSection" class="screen hidden">
          <div class="section-head">
            <div>
              <h1>Dashboard</h1>
              <p id="dashboardSubtitle">Resumo operacional do condomínio selecionado.</p>
            </div>
          </div>

          <div class="cards-grid" id="statsGrid"></div>

          <div class="cards-grid" style="grid-template-columns: 1.4fr .8fr">
            <div class="panel">
              <h3>Tarefas recentes</h3>
              <div class="recent-list" id="recentTasks"></div>
            </div>

            <div class="panel">
              <h3>Categorias</h3>
              <div class="recent-list" id="categoryList"></div>
            </div>
          </div>
        </section>

        <section id="tasksSection" class="screen">
          <div class="section-head">
            <div>
              <h1 id="tasksTitle">Tarefas</h1>
              <p id="tasksSubtitle">Acompanhe a operação do condomínio em uma visualização tipo kanban.</p>
            </div>

            <div class="toolbar-row">
              <input id="taskSearch" class="toolbar-input" type="text" placeholder="Buscar tarefas..." />
            </div>
          </div>

          <div class="board" id="board"></div>
        </section>
      </main>
    </div>
  </section>

  <div id="taskModalBackdrop" class="modal-backdrop hidden">
    <div class="modal">
      <div class="modal-head">
        <div style="min-width:0">
          <div id="taskModalChips" class="chip-row"></div>
          <h2 id="taskModalTitle" class="modal-title"></h2>
          <div id="taskModalDescription" class="modal-sub"></div>
        </div>
        <button id="taskModalClose" class="modal-close" type="button">×</button>
      </div>

      <div class="modal-body">
        <div class="modal-main">
          <div class="detail-grid" id="taskDetailsGrid"></div>
        </div>

        <div class="modal-side">
          <h3 style="margin-top:0">Ações</h3>
          <div class="modal-actions">
            <button id="toggleDoneBtn" class="btn btn-primary">Marcar como concluída</button>
            <button id="editTaskBtn" class="btn">Editar tarefa</button>
            <button id="deleteTaskBtn" class="btn btn-danger">Excluir tarefa</button>
          </div>
        </div>
      </div>
    </div>
  </div>

  <div id="createModalBackdrop" class="modal-backdrop hidden">
    <div class="modal small">
      <div class="modal-head">
        <div>
          <h2 class="modal-title" style="font-size:24px">Nova tarefa</h2>
          <div class="modal-sub">Crie uma tarefa no condomínio selecionado.</div>
        </div>
        <button id="createModalClose" class="modal-close" type="button">×</button>
      </div>

      <div class="modal-main" style="padding-top:18px">
        <form id="createTaskForm">
          <div class="field" style="margin-top:0">
            <label for="createTaskTitle">Título</label>
            <input id="createTaskTitle" required placeholder="Ex.: Verificar vazamento no bloco B" />
          </div>

          <div class="field">
            <label for="createTaskDescription">Descrição</label>
            <textarea id="createTaskDescription" placeholder="Detalhes da tarefa"></textarea>
          </div>

          <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:18px">
            <button id="cancelCreateBtn" type="button" class="btn btn-ghost">Cancelar</button>
            <button type="submit" class="btn btn-primary">Criar tarefa</button>
          </div>
        </form>
      </div>
    </div>
  </div>

  <button id="fabBtn" class="fab" type="button">+</button>

  <script>
    const state = {
      user: null,
      condominios: [],
      currentCondominio: null,
      currentView: null,
      tasks: [],
      screen: 'tarefas',
      loading: false,
      selectedTaskId: null,
      filter: '',
    };

    const NAV_ITEMS = [
      { key: 'dashboard', label: 'Dashboard', badge: '' },
      { key: 'tarefas', label: 'Tarefas', badge: '' },
      { key: 'condominios', label: 'Condomínios', badge: '' },
      { key: 'moradores', label: 'Moradores', badge: '' },
      { key: 'funcionarios', label: 'Funcionários', badge: '' },
      { key: 'reservas', label: 'Reservas', badge: '' },
      { key: 'comunicados', label: 'Comunicados', badge: '' },
      { key: 'usuarios', label: 'Usuários', badge: '' },
      { key: 'configuracoes', label: 'Configurações', badge: '' },
    ];

    const STATUS_META = {
      pendente: { label: 'Pendente', colorClass: 'pendente' },
      andamento: { label: 'Em andamento', colorClass: 'andamento' },
      aguardando: { label: 'Aguardando', colorClass: 'aguardando' },
      concluida: { label: 'Concluída', colorClass: 'concluida' },
    };

    const els = {
      loginScreen: document.getElementById('loginScreen'),
      appScreen: document.getElementById('appScreen'),
      loginForm: document.getElementById('loginForm'),
      loginError: document.getElementById('loginError'),
      navList: document.getElementById('navList'),
      condominioList: document.getElementById('condominioList'),
      newCondominioBtn: document.getElementById('newCondominioBtn'),
      sidebarAvatar: document.getElementById('sidebarAvatar'),
      sidebarUserName: document.getElementById('sidebarUserName'),
      globalSearch: document.getElementById('globalSearch'),
      openCreateBtn: document.getElementById('openCreateBtn'),
      fabBtn: document.getElementById('fabBtn'),
      refreshBtn: document.getElementById('refreshBtn'),
      logoutBtn: document.getElementById('logoutBtn'),
      globalLoading: document.getElementById('globalLoading'),
      dashboardSection: document.getElementById('dashboardSection'),
      tasksSection: document.getElementById('tasksSection'),
      dashboardSubtitle: document.getElementById('dashboardSubtitle'),
      tasksTitle: document.getElementById('tasksTitle'),
      tasksSubtitle: document.getElementById('tasksSubtitle'),
      taskSearch: document.getElementById('taskSearch'),
      board: document.getElementById('board'),
      statsGrid: document.getElementById('statsGrid'),
      recentTasks: document.getElementById('recentTasks'),
      categoryList: document.getElementById('categoryList'),
      taskModalBackdrop: document.getElementById('taskModalBackdrop'),
      taskModalClose: document.getElementById('taskModalClose'),
      taskModalChips: document.getElementById('taskModalChips'),
      taskModalTitle: document.getElementById('taskModalTitle'),
      taskModalDescription: document.getElementById('taskModalDescription'),
      taskDetailsGrid: document.getElementById('taskDetailsGrid'),
      toggleDoneBtn: document.getElementById('toggleDoneBtn'),
      editTaskBtn: document.getElementById('editTaskBtn'),
      deleteTaskBtn: document.getElementById('deleteTaskBtn'),
      createModalBackdrop: document.getElementById('createModalBackdrop'),
      createModalClose: document.getElementById('createModalClose'),
      createTaskForm: document.getElementById('createTaskForm'),
      createTaskTitle: document.getElementById('createTaskTitle'),
      createTaskDescription: document.getElementById('createTaskDescription'),
      cancelCreateBtn: document.getElementById('cancelCreateBtn'),
    };

    function escapeHtml(value) {
      return String(value || '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
    }

    function initials(name) {
      const parts = String(name || 'TB').trim().split(/\\s+/).slice(0, 2);
      return parts.map((v) => v[0] || '').join('').toUpperCase() || 'TB';
    }

    function setLoading(value) {
      state.loading = value;
      els.globalLoading.classList.toggle('hidden', !value);
      els.refreshBtn.disabled = value;
      els.openCreateBtn.disabled = value;
      els.fabBtn.disabled = value;
    }

    async function api(path, options = {}) {
      const res = await fetch(path, {
        method: options.method || 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...(options.headers || {}),
        },
        body: options.body ? JSON.stringify(options.body) : undefined,
        credentials: 'include',
      });

      const contentType = res.headers.get('content-type') || '';
      const data = contentType.includes('application/json')
        ? await res.json().catch(() => ({}))
        : await res.text().catch(() => '');

      if (!res.ok) {
        throw new Error(data && data.message ? data.message : 'Erro na requisição');
      }

      return data;
    }

    function normalizeTasks(data) {
      if (!Array.isArray(data)) return [];

      if (data.length && data[0] && Array.isArray(data[0].tasks)) {
        const merged = [];
        for (const bucket of data) {
          for (const task of bucket.tasks || []) {
            merged.push({ ...task, _bucketTitle: bucket.title || '' });
          }
        }
        return merged;
      }

      return data;
    }

    function formatDate(value) {
      if (!value) return 'Sem data';
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return 'Sem data';
      return date.toLocaleDateString('pt-BR');
    }

    function priorityMeta(task) {
      const value = Number(task.priority || 0);

      if (value >= 8) return { label: 'Urgente', className: 'priority-urgente' };
      if (value >= 5) return { label: 'Alta', className: 'priority-alta' };
      if (value >= 3) return { label: 'Média', className: 'priority-media' };
      return { label: 'Baixa', className: 'priority-baixa' };
    }

    function taskStatus(task) {
      const source = ((task._bucketTitle || '') + ' ' + (task.labels || []).map((l) => l.title || '').join(' ')).toLowerCase();

      if (task.done) return 'concluida';
      if (source.includes('aguard')) return 'aguardando';
      if (source.includes('andamento') || source.includes('em andamento') || Number(task.percent_done || 0) > 0) return 'andamento';
      return 'pendente';
    }

    function taskAssignee(task) {
      return Array.isArray(task.assignees) && task.assignees.length ? task.assignees[0] : null;
    }

    function taskCategories(task) {
      const labels = Array.isArray(task.labels) ? task.labels : [];
      if (!labels.length) return ['Sem categoria'];
      return labels.map((l) => l.title || 'Categoria');
    }

    function filteredTasks() {
      const q = state.filter.trim().toLowerCase();
      if (!q) return state.tasks;

      return state.tasks.filter((task) => {
        const text = [
          task.title,
          task.description,
          task.identifier,
          task._bucketTitle,
          ...(task.labels || []).map((l) => l.title),
          ...(task.assignees || []).map((a) => a.name || a.username),
        ].join(' ').toLowerCase();

        return text.includes(q);
      });
    }

    function groupTasks(tasks) {
      const groups = {
        pendente: [],
        andamento: [],
        aguardando: [],
        concluida: [],
      };

      for (const task of tasks) {
        groups[taskStatus(task)].push(task);
      }

      return groups;
    }

    function renderNav() {
      els.navList.innerHTML = '';

      for (const item of NAV_ITEMS) {
        const btn = document.createElement('button');
        const active = state.screen === item.key || (item.key === 'tarefas' && !['dashboard', 'tarefas'].includes(state.screen));
        btn.className = 'nav-item' + (active ? ' active' : '');
        btn.innerHTML =
          '<span class="nav-left">' +
            '<span class="nav-icon"></span>' +
            '<span>' + escapeHtml(item.label) + '</span>' +
          '</span>' +
          (item.badge ? '<span class="nav-badge">' + escapeHtml(item.badge) + '</span>' : '');

        btn.onclick = () => {
          if (item.key === 'dashboard' || item.key === 'tarefas') {
            state.screen = item.key;
            render();
          } else {
            alert('Essa área entra na próxima etapa do layout.');
          }
        };

        els.navList.appendChild(btn);
      }
    }

    function renderCondominios() {
      els.condominioList.innerHTML = '';

      if (!state.condominios.length) {
        const empty = document.createElement('div');
        empty.className = 'empty-state';
        empty.textContent = 'Nenhum condomínio encontrado.';
        els.condominioList.appendChild(empty);
        return;
      }

      for (const condominio of state.condominios) {
        const btn = document.createElement('button');
        btn.className = 'condominio-item' + (state.currentCondominio && state.currentCondominio.id === condominio.id ? ' active' : '');
        btn.innerHTML =
          '<span class="condominio-left">' +
            '<span class="condominio-dot"></span>' +
            '<span style="min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + escapeHtml(condominio.title || 'Sem título') + '</span>' +
          '</span>' +
          '<span class="condominio-badge">•</span>';

        btn.onclick = async () => {
          state.currentCondominio = condominio;
          await loadViewsAndTasks();
          render();
        };

        els.condominioList.appendChild(btn);
      }
    }

    function renderHeaderInfo() {
      const name = state.user ? (state.user.name || state.user.username || 'Usuário') : 'Usuário';
      els.sidebarUserName.textContent = name;
      els.sidebarAvatar.textContent = initials(name);

      const condominioName = state.currentCondominio ? state.currentCondominio.title : 'Nenhum condomínio';
      els.dashboardSubtitle.textContent = 'Resumo operacional de ' + condominioName + '.';
      els.tasksTitle.textContent = 'Tarefas';
      els.tasksSubtitle.textContent = state.currentCondominio
        ? 'Condomínio atual: ' + condominioName
        : 'Selecione um condomínio para visualizar as tarefas.';
    }

    function renderDashboard() {
      const tasks = filteredTasks();
      const groups = groupTasks(tasks);
      const urgent = tasks.filter((t) => Number(t.priority || 0) >= 8).length;

      const stats = [
        { label: 'Pendentes', value: groups.pendente.length, delta: 'Aguardando ação' },
        { label: 'Concluídas', value: groups.concluida.length, delta: 'Finalizadas' },
        { label: 'Em andamento', value: groups.andamento.length, delta: 'Execução ativa' },
        { label: 'Urgentes', value: urgent, delta: 'Alta prioridade' },
      ];

      els.statsGrid.innerHTML = stats.map((card) =>
        '<div class="stat-card">' +
          '<div class="label">' + escapeHtml(card.label) + '</div>' +
          '<div class="value">' + escapeHtml(card.value) + '</div>' +
          '<div class="delta">' + escapeHtml(card.delta) + '</div>' +
        '</div>'
      ).join('');

      const recent = tasks.slice().sort((a, b) => {
        const da = new Date(a.updated || a.created || 0).getTime();
        const db = new Date(b.updated || b.created || 0).getTime();
        return db - da;
      }).slice(0, 6);

      els.recentTasks.innerHTML = recent.length
        ? recent.map((task) => {
            const status = STATUS_META[taskStatus(task)];
            return (
              '<div class="recent-item">' +
                '<div>' +
                  '<div style="font-weight:700">' + escapeHtml(task.title || 'Sem título') + '</div>' +
                  '<div class="recent-meta">' + escapeHtml(task.identifier || 'Sem identificador') + ' • ' + escapeHtml(formatDate(task.due_date || task.updated || task.created)) + '</div>' +
                '</div>' +
                '<span class="chip">' + escapeHtml(status.label) + '</span>' +
              '</div>'
            );
          }).join('')
        : '<div class="empty-state">Sem tarefas para exibir.</div>';

      const categoryMap = {};
      for (const task of tasks) {
        for (const cat of taskCategories(task)) {
          categoryMap[cat] = (categoryMap[cat] || 0) + 1;
        }
      }

      const categories = Object.entries(categoryMap).sort((a, b) => b[1] - a[1]).slice(0, 6);

      els.categoryList.innerHTML = categories.length
        ? categories.map(([name, count]) =>
            '<div class="recent-item">' +
              '<div>' +
                '<div style="font-weight:700">' + escapeHtml(name) + '</div>' +
                '<div class="recent-meta">Tarefas vinculadas</div>' +
              '</div>' +
              '<span class="count-badge">' + escapeHtml(count) + '</span>' +
            '</div>'
          ).join('')
        : '<div class="empty-state">Sem categorias ainda.</div>';
    }

    function renderBoard() {
      const tasks = filteredTasks();
      const groups = groupTasks(tasks);

      els.board.innerHTML = Object.keys(STATUS_META).map((key) => {
        const meta = STATUS_META[key];
        const cards = groups[key] || [];

        const tasksHtml = cards.length
          ? '<div class="task-list">' + cards.map((task) => {
              const assignee = taskAssignee(task);
              const priority = priorityMeta(task);
              const categories = taskCategories(task).slice(0, 2);

              return (
                '<article class="task-card ' + meta.colorClass + '" data-task-id="' + escapeHtml(task.id) + '">' +
                  '<div class="chip-row">' +
                    '<span class="chip ' + priority.className + '">' + escapeHtml(priority.label) + '</span>' +
                    categories.map((cat) => '<span class="chip">' + escapeHtml(cat) + '</span>').join('') +
                  '</div>' +
                  '<h3 class="task-title">' + escapeHtml(task.title || 'Sem título') + '</h3>' +
                  '<div class="task-desc">' + escapeHtml(task.description || 'Sem descrição') + '</div>' +
                  '<div class="task-meta">' +
                    '<div class="task-meta-line"><span>Prazo</span><strong>' + escapeHtml(formatDate(task.due_date)) + '</strong></div>' +
                    '<div class="task-meta-line"><span>ID</span><strong>' + escapeHtml(task.identifier || ('#' + task.id)) + '</strong></div>' +
                  '</div>' +
                  '<div class="task-footer">' +
                    '<div class="task-assignee">' +
                      '<span class="avatar">' + escapeHtml(initials(assignee ? (assignee.name || assignee.username) : 'TB')) + '</span>' +
                      '<span class="task-assignee-name">' + escapeHtml(assignee ? (assignee.name || assignee.username) : 'Sem responsável') + '</span>' +
                    '</div>' +
                    '<span class="chip">' + escapeHtml(meta.label) + '</span>' +
                  '</div>' +
                '</article>'
              );
            }).join('') + '</div>'
          : '<div class="empty-state">Sem tarefas nesta coluna.</div>';

        return (
          '<section class="column">' +
            '<div class="column-head">' +
              '<span class="status-dot ' + meta.colorClass + '"></span>' +
              '<span class="column-title">' + escapeHtml(meta.label) + '</span>' +
              '<span class="count-badge">' + escapeHtml(cards.length) + '</span>' +
            '</div>' +
            tasksHtml +
            '<button class="btn column-add" data-add-status="' + escapeHtml(key) + '">+ Adicionar</button>' +
          '</section>'
        );
      }).join('');

      els.board.querySelectorAll('[data-task-id]').forEach((card) => {
        card.addEventListener('click', () => {
          openTaskModal(Number(card.getAttribute('data-task-id')));
        });
      });

      els.board.querySelectorAll('[data-add-status]').forEach((btn) => {
        btn.addEventListener('click', openCreateModal);
      });
    }

    function renderScreens() {
      els.dashboardSection.classList.toggle('hidden', state.screen !== 'dashboard');
      els.tasksSection.classList.toggle('hidden', state.screen !== 'tarefas');
    }

    function render() {
      renderNav();
      renderCondominios();
      renderHeaderInfo();
      renderScreens();
      renderDashboard();
      renderBoard();
    }

    function showLogin() {
      els.loginScreen.classList.remove('hidden');
      els.appScreen.classList.add('hidden');
    }

    function showApp() {
      els.loginScreen.classList.add('hidden');
      els.appScreen.classList.remove('hidden');
    }

    function selectedTask() {
      return state.tasks.find((task) => Number(task.id) === Number(state.selectedTaskId)) || null;
    }

    function openTaskModal(taskId) {
      state.selectedTaskId = taskId;
      const task = selectedTask();
      if (!task) return;

      const status = STATUS_META[taskStatus(task)];
      const priority = priorityMeta(task);
      const assignee = taskAssignee(task);

      els.taskModalChips.innerHTML =
        '<span class="chip ' + priority.className + '">' + escapeHtml(priority.label) + '</span>' +
        '<span class="chip">' + escapeHtml(status.label) + '</span>' +
        taskCategories(task).map((cat) => '<span class="chip">' + escapeHtml(cat) + '</span>').join('');

      els.taskModalTitle.textContent = task.title || 'Sem título';
      els.taskModalDescription.textContent = task.description || 'Sem descrição.';

      const detailCards = [
        { k: 'Prazo', v: formatDate(task.due_date) },
        { k: 'Identificador', v: task.identifier || ('#' + task.id) },
        { k: 'Responsável', v: assignee ? (assignee.name || assignee.username) : 'Sem responsável' },
        { k: 'Bucket/View', v: task._bucketTitle || 'Padrão' },
        { k: 'Criado em', v: formatDate(task.created) },
        { k: 'Atualizado em', v: formatDate(task.updated) },
      ];

      els.taskDetailsGrid.innerHTML = detailCards.map((item) =>
        '<div class="detail-card">' +
          '<div class="k">' + escapeHtml(item.k) + '</div>' +
          '<div class="v">' + escapeHtml(item.v) + '</div>' +
        '</div>'
      ).join('');

      els.toggleDoneBtn.textContent = task.done ? 'Reabrir tarefa' : 'Marcar como concluída';
      els.taskModalBackdrop.classList.remove('hidden');
    }

    function closeTaskModal() {
      els.taskModalBackdrop.classList.add('hidden');
      state.selectedTaskId = null;
    }

    function openCreateModal() {
      els.createTaskTitle.value = '';
      els.createTaskDescription.value = '';
      els.createModalBackdrop.classList.remove('hidden');
      setTimeout(() => els.createTaskTitle.focus(), 50);
    }

    function closeCreateModal() {
      els.createModalBackdrop.classList.add('hidden');
    }

    async function loadMe() {
      state.user = await api('/api/me');
    }

    async function loadCondominios() {
      state.condominios = await api('/api/condominios');

      if (!state.currentCondominio && state.condominios.length) {
        state.currentCondominio = state.condominios[0];
      }
    }

    async function loadViewsAndTasks() {
      if (!state.currentCondominio) {
        state.currentView = null;
        state.tasks = [];
        return;
      }

      const views = await api('/api/condominios/' + state.currentCondominio.id + '/views');
      state.currentView = Array.isArray(views) && views.length ? views[0] : null;
      await loadTasks();
    }

    async function loadTasks() {
      if (!state.currentCondominio || !state.currentView) {
        state.tasks = [];
        return;
      }

      const result = await api('/api/condominios/' + state.currentCondominio.id + '/views/' + state.currentView.id + '/tasks');
      state.tasks = normalizeTasks(result);
    }

    async function bootstrap() {
      try {
        setLoading(true);
        await loadMe();
        await loadCondominios();
        await loadViewsAndTasks();
        showApp();
        render();
      } catch {
        showLogin();
      } finally {
        setLoading(false);
      }
    }

    els.loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      els.loginError.textContent = '';

      const username = document.getElementById('username').value.trim();
      const password = document.getElementById('password').value;

      try {
        setLoading(true);
        await api('/auth/login', {
          method: 'POST',
          body: { username, password },
        });
        await bootstrap();
      } catch (err) {
        els.loginError.textContent = err.message || 'Falha ao entrar.';
      } finally {
        setLoading(false);
      }
    });

    els.logoutBtn.addEventListener('click', async () => {
      await api('/auth/logout', { method: 'POST' }).catch(() => {});
      state.user = null;
      state.condominios = [];
      state.currentCondominio = null;
      state.currentView = null;
      state.tasks = [];
      state.selectedTaskId = null;
      showLogin();
    });

    els.refreshBtn.addEventListener('click', async () => {
      try {
        setLoading(true);
        await loadCondominios();
        await loadViewsAndTasks();
        render();
      } catch (err) {
        alert(err.message || 'Falha ao atualizar.');
      } finally {
        setLoading(false);
      }
    });

    els.newCondominioBtn.addEventListener('click', async () => {
      const title = prompt('Nome do condomínio:');
      if (!title) return;

      const description = prompt('Descrição do condomínio:') || '';

      try {
        setLoading(true);
        await api('/api/condominios', {
          method: 'PUT',
          body: { title, description },
        });
        await loadCondominios();
        state.currentCondominio = state.condominios[state.condominios.length - 1] || state.currentCondominio;
        await loadViewsAndTasks();
        render();
      } catch (err) {
        alert(err.message || 'Falha ao criar condomínio.');
      } finally {
        setLoading(false);
      }
    });

    els.globalSearch.addEventListener('input', (e) => {
      state.filter = e.target.value || '';
      els.taskSearch.value = state.filter;
      render();
    });

    els.taskSearch.addEventListener('input', (e) => {
      state.filter = e.target.value || '';
      els.globalSearch.value = state.filter;
      render();
    });

    els.openCreateBtn.addEventListener('click', openCreateModal);
    els.fabBtn.addEventListener('click', openCreateModal);
    els.createModalClose.addEventListener('click', closeCreateModal);
    els.cancelCreateBtn.addEventListener('click', closeCreateModal);

    els.taskModalClose.addEventListener('click', closeTaskModal);
    els.taskModalBackdrop.addEventListener('click', (e) => {
      if (e.target === els.taskModalBackdrop) closeTaskModal();
    });

    els.createModalBackdrop.addEventListener('click', (e) => {
      if (e.target === els.createModalBackdrop) closeCreateModal();
    });

    els.createTaskForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      if (!state.currentCondominio) {
        alert('Selecione um condomínio primeiro.');
        return;
      }

      const title = els.createTaskTitle.value.trim();
      const description = els.createTaskDescription.value.trim();

      if (!title) return;

      try {
        setLoading(true);
        await api('/api/condominios/' + state.currentCondominio.id + '/tasks', {
          method: 'PUT',
          body: { title, description },
        });
        closeCreateModal();
        await loadTasks();
        render();
      } catch (err) {
        alert(err.message || 'Falha ao criar tarefa.');
      } finally {
        setLoading(false);
      }
    });

    els.toggleDoneBtn.addEventListener('click', async () => {
      const task = selectedTask();
      if (!task) return;

      try {
        setLoading(true);
        await api('/api/tasks/' + task.id, {
          method: 'POST',
          body: {
            title: task.title,
            description: task.description || '',
            done: !task.done,
          },
        });
        await loadTasks();
        openTaskModal(task.id);
        render();
      } catch (err) {
        alert(err.message || 'Falha ao atualizar tarefa.');
      } finally {
        setLoading(false);
      }
    });

    els.editTaskBtn.addEventListener('click', async () => {
      const task = selectedTask();
      if (!task) return;

      const nextTitle = prompt('Novo título da tarefa:', task.title || '');
      if (nextTitle === null) return;

      const nextDescription = prompt('Nova descrição da tarefa:', task.description || '');
      if (nextDescription === null) return;

      try {
        setLoading(true);
        await api('/api/tasks/' + task.id, {
          method: 'POST',
          body: {
            title: nextTitle.trim() || task.title,
            description: nextDescription,
            done: task.done,
          },
        });
        await loadTasks();
        openTaskModal(task.id);
        render();
      } catch (err) {
        alert(err.message || 'Falha ao editar tarefa.');
      } finally {
        setLoading(false);
      }
    });

    els.deleteTaskBtn.addEventListener('click', async () => {
      const task = selectedTask();
      if (!task) return;
      if (!confirm('Excluir esta tarefa?')) return;

      try {
        setLoading(true);
        await api('/api/tasks/' + task.id, {
          method: 'DELETE',
        });
        closeTaskModal();
        await loadTasks();
        render();
      } catch (err) {
        alert(err.message || 'Falha ao excluir tarefa.');
      } finally {
        setLoading(false);
      }
    });

    bootstrap();
  </script>
</body>
</html>`;
}

async function proxyJson(req, res, targetPath, methodOverride) {
  try {
    const cookies = parseCookies(req);
    const token = cookies[COOKIE_NAME];

    if (!token) {
      return sendJson(res, 401, { message: 'Não autenticado.' });
    }

    const body = ['GET', 'HEAD'].includes(req.method) ? undefined : await readBody(req);

    const upstream = await vikunjaFetch(targetPath, {
      method: methodOverride || req.method,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      body,
    });

    return sendJson(res, upstream.status, upstream.payload);
  } catch (error) {
    return sendJson(res, 500, { message: error.message || 'Erro interno.' });
  }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (req.method === 'GET' && url.pathname === '/favicon.ico') {
    return sendText(res, 204, '');
  }

  if (req.method === 'GET' && url.pathname === '/health') {
    return sendJson(res, 200, { ok: true });
  }

  if (req.method === 'GET' && url.pathname === '/') {
    return sendHtml(res, appHtml());
  }

  if (req.method === 'POST' && url.pathname === '/auth/login') {
    try {
      const raw = await readBody(req);
      const body = JSON.parse(raw || '{}');

      const upstream = await vikunjaFetch('/api/v1/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: body.username,
          password: body.password,
          long_token: true,
        }),
      });

      if (!upstream.ok || !upstream.payload || !upstream.payload.token) {
        return sendJson(res, upstream.status || 401, {
          message: upstream.payload && upstream.payload.message
            ? upstream.payload.message
            : 'Usuário ou senha inválidos.',
        });
      }

      return sendJson(
        res,
        200,
        { ok: true },
        { 'Set-Cookie': cookieHeader(upstream.payload.token) }
      );
    } catch (error) {
      return sendJson(res, 500, { message: error.message || 'Erro ao autenticar.' });
    }
  }

  if (req.method === 'POST' && url.pathname === '/auth/logout') {
    return sendJson(res, 200, { ok: true }, { 'Set-Cookie': clearCookieHeader() });
  }

  if (req.method === 'GET' && url.pathname === '/api/me') {
    return proxyJson(req, res, '/api/v1/user');
  }

  if (req.method === 'GET' && url.pathname === '/api/condominios') {
    return proxyJson(req, res, '/api/v1/projects');
  }

  if (req.method === 'PUT' && url.pathname === '/api/condominios') {
    return proxyJson(req, res, '/api/v1/projects');
  }

  const viewsMatch = url.pathname.match(/^\/api\/condominios\/(\d+)\/views$/);
  if (viewsMatch && req.method === 'GET') {
    return proxyJson(req, res, '/api/v1/projects/' + viewsMatch[1] + '/views');
  }

  const viewTasksMatch = url.pathname.match(/^\/api\/condominios\/(\d+)\/views\/(\d+)\/tasks$/);
  if (viewTasksMatch && req.method === 'GET') {
    return proxyJson(
      req,
      res,
      '/api/v1/projects/' + viewTasksMatch[1] + '/views/' + viewTasksMatch[2] + '/tasks'
    );
  }

  const condominioTasksMatch = url.pathname.match(/^\/api\/condominios\/(\d+)\/tasks$/);
  if (condominioTasksMatch && req.method === 'PUT') {
    return proxyJson(req, res, '/api/v1/projects/' + condominioTasksMatch[1] + '/tasks');
  }

  const taskMatch = url.pathname.match(/^\/api\/tasks\/(\d+)$/);
  if (taskMatch && req.method === 'POST') {
    return proxyJson(req, res, '/api/v1/tasks/' + taskMatch[1]);
  }

  if (taskMatch && req.method === 'DELETE') {
    return proxyJson(req, res, '/api/v1/tasks/' + taskMatch[1]);
  }

  return sendJson(res, 404, { message: 'Rota não encontrada.' });
});

server.listen(PORT, () => {
  console.log(`${APP_NAME} rodando em http://0.0.0.0:${PORT}`);
  console.log(`Usando backend Vikunja: ${VIKUNJA_URL}`);
});
