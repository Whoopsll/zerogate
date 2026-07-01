(function () {
  'use strict';

  function toast(msg, type) {
    const el = document.createElement('div');
    el.className = 'toast ' + (type === 'error' ? 'err' : 'ok');
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(function () { el.remove(); }, 3200);
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
  }

  async function api(url, opts) {
    opts = opts || {};
    const sep = url.indexOf('?') >= 0 ? '&' : '?';
    const r = await fetch(url + sep + '_t=' + Date.now(), {
      method: opts.method || 'GET',
      credentials: 'same-origin',
      cache: 'no-store',
      headers: opts.body
        ? { 'Content-Type': 'application/json', Accept: 'application/json' }
        : { Accept: 'application/json' },
      body: opts.body ? JSON.stringify(opts.body) : undefined
    });
    const ct = (r.headers.get('content-type') || '').toLowerCase();
    if (r.url.indexOf('/login') >= 0 || ct.indexOf('json') < 0) {
      throw new Error('未登录或会话已过期，请重新登录');
    }
    const data = JSON.parse(await r.text());
    if (!r.ok || data.error) throw new Error(data.error || 'HTTP ' + r.status);
    return data;
  }

  // --- tabs ---
  const tabs = document.querySelectorAll('.nav-item[data-tab]');
  const panes = document.querySelectorAll('.tab-pane');

  function showTab(name) {
    tabs.forEach(function (t) {
      t.classList.toggle('active', t.dataset.tab === name);
    });
    panes.forEach(function (p) {
      p.classList.toggle('active', p.id === 'tab-' + name);
    });
    location.hash = name;
    if (name === 'subs') loadSubs();
    if (name === 'agents') { loadAgentSubOptions(); loadAgents(); }
    if (name === 'config') loadConfig();
    if (name === 'logs') loadLogs();
  }

  tabs.forEach(function (t) {
    t.addEventListener('click', function () { showTab(t.dataset.tab); });
  });

  const hash = (location.hash || '#subs').slice(1);
  showTab(['subs', 'agents', 'config', 'logs'].includes(hash) ? hash : 'subs');

  // --- subscriptions ---
  function showSubQR(url) {
    if (typeof QRCode === 'undefined') {
      toast('二维码库加载失败', 'error');
      return;
    }
    const modal = document.getElementById('qrcodeModal');
    const container = document.getElementById('qrcodeContainer');
    container.innerHTML = '';
    let level = QRCode.CorrectLevel.H;
    if (url.length > 1500) level = QRCode.CorrectLevel.M;
    if (url.length > 2500) level = QRCode.CorrectLevel.L;
    try {
      new QRCode(container, {
        text: url,
        width: 260,
        height: 260,
        colorDark: '#000',
        colorLight: '#fff',
        correctLevel: level
      });
      modal.hidden = false;
    } catch (err) {
      toast('链接过长，无法生成二维码', 'error');
    }
  }

  function closeSubQR() {
    const modal = document.getElementById('qrcodeModal');
    if (modal) modal.hidden = true;
  }

  document.getElementById('qrcodeClose')?.addEventListener('click', closeSubQR);
  document.getElementById('qrcodeCloseBtn')?.addEventListener('click', closeSubQR);
  document.getElementById('qrcodeModal')?.addEventListener('click', function (e) {
    if (e.target.id === 'qrcodeModal') closeSubQR();
  });

  function subCard(i) {
    const pct = Math.min(100, parseFloat(i.percent) || 0);
    return '<div class="card" data-id="' + esc(i.id) + '">'
      + '<div class="card-head">'
      + '<div><div class="card-title">' + esc(i.name) + '</div>'
      + '<span class="badge ' + (i.enabled ? 'ok' : 'off') + '">' + (i.enabled ? '启用' : '停用') + '</span></div>'
      + '<div class="muted">↑' + esc(i.uploadGB) + ' ↓' + esc(i.downloadGB) + ' / ' + esc(i.quotaGB) + ' GB</div>'
      + '</div>'
      + '<div class="progress"><span style="width:' + pct + '%"></span></div>'
      + '<div class="copy-row"><input readonly value="' + esc(i.subUrl) + '">'
      + '<button type="button" class="btn secondary sm sub-qrcode" data-url="' + esc(i.subUrl) + '">二维码</button>'
      + '<button type="button" class="btn secondary sm copy-btn" data-url="' + esc(i.subUrl) + '">复制</button></div>'
      + '<p class="muted" style="margin-top:8px;font-size:0.8rem">UUID: ' + esc(i.uuid) + ' · 账期 ' + esc(i.month) + '</p>'
      + '<div class="actions">'
      + '<button type="button" class="btn secondary sm sub-toggle" data-id="' + esc(i.id) + '" data-en="' + (!i.enabled) + '">' + (i.enabled ? '停用' : '启用') + '</button>'
      + '<button type="button" class="btn secondary sm sub-reset" data-id="' + esc(i.id) + '">重置流量</button>'
      + '<button type="button" class="btn secondary sm sub-quota" data-id="' + esc(i.id) + '" data-q="' + i.quotaGB + '">改配额</button>'
      + '<button type="button" class="btn danger sm sub-del" data-id="' + esc(i.id) + '">删除</button>'
      + '</div></div>';
  }

  async function loadSubs() {
    const el = document.getElementById('subList');
    el.innerHTML = '<div class="empty">加载中…</div>';
    try {
      const data = await api('/admin/sub-links.json');
      if (!data.items || !data.items.length) {
        el.innerHTML = '<div class="empty">暂无订阅，请在上方创建。</div>';
        return;
      }
      el.innerHTML = data.items.map(subCard).join('');
    } catch (e) {
      el.innerHTML = '<div class="empty" style="color:#fca5a5">' + esc(e.message) + '</div>';
    }
  }

  document.getElementById('createSub').addEventListener('click', async function () {
    const btn = this;
    btn.disabled = true;
    try {
      await api('/admin/sub-links.json', {
        method: 'POST',
        body: {
          name: document.getElementById('subName').value.trim(),
          quotaGB: Number(document.getElementById('subQuota').value)
        }
      });
      toast('订阅已创建');
      loadSubs();
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      btn.disabled = false;
    }
  });

  document.getElementById('refreshSubs').addEventListener('click', loadSubs);

  document.getElementById('subList').addEventListener('click', async function (e) {
    const t = e.target.closest('button');
    if (!t) return;
    const id = t.dataset.id;
    try {
      if (t.classList.contains('copy-btn')) {
        await navigator.clipboard.writeText(t.dataset.url);
        toast('已复制');
        return;
      }
      if (t.classList.contains('sub-qrcode')) {
        showSubQR(t.dataset.url || '');
        return;
      }
      if (t.classList.contains('sub-toggle')) {
        await api('/admin/sub-links.json', { method: 'PUT', body: { id, enabled: t.dataset.en === 'true' } });
        toast('已更新');
        loadSubs();
      } else if (t.classList.contains('sub-reset')) {
        if (!confirm('重置本月流量？')) return;
        await api('/admin/sub-links.json', { method: 'PUT', body: { id, resetUsage: true } });
        toast('已重置');
        loadSubs();
      } else if (t.classList.contains('sub-quota')) {
        const q = prompt('新月流量配额 (GB)', t.dataset.q);
        if (q == null) return;
        await api('/admin/sub-links.json', { method: 'PUT', body: { id, quotaGB: Number(q) } });
        toast('配额已更新');
        loadSubs();
      } else if (t.classList.contains('sub-del')) {
        if (!confirm('确定删除此订阅？')) return;
        await api('/admin/sub-links.json?id=' + encodeURIComponent(id), { method: 'DELETE' });
        toast('已删除');
        loadSubs();
      }
    } catch (err) {
      toast(err.message, 'error');
    }
  });

  // --- agents ---
  async function loadAgentSubOptions() {
    const sel = document.getElementById('agentSubId');
    try {
      const data = await api('/admin/sub-links.json');
      const items = data.items || [];
      sel.innerHTML = items.length
        ? items.map(function (s) {
          return '<option value="' + esc(s.id) + '">' + esc(s.name) + ' (' + esc(s.id.slice(0, 8)) + '…)</option>';
        }).join('')
        : '<option value="">请先创建订阅</option>';
    } catch {
      sel.innerHTML = '<option value="">加载失败</option>';
    }
  }

  function agentCard(a) {
    const rules = Array.isArray(a.allowRules) ? a.allowRules : [];
    return '<div class="card" data-id="' + esc(a.id) + '">'
      + '<div class="card-head">'
      + '<div><div class="card-title">' + esc(a.name) + '</div>'
      + '<span class="badge ' + (a.online ? 'ok' : 'off') + '">' + (a.online ? '在线' : '离线') + '</span> '
      + '<span class="badge ' + (a.enabled ? 'ok' : 'warn') + '">' + (a.enabled ? '启用' : '停用') + '</span></div>'
      + '</div>'
      + '<p class="muted" style="font-size:0.85rem;margin-bottom:8px">订阅 ID: ' + esc(a.subscriptionId) + '</p>'
      + '<label class="field"><span>Agent Token（给内网 Go Agent）</span>'
      + '<div class="copy-row"><input readonly value="' + esc(a.agentToken) + '">'
      + '<button type="button" class="btn secondary sm copy-btn" data-url="' + esc(a.agentToken) + '">复制</button></div></label>'
      + '<label class="field"><span>WebSocket 连接地址</span>'
      + '<div class="copy-row"><input readonly value="' + esc(a.wsUrl) + '">'
      + '<button type="button" class="btn secondary sm copy-btn" data-url="' + esc(a.wsUrl) + '">复制</button></div></label>'
      + '<label class="field"><span>白名单</span><textarea class="agent-rules-edit" rows="3">' + esc(rules.join('\n')) + '</textarea></label>'
      + '<div class="actions">'
      + '<button type="button" class="btn secondary sm agent-save" data-id="' + esc(a.id) + '">保存白名单</button>'
      + '<button type="button" class="btn secondary sm agent-toggle" data-id="' + esc(a.id) + '" data-en="' + (!a.enabled) + '">' + (a.enabled ? '停用' : '启用') + '</button>'
      + '<button type="button" class="btn danger sm agent-del" data-id="' + esc(a.id) + '">删除</button>'
      + '</div></div>';
  }

  async function loadAgents() {
    const el = document.getElementById('agentList');
    el.innerHTML = '<div class="empty">加载中…</div>';
    try {
      const data = await api('/admin/agents.json');
      if (!data.items || !data.items.length) {
        el.innerHTML = '<div class="empty">暂无 Agent，请在上方创建。</div>';
        return;
      }
      el.innerHTML = data.items.map(agentCard).join('');
    } catch (e) {
      el.innerHTML = '<div class="empty" style="color:#fca5a5">' + esc(e.message) + '</div>';
    }
  }

  document.getElementById('createAgent').addEventListener('click', async function () {
    const subId = document.getElementById('agentSubId').value;
    if (!subId) { toast('请选择订阅', 'error'); return; }
    const rulesText = document.getElementById('agentRules').value.trim();
    const allowRules = rulesText
      ? rulesText.split(/\n+/).map(function (l) { return l.trim(); }).filter(Boolean)
      : [];
    try {
      await api('/admin/agents.json', {
        method: 'POST',
        body: {
          subscriptionId: subId,
          name: document.getElementById('agentName').value.trim(),
          allowRules
        }
      });
      toast('Agent 已创建');
      loadAgents();
    } catch (e) {
      toast(e.message, 'error');
    }
  });

  document.getElementById('refreshAgents').addEventListener('click', function () {
    loadAgentSubOptions();
    loadAgents();
  });

  document.getElementById('agentList').addEventListener('click', async function (e) {
    const t = e.target.closest('button');
    if (!t) return;
    const card = t.closest('.card');
    const id = t.dataset.id;
    try {
      if (t.classList.contains('copy-btn')) {
        await navigator.clipboard.writeText(t.dataset.url);
        toast('已复制');
        return;
      }
      if (t.classList.contains('agent-save')) {
        const ta = card.querySelector('.agent-rules-edit');
        const allowRules = ta.value.split(/\n+/).map(function (l) { return l.trim(); }).filter(Boolean);
        await api('/admin/agents.json', { method: 'PUT', body: { id, allowRules } });
        toast('白名单已保存');
        loadAgents();
      } else if (t.classList.contains('agent-toggle')) {
        await api('/admin/agents.json', { method: 'PUT', body: { id, enabled: t.dataset.en === 'true' } });
        toast('已更新');
        loadAgents();
      } else if (t.classList.contains('agent-del')) {
        if (!confirm('确定删除此 Agent？')) return;
        await api('/admin/agents.json?id=' + encodeURIComponent(id), { method: 'DELETE' });
        toast('已删除');
        loadAgents();
      }
    } catch (err) {
      toast(err.message, 'error');
    }
  });

  // --- config ---
  async function loadConfig() {
    try {
      const cfg = await api('/admin/config.json');
      document.getElementById('cfgHost').value = (cfg.HOSTS && cfg.HOSTS[0]) || cfg.HOST || '';
      document.getElementById('cfgPath').value = cfg.PATH || '/';
      document.getElementById('cfgSubName').value = cfg.SUBNAME || 'intranet';
      document.getElementById('cfgSubUpdate').value = cfg.SUBUpdateTime || 24;
      document.getElementById('cfgUuid').value = cfg.UUID || '';
    } catch (e) {
      toast(e.message, 'error');
    }
  }

  document.getElementById('configForm').addEventListener('submit', async function (e) {
    e.preventDefault();
    const host = document.getElementById('cfgHost').value.trim();
    try {
      await api('/admin/config.json', {
        method: 'POST',
        body: {
          HOST: host,
          HOSTS: host ? [host] : [],
          PATH: document.getElementById('cfgPath').value.trim() || '/',
          SUBNAME: document.getElementById('cfgSubName').value.trim() || 'intranet',
          SUBUpdateTime: Number(document.getElementById('cfgSubUpdate').value) || 24
        }
      });
      toast('配置已保存');
    } catch (err) {
      toast(err.message, 'error');
    }
  });

  document.getElementById('resetConfig').addEventListener('click', async function () {
    if (!confirm('重置为默认配置？')) return;
    try {
      await fetch('/admin/init?_t=' + Date.now(), { credentials: 'same-origin' });
      toast('已重置');
      loadConfig();
    } catch (e) {
      toast('重置失败', 'error');
    }
  });

  // --- logs ---
  async function loadLogs() {
    const tbody = document.getElementById('logBody');
    tbody.innerHTML = '<tr><td colspan="4" class="muted">加载中…</td></tr>';
    try {
      const r = await fetch('/admin/log.json?_t=' + Date.now(), { credentials: 'same-origin', cache: 'no-store' });
      const logs = JSON.parse(await r.text());
      if (!Array.isArray(logs) || !logs.length) {
        tbody.innerHTML = '<tr><td colspan="4" class="muted">暂无日志</td></tr>';
        return;
      }
      tbody.innerHTML = logs.slice(0, 100).map(function (row) {
        const t = row.time || row.TIME || row.timestamp || '-';
        const type = row.type || row.action || row.请求类型 || '-';
        const ip = row.ip || row.IP || row.访问IP || '-';
        const detail = row.detail || row.msg || row.message || JSON.stringify(row).slice(0, 80);
        return '<tr><td>' + esc(t) + '</td><td>' + esc(type) + '</td><td>' + esc(ip) + '</td><td>' + esc(detail) + '</td></tr>';
      }).join('');
    } catch {
      tbody.innerHTML = '<tr><td colspan="4" style="color:#fca5a5">加载失败</td></tr>';
    }
  }

  document.getElementById('refreshLogs').addEventListener('click', loadLogs);
})();
