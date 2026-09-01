# 更新日志

## 1.2.0 (2026-09-01)

### 新增

- **开发者主题 8 套**：新增第一层「开发者」，全部为官方色板高还原深色主题——Catppuccin Mocha、Dracula（德古拉）、Tokyo Night（东京之夜）、Nord（北极冰川）、Gruvbox（复古暖黄）、One Dark、Solarized Dark、Ayu Mirage
- **中国经典扩展 2 套**：青花瓷风格（白瓷釉底 · 钴蓝纹样 · 描金点缀）、敦煌飞天风格（壁画土红 · 石绿 · 青金 · 土黄）
- **DeepSeek 深海蓝**：以 DeepSeek 品牌主色 #4D6BFE 定制，放「通用氛围」
- 内置风格总数 40 → 51（浅色底 33 → 36，深色底 7 → 15）

### 变更

- 版本 1.1.0 → 1.2.0（新功能，minor）
- package.json description 与 README 双版本风格总表同步更新

### 发布

- 源码：https://github.com/runcat-tommy/dsh-theme-manager
- npm：https://www.npmjs.com/package/dsh-theme-manager

## 1.1.0 (2026-09-01)

### 新增

- **更新提醒**：启动时与每 6 小时自动检查 npm 最新版本；发现新版本时右下角一次性 toast + 常驻气泡
- **一键更新**：更新对话框展示版本对比与更新内容，npm 安装精确安装 `dsh-theme-manager@版本`，GitHub 安装解析最新 commit 后按 SHA 固定安装；安装过程实时流式显示进度与日志
- **忽略 / 稍后提醒**：忽略本版本（不再提醒，设置页可恢复提醒）与稍后提醒（24 小时）
- **重启与验证**：允许自动重启的环境一键重启（端口就绪检测 + 后台重启 helper）；重启后启动时校验目标版本是否生效，成功提示、失败给出重试 / 回滚入口
- **回滚**：自动记录更新前安装来源，一键回到上一个版本
- **host 半部**（`lib/index.js`）：新增更新服务路由 `info / update / rollback / restart`（仅 loopback + Origin 校验，spec 白名单仅允许 dsh-theme-manager 自身）
- 设置页底部新增插件版本行：检查更新 / 更新 / 忽略 / 已忽略版本管理 / 更新失败警示
- 新增 `test/`（host 路由守卫测试 + client 冒烟测试）

### 变更

- 版本 0.2.0 → 1.1.0（重大版本号调整：主题管理器进入 1.x 稳定线，新功能 minor）
- 内置风格总数保持 40 套不变

### 发布

- 源码：https://github.com/runcat-tommy/dsh-theme-manager
- npm：https://www.npmjs.com/package/dsh-theme-manager

## 0.2.0 (2026-08-28)

### 新增

- **国旗系列 20 套**：新增第一层「国旗」，覆盖美国、中国、德国、日本、印度、英国、法国、意大利、加拿大、巴西、俄罗斯、韩国、墨西哥、澳大利亚、西班牙、印尼、土耳其、荷兰、沙特阿拉伯、瑞士
- 两色国旗（日本、印尼、沙特、瑞士等）由 `flagSpec()` 生成器以旗帜主色为基准，通过明度派生补齐全部背景层级 / 文字 / 边框 / 状态色
- 中英双语文案与 README 双版本风格总表同步更新

### 变更

- 内置风格总数 20 → 40（文化 / 场景 20 + 国旗 20）

## 0.1.0 (2026-08-28)

### 新增

- 两级式主题管理器：先选文化 / 场景，再选具体风格
- 首批 20 套文化 / 场景风格（中国 5 · 日本 5 · 节庆 3 · 通用氛围 7，含 7 套深色底版）
- 通过 `theme` 服务注册真实主题（`--dsw-alias-*` token），实时切换、localStorage 记忆、中英双语
- `palette()` 紧凑 spec 构建器：约 30 个核心色值自动展开为完整 token 表

### 发布

- 源码：https://github.com/runcat-tommy/dsh-theme-manager
- npm：https://www.npmjs.com/package/dsh-theme-manager
