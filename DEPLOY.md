# 精简版管理页（vpn-admin-slim）

与 `_worker.js`（intranet-slim）配套的管理后台，**仅包含**：

- 订阅管理（D1 `/admin/sub-links.json`）
- Agent 管理（D1 `/admin/agents.json`）
- 节点配置（KV `config.json`：HOST / PATH / 订阅名）
- 操作日志（KV `log.json`）

不含：优选订阅、PROXYIP、gRPC/XHTTP、Clash 转换、CF 用量、Telegram 等（旧版见 `edt-pages-mirror/`）。

---

## 目录结构

```
vpn-admin-slim/
├── admin/
│   ├── index.html
│   ├── app.js
│   └── style.css
├── login/index.html
├── noADMIN/index.html
├── noKV/index.html
└── DEPLOY.md
```

---

## 部署（GitHub Pages 或 Cloudflare Pages 静态）

1. 将本目录推送到 GitHub 仓库（根目录即本文件夹内容）
2. 开启 GitHub Pages / CF Pages 静态托管
3. 得到地址，例如 `https://你的用户名.github.io/vpn-admin-slim`

---

## 接到 Worker

在 **VPN Worker 项目** → Settings → Variables：

| 变量名 | 值 |
|--------|-----|
| `ADMIN_PAGES` | `https://你的静态站地址`（**勿**末尾 `/`） |

也可用 `PAGES_STATIC` 或 `PAGES_URL`（三选一）。

**重新部署 Worker** 后访问 `/admin` 即加载本 UI。

---

## 自测

- `https://静态站/admin` → 管理页 HTML
- `https://静态站/login` → 登录页
- `https://Worker域名/admin` → 登录后完整功能（API 走 Worker）
