# My ClawdBot Configuration

我的 OpenClaw AI Agent 配置，包含飞书插件。

## 目录结构

```
.clawdbot/
├── openclaw.json.example  # 配置示例（需复制为 openclaw.json 并填入真实值）
├── workspace/             # Agent 工作空间
│   ├── AGENTS.md         # Agent 行为指南
│   ├── SOUL.md           # Agent 性格设定
│   ├── IDENTITY.md       # Agent 身份
│   ├── USER.md           # 用户信息
│   └── TOOLS.md          # 工具和渠道配置
├── extensions/            # 扩展插件
│   └── feishu/           # 飞书插件
└── identity/             # 头像等
```

## 安装

1. 安装 OpenClaw:
```bash
npm install -g openclaw
```

2. 复制此仓库到 `~/.clawdbot/`:
```bash
git clone https://github.com/YOUR_USER/clawdbot-config.git ~/.clawdbot
```

3. 复制并编辑配置文件:
```bash
cp ~/.clawdbot/openclaw.json.example ~/.clawdbot/openclaw.json
# 编辑 openclaw.json，填入你的 API keys 和 tokens
```

4. 安装飞书插件依赖:
```bash
cd ~/.clawdbot/extensions/feishu
npm install
```

5. 启动:
```bash
openclaw gateway start
openclaw tui
```

## 已配置的渠道

- **Telegram** - 需要配置 bot token
- **飞书 (Feishu)** - WebSocket 长连接模式

## 注意事项

- `openclaw.json` 包含敏感信息，不要提交到 git
- 使用 `openclaw.json.example` 作为模板
