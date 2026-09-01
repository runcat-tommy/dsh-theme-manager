# dsh-theme-manager 更新提醒功能设计

> 本文记录 v1.1.0「更新提醒」功能的设计决策，与实现一一对应。

## 1. 目标

- 插件有新版本时，用户**不需要**定期手动查：启动 + 每 6 小时自动检查 npm registry。
- 更新操作**保证成功**：精确版本安装 + 进度可见 + 自动重启 + 失败回滚。
- 绝不打扰：忽略本版本 → 永不再提醒；稍后提醒 → 24 小时；无新版本 → 零 UI。
- 无 host 半部时优雅降级：仍能提醒，只是不能一键更新。

## 2. 交互流程

### 2.1 发现新版本（三级提醒）

1. **一次性 toast**（右下角，8s 自动消失，悬停暂停计时）：「有新版本 vX.Y.Z · 查看」。
2. **常驻气泡 pill**（右下角）：一直保留到处理或忽略；点 × 等于「稍后提醒 24h」。
3. **设置页底部版本行**（持久入口）：当前版本 / 检查更新 / 更新 / 忽略 / 已忽略版本管理 / 更新失败警示。

同一版本 toast 只弹一次（`toastSeen` 记录）；pill 每轮检查重新出现（除非已忽略 / 在 24h 静默期内）。

### 2.2 更新对话框（状态机）

```
notify ──(点更新)──▶ preflight ──▶ installing ──▶ done ──▶ restarting ──▶ (重启后 boot 验证)
                       │             │  ▲            │
                       └─ 降级路径    │  └─(失败)─────┘
                       (link:/无host) ▼    error ◀──┘
                       manual/指引    (重试 / 回滚 / 关闭)
```

- **notify**：版本对比（旧 → 新）+ 更新内容（changelog，懒加载 raw.githubusercontent）+ 重大版本警告条（major 变化）+ 忽略 / 稍后 / 更新。
- **preflight**：校验 host 信息（可自动更新？已有待重启？）。通过才发 POST。
- **installing**：宿主通过长 POST 以 NDJSON 流式回传步骤（install → verify）与安装日志；进度条为不确定式 + 步骤勾选。
- **done**：显示目标版本，给「立即重启 / 稍后重启」；不允许自动重启时给手动步骤。
- **error**：错误信息 + 安装日志（可折叠）+ 重试 / 回滚（有回滚锚点时）/ 关闭。
- **restarting**：POST 重启路由成功后页面自动重连。
- **重启后 boot 验证**：localStorage `pending` 标记 vs 当前 `PLUGIN_VERSION`：
  - `pending ≤ current` → 更新生效（或已回滚到该版本或更早）→ 弹「已更新到 vX.Y.Z」toast，清理标记并修剪忽略列表；
  - `pending > current` → 未生效 → 设置页警示 + 重试 / 回滚入口。

### 2.3 语义

| 操作 | 行为 |
|---|---|
| 更新 | npm 源 → 精确 `dsh-theme-manager@<新版本>`；GitHub 源 → host 解析 main 最新 commit，按 `github:runcat-tommy/dsh-theme-manager#<sha>` 固定安装 |
| 忽略本版本 | `ignoredVersions[]` 永久记录该精确版本；更新成功/回滚后自动修剪 ≤ 当前版本的条目 |
| 稍后提醒 | `dismissedUntil{version: ts}` = now + 24h |
| 回滚 | 更新前把 `previousSpec` 写入状态文件；回滚即用 previousSpec 再装一次（安装后清空锚点） |

## 3. Host 半部（最小实现）

路由前缀 `/dsh-theme-manager/api/v1/`（镜像 dsh-market 的 `/dsh-market/api/v1/` 模式）：

| 路由 | 方法 | 说明 |
|---|---|---|
| `/info` | GET | `{version, source(npm/github/link/unknown), sourceSpec, canAutoUpdate, allowRestart, pendingRestart, pendingTarget, boot}` |
| `/update` | POST | body `{version}`；host 自行重建并校验 spec；NDJSON 流式回传；成功后写状态文件 |
| `/rollback` | POST | 用 `state.previousSpec` 再装一次；NDJSON 流式回传 |
| `/restart` | POST | 校验后 spawn 脱离的 helper（等端口释放 → 原样重启），响应后本进程退出 |

**安全**（全部沿用 dsh-market 验证过的模式）：

- 变更类路由仅接受 loopback peer（127.0.0.1 / ::1 / ::ffff:127.0.0.1）+ Origin 与 Host 一致 + 无 `forwarded` / `x-forwarded-for` / `x-real-ip` 头；
- 安装 spec 由 host 重建并白名单校验——只能装 `dsh-theme-manager` 自身（npm 版本号 / github 仓库名+sha / 本地路径）；body 里的 version 仅作目标提示；
- 自动重启默认在检测到监督进程（systemd，INVOCATION_ID/JOURNAL_STREAM + ppid=1）或 Desktop 宿主（`ctx.get("desktopProfiles")`）时禁用；
- 一切操作都由用户在浏览器里显式点击触发，无静默行为。

**进程与状态**：

- profile 目录解析：`DSH_HOME/profiles/<name>`（默认 `~/.dsh`，`--profile` 优先，默认 `web`）；
- CLI 重调用：`node <process.argv[1]> plugin --profile <p> add <spec>`（dsh 同款重入逻辑），cwd = profile 目录；
- 状态文件 `profile/.dsh-theme-manager-state.json`：`{previousSpec, targetVersion, pendingRestart, installedAt}`；
- 重启 helper `.dsh-theme-manager-restart.cjs`（CJS，纯 Node 内置模块）：等待端口安静（最长 ~10s）→ 原样 respawn（Windows 走 `powershell -WindowStyle Hidden` 避免弹窗）→ 日志写 `dsh-theme-manager-restart.log`。

## 4. 客户端存储（localStorage）

| key | 内容 |
|---|---|
| `dsh.themeManager.update.ignored` | 忽略的精确版本数组 |
| `dsh.themeManager.update.dismissed` | `{version: timestamp}` 静默期 |
| `dsh.themeManager.update.lastCheck` | `{at, version}` 检查缓存（6h 复用，离线友好） |
| `dsh.themeManager.update.pending` | 待验证的目标版本（重启后 boot 校验） |
| `dsh.themeManager.update.toastSeen` | `{version: true}` 每版本 toast 只弹一次 |

## 5. 降级策略

- **host 路由缺失**（老版本插件 / host 加载失败）：`/info` 失败 → 更新按钮改为「手动安装指引」对话框（给出 `dsh plugin --profile web add dsh-theme-manager@<版本>` 命令）；提醒照常工作。
- **link:/file: 安装**：`canAutoUpdate=false` → 指引到源码目录更新。
- **registry 不可达**：静默失败，保留上次检查缓存，下次再试；不打断任何 UI。
- **重启被禁用**（systemd / Desktop）：安装照常，重启给出手动步骤。

## 6. 测试

- `test/host.test.mjs`：路由注册、`/info` 内容、非 loopback / Origin 不匹配 403、非法版本 400（不触发任何 spawn）、无状态回滚 400、重启禁用 403、方法校验 405。
- `test/client.stub.test.mjs`：无 DOM 环境下 apply 不抛、40 套主题仍注册、boot 校验（pending=当前 → 清除并弹 toast；pending>当前 → 保留并警示）、registry 检查与 lastCheck 缓存写入。
