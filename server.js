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
  const entries = header
    .split(';')
    .map((v) => v.trim())
    .filter(Boolean)
    .map((v) => {
      const idx = v.indexOf('=');
      return [
        decodeURIComponent(v.slice(0, idx)),
        decodeURIComponent(v.slice(idx + 1)),
      ];
    });

  return Object.fromEntries(entries);
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
      --bg: #0d0d0d;
      --sidebar: #111111;
      --panel: #171717;
      --panel-2: #1f1f1f;
      --panel-3: #262626;
      --border: #2a2a2a;
      --text: #f5f5f5;
      --muted: #9ca3af;
      --danger: #ef4444;
      --shadow: 0 10px 30px rgba(0,0,0,.30);
      --radius: 18px;
    }

    * { box-sizing: border-box; }

    html, body {
      margin: 0;
      padding: 0;
      min-height: 100%;
      background: var(--bg);
      color: var(--text);
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif;
    }

    button, input, textarea {
      font: inherit;
    }

    .hidden { display: none !important; }

    .app {
      display: grid;
      grid-template-columns: 290px 1fr;
      min-height: 100vh;
    }

    .sidebar {
      background: var(--sidebar);
      border-right: 1px solid var(--border);
      padding: 14px;
    }

    .brand {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 12px;
      border-radius: 14px;
      font-weight: 800;
      font-size: 22px;
      letter-spacing: -.02em;
    }

    .brand-badge {
      width: 34px;
      height: 34px;
      border-radius: 10px;
      display: grid;
      place-items: center;
      background: #fff;
      color: #000;
      font-weight: 900;
      font-size: 18px;
      flex: 0 0 auto;
    }

    .section-title {
      color: var(--muted);
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: .08em;
      margin: 16px 12px 8px;
    }

    .condominio-list {
      display: grid;
      gap: 6px;
    }

    .condominio-item {
      width: 100%;
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 12px;
      border-radius: 14px;
      background: transparent;
      border: 1px solid transparent;
      color: var(--text);
      text-align: left;
      cursor: pointer;
    }

    .condominio-item:hover {
      background: var(--panel);
    }

    .condominio-item.active {
      background: var(--panel-2);
      border-color: var(--border);
    }

    .dot {
      width: 10px;
      height: 10px;
      border-radius: 999px;
      background: #fff;
      flex: 0 0 auto;
    }

    .sidebar-actions {
      display: grid;
      gap: 8px;
      margin-top: 12px;
    }

    .btn {
      border: 0;
      padding: 12px 14px;
      border-radius: 14px;
      background: var(--panel-3);
      color: var(--text);
      cursor: pointer;
    }

    .btn:hover {
      filter: brightness(1.08);
    }

    .btn-primary {
      background: #fff;
      color: #000;
      font-weight: 700;
    }

    .btn-ghost {
      background: transparent;
      border: 1px solid var(--border);
    }

    .btn-danger {
      background: #3a1818;
      color: #fecaca;
    }

    .main {
      display: flex;
      flex-direction: column;
      min-width: 0;
    }

    .topbar {
      position: sticky;
      top: 0;
      z-index: 10;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 18px 22px;
      border-bottom: 1px solid var(--border);
      background: rgba(13,13,13,.94);
      backdrop-filter: blur(12px);
    }

    .topbar h1 {
      margin: 0;
      font-size: 22px;
      letter-spacing: -.02em;
    }

    .topbar p {
      margin: 4px 0 0;
      color: var(--muted);
      font-size: 14px;
    }

    .topbar-right {
      display: flex;
      gap: 10px;
      align-items: center;
    }

    .user-pill {
      max-width: 220px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      background: var(--panel);
      border: 1px solid var(--border);
      color: var(--muted);
      padding: 10px 12px;
      border-radius: 999px;
    }

    .content {
      width: 100%;
      max-width: 1100px;
      margin: 0 auto;
      padding: 24px;
    }

    .composer {
      background: var(--panel);
      border: 1px solid var(--border);
      border-radius: 24px;
      box-shadow: var(--shadow);
      padding: 14px;
      margin-bottom: 18px;
    }

    .composer textarea {
      width: 100%;
      min-height: 78px;
      resize: vertical;
      border: 0;
      outline: 0;
      background: transparent;
      color: var(--text);
      padding: 8px;
    }

    .composer-footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 10px;
      border-top: 1px solid var(--border);
      padding-top: 12px;
      color: var(--muted);
      font-size: 13px;
    }

    .tasks {
      display: grid;
      gap: 12px;
    }

    .task {
      border: 1px solid var(--border);
      background: var(--panel);
      border-radius: var(--radius);
      padding: 14px;
      box-shadow: var(--shadow);
    }

    .task-head {
      display: flex;
      align-items: flex-start;
      gap: 12px;
    }

    .checkbox {
      appearance: none;
      width: 22px;
      height: 22px;
      border-radius: 999px;
      border: 1px solid #525252;
      background: transparent;
      margin-top: 2px;
      flex: 0 0 auto;
      cursor: pointer;
    }

    .checkbox:checked {
      background: #fff;
      border-color: #fff;
      box-shadow: inset 0 0 0 4px #111;
    }

    .task-main {
      min-width: 0;
      flex: 1;
    }

    .task-title {
      margin: 0;
      font-size: 16px;
      line-height: 1.4;
    }

    .task-title.done {
      text-decoration: line-through;
      color: #8a8a8a;
    }

    .task-desc {
      margin-top: 6px;
      color: var(--muted);
      font-size: 14px;
      white-space: pre-wrap;
      line-height: 1.5;
    }

    .task-meta {
      margin-top: 10px;
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }

    .tag {
      display: inline-flex;
      align-items: center;
      padding: 6px 10px;
      border-radius: 999px;
      background: var(--panel-3);
      color: var(--muted);
      border: 1px solid var(--border);
      font-size: 12px;
    }

    .task-actions {
      display: flex;
      gap: 8px;
      margin-top: 14px;
    }

    .empty {
      border: 1px dashed var(--border);
      border-radius: 24px;
      padding: 34px 18px;
      text-align: center;
      color: var(--muted);
      background: rgba(255,255,255,.01);
    }

    .login-screen {
      min-height: 100vh;
      display: grid;
      place-items: center;
      padding: 24px;
      background: radial-gradient(circle at top, rgba(255,255,255,.08), transparent 35%), var(--bg);
    }

    .login-card {
      width: 100%;
      max-width: 460px;
      border: 1px solid var(--border);
      background: rgba(23,23,23,.96);
      box-shadow: var(--shadow);
      border-radius: 28px;
      padding: 28px;
    }

    .login-card h1 {
      margin: 0 0 8px;
      font-size: 34px;
      letter-spacing: -.03em;
    }

    .login-card p {
      margin: 0 0 22px;
      color: var(--muted);
      line-height: 1.5;
    }

    .field {
      display: grid;
      gap: 8px;
      margin-top: 14px;
    }

    .field label {
      font-size: 14px;
      color: var(--muted);
    }

    .field input {
      width: 100%;
      background: #111;
      border: 1px solid var(--border);
      color: var(--text);
      border-radius: 16px;
      padding: 14px;
      outline: none;
    }

    .field input:focus,
    .composer textarea:focus {
      border-color: #fff;
    }

    .error {
      color: #fca5a5;
      font-size: 14px;
      margin-top: 12px;
    }

    .loading-bar {
      height: 2px;
      background: linear-gradient(90deg, transparent, #fff, transparent);
      animation: slide 1.2s linear infinite;
      opacity: .85;
    }

    @keyframes slide {
      from { transform: translateX(-100%); }
      to { transform: translateX(100%); }
    }

    @media (max-width: 960px) {
      .app { grid-template-columns: 1fr; }
      .sidebar { display: none; }
      .content { padding: 16px; }
      .topbar { padding: 16px; }
    }
  </style>
</head>
<body>
  <section id="loginScreen" class="login-screen hidden">
    <div class="login-card">
      <div class="brand" style="padding:0 0 14px 0">
        <span class="brand-badge">T</span>
        <span>${APP_NAME}</span>
      </div>

      <h1>Entrar</h1>
      <p>Seu gestor operacional para condomínios, com interface própria e backend seguro.</p>

      <form id="loginForm">
        <div class="field">
          <label for="username">Usuário</label>
          <input id="username" name="username" autocomplete="username" placeholder="seu usuário" required />
        </div>

        <div class="field">
          <label for="password">Senha</label>
          <input id="password" name="password" type="password" autocomplete="current-password" placeholder="sua senha" required />
        </div>

        <button class="btn btn-primary" style="margin-top:18px;width:100%" type="submit">Entrar</button>
        <div id="loginError" class="error"></div>
      </form>
    </div>
  </section>

  <section id="appScreen" class="app hidden">
    <aside class="sidebar">
      <div class="brand">
        <span class="brand-badge">T</span>
        <span>${APP_NAME}</span>
      </div>

      <div class="section-title">Condomínios</div>
      <div id="condominioList" class="condominio-list"></div>

      <div class="sidebar-actions">
        <button id="newCondominioBtn" class="btn btn-primary">Novo condomínio</button>
        <button id="refreshBtn" class="btn">Atualizar</button>
      </div>
    </aside>

    <main class="main">
      <header class="topbar">
        <div>
          <h1 id="condominioTitle">Condomínios</h1>
          <p id="condominioSubtitle">Selecione um condomínio para ver as tarefas operacionais.</p>
        </div>

        <div class="topbar-right">
          <div id="userPill" class="user-pill"></div>
          <button id="logoutBtn" class="btn btn-ghost">Sair</button>
        </div>
      </header>

      <div id="globalLoading" class="loading-bar hidden"></div>

      <div class="content">
        <div class="composer">
          <textarea id="taskTitle" placeholder="Escreva uma tarefa...&#10;Ex.: Agendar manutenção da bomba da caixa d'água até sexta"></textarea>
          <div class="composer-footer">
            <span>A primeira linha vira o título. O restante vira a descrição.</span>
            <button id="createTaskBtn" class="btn btn-primary">Criar tarefa</button>
          </div>
        </div>

        <div id="tasks" class="tasks"></div>
        <div id="emptyState" class="empty hidden">Nenhuma tarefa cadastrada neste condomínio.</div>
      </div>
    </main>
  </section>

  <script>
    const state = {
      user: null,
      condominios: [],
      currentCondominio: null,
      currentView: null,
      tasks: [],
      loading: false,
    };

    const els = {
      loginScreen: document.getElementById('loginScreen'),
      appScreen: document.getElementById('appScreen'),
      loginForm: document.getElementById('loginForm'),
      loginError: document.getElementById('loginError'),
      condominioList: document.getElementById('condominioList'),
      condominioTitle: document.getElementById('condominioTitle'),
      condominioSubtitle: document.getElementById('condominioSubtitle'),
      userPill: document.getElementById('userPill'),
      taskTitle: document.getElementById('taskTitle'),
      createTaskBtn: document.getElementById('createTaskBtn'),
      tasks: document.getElementById('tasks'),
      emptyState: document.getElementById('emptyState'),
      refreshBtn: document.getElementById('refreshBtn'),
      logoutBtn: document.getElementById('logoutBtn'),
      newCondominioBtn: document.getElementById('newCondominioBtn'),
      globalLoading: document.getElementById('globalLoading'),
    };

    function escapeHtml(str) {
      return String(str)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
    }

    function setLoading(value) {
      state.loading = value;
      els.globalLoading.classList.toggle('hidden', !value);
      els.createTaskBtn.disabled = value;
      els.refreshBtn.disabled = value;
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

    function renderCondominios() {
      els.condominioList.innerHTML = '';

      for (const condominio of state.condominios) {
        const btn = document.createElement('button');
        btn.className = 'condominio-item' + (state.currentCondominio && state.currentCondominio.id === condominio.id ? ' active' : '');
        btn.innerHTML = '<span class="dot"></span><span>' + escapeHtml(condominio.title || 'Sem título') + '</span>';

        btn.onclick = async () => {
          state.currentCondominio = condominio;
          await loadViewsAndTasks();
          render();
        };

        els.condominioList.appendChild(btn);
      }
    }

    function renderHeader() {
      els.userPill.textContent = state.user ? (state.user.name || state.user.username || 'Usuário') : '';

      if (state.currentCondominio) {
        els.condominioTitle.textContent = state.currentCondominio.title || 'Condomínio';
        els.condominioSubtitle.textContent = state.currentCondominio.description || 'Operação do condomínio';
      } else {
        els.condominioTitle.textContent = 'Condomínios';
        els.condominioSubtitle.textContent = 'Selecione um condomínio para visualizar as tarefas.';
      }
    }

    function renderTasks() {
      els.tasks.innerHTML = '';
      const tasks = state.tasks || [];
      els.emptyState.classList.toggle('hidden', tasks.length > 0);

      for (const task of tasks) {
        const item = document.createElement('article');
        item.className = 'task';
        item.innerHTML =
          '<div class="task-head">' +
            '<input class="checkbox" type="checkbox" ' + (task.done ? 'checked' : '') + ' />' +
            '<div class="task-main">' +
              '<h3 class="task-title ' + (task.done ? 'done' : '') + '">' + escapeHtml(task.title || 'Sem título') + '</h3>' +
              (task.description ? '<div class="task-desc">' + escapeHtml(task.description) + '</div>' : '') +
              '<div class="task-meta">' +
                '<span class="tag">#' + String(task.id) + '</span>' +
                '<span class="tag">' + (task.done ? 'Concluída' : 'Em aberto') + '</span>' +
                (task.identifier ? '<span class="tag">' + escapeHtml(task.identifier) + '</span>' : '') +
              '</div>' +
              '<div class="task-actions">' +
                '<button class="btn btn-ghost edit-btn">Editar</button>' +
                '<button class="btn btn-danger delete-btn">Excluir</button>' +
              '</div>' +
            '</div>' +
          '</div>';

        const checkbox = item.querySelector('.checkbox');
        const editBtn = item.querySelector('.edit-btn');
        const deleteBtn = item.querySelector('.delete-btn');

        checkbox.addEventListener('change', async () => {
          try {
            setLoading(true);
            await api('/api/tasks/' + task.id, {
              method: 'POST',
              body: {
                title: task.title,
                description: task.description || '',
                done: checkbox.checked,
              },
            });
            await loadTasks();
            render();
          } catch (err) {
            alert(err.message || 'Não foi possível atualizar a tarefa.');
            checkbox.checked = !checkbox.checked;
          } finally {
            setLoading(false);
          }
        });

        editBtn.addEventListener('click', async () => {
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
            render();
          } catch (err) {
            alert(err.message || 'Não foi possível editar a tarefa.');
          } finally {
            setLoading(false);
          }
        });

        deleteBtn.addEventListener('click', async () => {
          if (!confirm('Excluir esta tarefa?')) return;

          try {
            setLoading(true);
            await api('/api/tasks/' + task.id, { method: 'DELETE' });
            await loadTasks();
            render();
          } catch (err) {
            alert(err.message || 'Não foi possível excluir a tarefa.');
          } finally {
            setLoading(false);
          }
        });

        els.tasks.appendChild(item);
      }
    }

    function render() {
      renderCondominios();
      renderHeader();
      renderTasks();
    }

    function showLogin() {
      els.loginScreen.classList.remove('hidden');
      els.appScreen.classList.add('hidden');
    }

    function showApp() {
      els.loginScreen.classList.add('hidden');
      els.appScreen.classList.remove('hidden');
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
      if (!state.currentCondominio) return;
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
      state.tasks = Array.isArray(result) ? result : [];
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
      showLogin();
    });

    els.refreshBtn.addEventListener('click', async () => {
      try {
        setLoading(true);
        await loadCondominios();
        await loadViewsAndTasks();
        render();
      } catch (err) {
        alert(err.message || 'Falha ao atualizar dados.');
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

    els.createTaskBtn.addEventListener('click', async () => {
      if (!state.currentCondominio) {
        alert('Crie ou selecione um condomínio primeiro.');
        return;
      }

      const raw = els.taskTitle.value.trim();
      if (!raw) return;

      const lines = raw.split('\\n');
      const title = lines[0].trim();
      const description = lines.slice(1).join('\\n').trim();

      try {
        setLoading(true);
        await api('/api/condominios/' + state.currentCondominio.id + '/tasks', {
          method: 'PUT',
          body: { title, description },
        });
        els.taskTitle.value = '';
        await loadTasks();
        render();
      } catch (err) {
        alert(err.message || 'Falha ao criar tarefa.');
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
          message: upstream.payload?.message || 'Usuário ou senha inválidos.',
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

  if (url.pathname === '/api/condominios' && req.method === 'GET') {
    return proxyJson(req, res, '/api/v1/projects');
  }

  if (url.pathname === '/api/condominios' && req.method === 'PUT') {
    return proxyJson(req, res, '/api/v1/projects');
  }

  const viewsMatch = url.pathname.match(/^\/api\/condominios\/(\d+)\/views$/);
  if (viewsMatch && req.method === 'GET') {
    return proxyJson(req, res, '/api/v1/projects/' + viewsMatch[1] + '/views');
  }

  const viewTasksMatch = url.pathname.match(/^\/api\/condominios\/(\d+)\/views\/(\d+)\/tasks$/);
  if (viewTasksMatch && req.method === 'GET') {
    return proxyJson(req, res, '/api/v1/projects/' + viewTasksMatch[1] + '/views/' + viewTasksMatch[2] + '/tasks');
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
