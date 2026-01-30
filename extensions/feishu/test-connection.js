/**
 * 飞书长连接测试脚本
 * 运行此脚本来测试 WebSocket 长连接是否能成功建立
 * 
 * 使用方法: node test-connection.js
 */
import * as Lark from '@larksuiteoapi/node-sdk';

// 从 openclaw.json 读取配置
import { readFileSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

const configPath = join(homedir(), '.clawdbot', 'openclaw.json');
const config = JSON.parse(readFileSync(configPath, 'utf-8'));

const appId = config.channels?.feishu?.appId;
const appSecret = config.channels?.feishu?.appSecret;

if (!appId || !appSecret) {
    console.error('错误: 未找到飞书配置 (appId/appSecret)');
    console.error('请检查 ~/.clawdbot/openclaw.json 中的 channels.feishu 配置');
    process.exit(1);
}

console.log('='.repeat(50));
console.log('飞书 WebSocket 长连接测试');
console.log('='.repeat(50));
console.log(`App ID: ${appId}`);
console.log(`App Secret: ${appSecret.substring(0, 8)}...`);
console.log('');

// 创建 WebSocket 客户端
const wsClient = new Lark.WSClient({
    appId: appId,
    appSecret: appSecret,
    loggerLevel: Lark.LoggerLevel.debug,
});

// 创建事件分发器
const eventDispatcher = new Lark.EventDispatcher({}).register({
    // 处理接收消息事件
    'im.message.receive_v1': async (data) => {
        console.log('');
        console.log('📨 收到消息事件:');
        console.log(JSON.stringify(data, null, 2));
        console.log('');
    },
});

console.log('正在启动 WebSocket 连接...');
console.log('（连接成功后，请去飞书开发者后台刷新页面，应该能看到"已建立长连接"）');
console.log('');

// 启动连接
wsClient.start({
    eventDispatcher: eventDispatcher,
}).then(() => {
    console.log('');
    console.log('✅ WebSocket 连接已启动！');
    console.log('');
    console.log('现在你可以:');
    console.log('1. 去飞书开发者后台刷新页面，确认显示"已建立长连接"');
    console.log('2. 点击"保存"按钮保存长连接配置');
    console.log('3. 给机器人发送消息测试');
    console.log('');
    console.log('按 Ctrl+C 退出');
}).catch((err) => {
    console.error('');
    console.error('❌ WebSocket 连接失败:');
    console.error(err.message);
    console.error('');
    console.error('可能的原因:');
    console.error('1. App ID 或 App Secret 不正确');
    console.error('2. 应用未启用或未发布');
    console.error('3. 网络问题');
    process.exit(1);
});

// 处理退出信号
process.on('SIGINT', () => {
    console.log('');
    console.log('正在关闭连接...');
    process.exit(0);
});
