/**
 * Feishu Socket Mode Monitor using official SDK
 */
import * as Lark from '@larksuiteoapi/node-sdk';
import { dispatchFeishuMessage } from './dispatch.js';

/**
 * 日志辅助函数
 */
function log(runtime, level, message) {
    if (typeof runtime?.[level] === 'function') {
        runtime[level](message);
    } else if (typeof runtime?.log === 'function') {
        runtime.log(message);
    } else {
        console.error(`[feishu] ${message}`);
    }
}

/**
 * Feishu WebSocket 长连接监控
 */
export async function monitorFeishuProvider(params) {
    const { client, cfg, accountId, runtime, abortSignal } = params;

    const appId = client.appId;
    const appSecret = client.appSecret;

    log(runtime, 'info', `[feishu] Starting WebSocket client for account: ${accountId}`);
    log(runtime, 'info', `[feishu] App ID: ${appId}`);

    // 创建 WebSocket 客户端
    const wsClient = new Lark.WSClient({
        appId: appId,
        appSecret: appSecret,
        loggerLevel: Lark.LoggerLevel.info,
    });

    // 创建事件分发器
    const eventDispatcher = new Lark.EventDispatcher({}).register({
        // 处理接收消息事件 (v2.0)
        'im.message.receive_v1': async (data) => {
            log(runtime, 'info', `[feishu] Received message event`);
            try {
                await dispatchFeishuMessage({
                    event: data,
                    client,
                    cfg,
                    accountId,
                    runtime,
                });
            } catch (err) {
                log(runtime, 'error', `[feishu] Error dispatching message: ${err.message}`);
            }
        },
    });

    // 处理中止信号
    if (abortSignal) {
        abortSignal.addEventListener('abort', () => {
            log(runtime, 'info', `[feishu] Received abort signal, closing WebSocket...`);
        });
    }

    try {
        // 启动 WebSocket 长连接
        log(runtime, 'info', `[feishu] Starting WebSocket connection...`);
        
        await wsClient.start({
            eventDispatcher: eventDispatcher,
        });

        log(runtime, 'info', `[feishu] WebSocket client started successfully`);
    } catch (err) {
        log(runtime, 'error', `[feishu] Failed to start WebSocket client: ${err.message}`);
        throw err;
    }
}
