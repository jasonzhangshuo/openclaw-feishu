# OpenClaw Feishu Plugin

飞书 (Feishu/Lark) 扩展插件，用于 OpenClaw AI Agent。

## 功能

- ✅ WebSocket 长连接模式
- ✅ 接收和发送文本消息
- ✅ 图片消息下载和视觉分析
- ✅ 消息去重
- ✅ 独立 session 支持

## 安装

1. 将此目录放到 `~/.clawdbot/extensions/feishu/` 或 `~/.openclaw/extensions/feishu/`

2. 安装依赖：
```bash
cd ~/.clawdbot/extensions/feishu
npm install
```

3. 在 `openclaw.json` 中配置飞书：
```json
{
  "channels": {
    "feishu": {
      "enabled": true,
      "appId": "your_app_id",
      "appSecret": "your_app_secret",
      "dmPolicy": "open"
    }
  }
}
```

4. 重启 gateway：
```bash
openclaw gateway restart
```

## 飞书开发者后台配置

1. 创建企业自建应用
2. 开启「机器人」能力
3. 配置「使用长连接接收事件/回调」
4. 添加权限：
   - `im:message`
   - `im:message.group_at_msg`
   - `im:resource`

## 文件说明

- `index.js` - 插件入口
- `client.js` - 飞书 API 客户端
- `monitor.js` - WebSocket 连接监控
- `dispatch.js` - 消息分发处理
- `openclaw.plugin.json` - 插件配置

## 依赖

- `@larksuiteoapi/node-sdk` - 飞书官方 SDK
