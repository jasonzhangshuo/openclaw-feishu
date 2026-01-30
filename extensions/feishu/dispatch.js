import { dispatchReplyWithBufferedBlockDispatcher } from "/opt/homebrew/lib/node_modules/openclaw/dist/auto-reply/reply/provider-dispatcher.js";
import { resolveAgentRoute } from "/opt/homebrew/lib/node_modules/openclaw/dist/routing/resolve-route.js";
import { saveMediaBuffer } from "/opt/homebrew/lib/node_modules/openclaw/dist/media/store.js";
import { detectMime } from "/opt/homebrew/lib/node_modules/openclaw/dist/media/mime.js";

/**
 * 日志辅助函数
 */
function log(runtime, level, message) {
    const msg = `[feishu/dispatch] ${message}`;
    if (typeof runtime?.[level] === 'function') {
        runtime[level](msg);
    } else if (typeof runtime?.log === 'function') {
        runtime.log(msg);
    } else {
        console.error(msg);
    }
}

/**
 * 消息去重缓存（避免重复处理同一条消息）
 */
const processedMessages = new Set();
const MESSAGE_CACHE_TTL = 60000; // 60 秒后清除

function isMessageProcessed(messageId) {
    if (processedMessages.has(messageId)) {
        return true;
    }
    processedMessages.add(messageId);
    // 60 秒后自动清除
    setTimeout(() => {
        processedMessages.delete(messageId);
    }, MESSAGE_CACHE_TTL);
    return false;
}

/**
 * 下载并保存飞书图片
 */
async function downloadAndSaveImage(client, messageId, imageKey, runtime) {
    try {
        log(runtime, 'info', `Downloading image: messageId=${messageId}, imageKey=${imageKey}`);
        const { buffer, contentType } = await client.downloadImage(messageId, imageKey);
        
        // 检测 MIME 类型
        const mime = await detectMime({
            buffer,
            headerMime: contentType,
            filePath: `${imageKey}.png`,
        });
        
        // 保存到媒体目录
        const saved = await saveMediaBuffer(buffer, mime || contentType, "inbound", 10 * 1024 * 1024, `feishu_${imageKey}.png`);
        log(runtime, 'info', `Image saved to: ${saved.path}`);
        
        return {
            path: saved.path,
            contentType: saved.contentType || mime || contentType,
        };
    } catch (err) {
        log(runtime, 'error', `Failed to download image: ${err.message}`);
        return null;
    }
}

/**
 * Bridges Feishu message events to the OpenClaw agent pipeline.
 * 使用与 Telegram 相同的 dispatchReplyWithBufferedBlockDispatcher
 */
export async function dispatchFeishuMessage(params) {
    const { event, client, cfg, accountId, runtime } = params;
    
    log(runtime, 'info', `Dispatching message event...`);
    
    // 官方 SDK 事件格式
    const message = event.message;
    const sender = event.sender;

    if (!message || !sender) {
        log(runtime, 'warn', `Invalid event structure, missing message or sender`);
        return;
    }

    // 消息去重检查
    const messageId = message.message_id;
    if (messageId && isMessageProcessed(messageId)) {
        log(runtime, 'info', `Skipping duplicate message: ${messageId}`);
        return;
    }

    const chatId = message.chat_id;
    const isDirect = message.chat_type === 'p2p';
    const senderId = sender.sender_id?.open_id || sender.sender_id?.user_id || 'unknown';

    log(runtime, 'info', `Chat ID: ${chatId}, isDirect: ${isDirect}, senderId: ${senderId}`);
    log(runtime, 'info', `Message type: ${message.message_type}`);

    // Parse content based on message type
    let body = '';
    let mediaPath = null;
    let mediaType = null;
    const messageType = message.message_type;
    
    try {
        if (message.content) {
            const content = JSON.parse(message.content);
            
            switch (messageType) {
                case 'text':
                    body = content.text || '';
                    break;
                case 'image':
                    // 下载图片
                    if (content.image_key && message.message_id) {
                        const media = await downloadAndSaveImage(client, message.message_id, content.image_key, runtime);
                        if (media) {
                            mediaPath = media.path;
                            mediaType = media.contentType;
                            body = '<media:image>';
                        } else {
                            body = '[用户发送了一张图片，但下载失败]';
                        }
                    } else {
                        body = '[用户发送了一张图片]';
                    }
                    break;
                case 'file':
                    body = `[用户发送了一个文件: ${content.file_name || '未知文件'}]`;
                    break;
                case 'audio':
                    body = '[用户发送了一段语音]';
                    break;
                case 'video':
                    body = '[用户发送了一段视频]';
                    break;
                case 'sticker':
                    body = '[用户发送了一个表情包]';
                    break;
                case 'post':
                    // 富文本消息
                    body = content.title || '[用户发送了一条富文本消息]';
                    break;
                case 'share_chat':
                    body = '[用户分享了一个群聊]';
                    break;
                case 'share_user':
                    body = '[用户分享了一个联系人]';
                    break;
                default:
                    body = content.text || `[收到 ${messageType} 类型消息]`;
            }
        }
    } catch (err) {
        log(runtime, 'warn', `Failed to parse message content: ${err.message}`);
        if (typeof message.content === 'string') {
            body = message.content;
        }
    }

    if (!body) {
        log(runtime, 'warn', `Empty message body, skipping`);
        return;
    }

    log(runtime, 'info', `Processing message: "${body.substring(0, 100)}..."`);
    if (mediaPath) {
        log(runtime, 'info', `Media attached: ${mediaPath}`);
    }

    const peerId = isDirect ? senderId : chatId;
    const peerKind = isDirect ? 'dm' : 'group';

    // Resolve agent route
    let route;
    try {
        route = resolveAgentRoute({
            cfg,
            channel: 'feishu',
            accountId,
            peer: { kind: peerKind, id: peerId },
        });
        log(runtime, 'info', `Resolved route: agentId=${route.agentId}, sessionKey=${route.sessionKey}`);
    } catch (err) {
        log(runtime, 'error', `Failed to resolve agent route: ${err.message}`);
        throw err;
    }

    // 为飞书生成独立的 session key，避免与 TUI/Telegram 冲突
    // 格式: agent:{agentId}:feishu:{accountId}:{peerId}
    const feishuSessionKey = `agent:${route.agentId}:feishu:${accountId}:${peerId}`;
    log(runtime, 'info', `Using Feishu-specific session: ${feishuSessionKey}`);

    // 构建上下文 - 与 Telegram 保持一致
    const ctx = {
        Body: body,
        BodyForAgent: body,
        SenderId: senderId,
        SenderName: sender.sender_id?.user_id || senderId,
        ChatId: chatId,
        ChatType: isDirect ? 'direct' : 'group',
        MessageSid: message.message_id,
        Channel: 'feishu',
        AccountId: accountId,
        SessionKey: feishuSessionKey,  // 使用飞书独立的 session key
        AgentId: route.agentId,
        // 媒体相关字段 - 与 Telegram 一致
        MediaPath: mediaPath,
        MediaType: mediaType,
        MediaPaths: mediaPath ? [mediaPath] : undefined,
    };

    log(runtime, 'info', `Context prepared, dispatching to agent...`);

    let deliveryState = {
        delivered: false,
        skippedNonSilent: 0,
    };

    // 只发送一次最终回复
    let finalReplySent = false;
    
    try {
        await dispatchReplyWithBufferedBlockDispatcher({
            ctx,
            cfg,
            dispatcherOptions: {
                deliver: async (payload, info) => {
                    const kind = info?.kind || 'unknown';
                    log(runtime, 'info', `Received ${kind} reply: ${payload.text?.substring(0, 50)}...`);
                    
                    // 只发送一次，避免重复
                    if (finalReplySent) {
                        log(runtime, 'info', `Skipping duplicate reply`);
                        return;
                    }
                    
                    // 只在 final 时发送
                    if (kind === 'final' && payload.text) {
                        finalReplySent = true;
                        log(runtime, 'info', `Sending final reply: ${payload.text.substring(0, 100)}...`);
                        try {
                            await client.sendMessage({
                                receiveId: peerId,
                                receiveIdType: isDirect ? 'open_id' : 'chat_id',
                                content: { text: payload.text },
                            });
                            deliveryState.delivered = true;
                            log(runtime, 'info', `Reply delivered successfully`);
                        } catch (err) {
                            log(runtime, 'error', `Failed to deliver reply: ${err.message}`);
                            throw err;
                        }
                    }
                },
                onSkip: (_payload, info) => {
                    log(runtime, 'info', `Skipped reply: ${info?.reason || 'unknown'}`);
                    if (info?.reason !== "silent") {
                        deliveryState.skippedNonSilent += 1;
                    }
                },
                onError: (err, info) => {
                    log(runtime, 'error', `Reply error (${info?.kind || 'unknown'}): ${err.message}`);
                },
                onReplyStart: () => {
                    log(runtime, 'info', `Agent started generating reply...`);
                },
            },
            replyOptions: {
                agentId: route.agentId,
                disableBlockStreaming: true,  // 禁用 block streaming，避免多条消息
            },
        });

        log(runtime, 'info', `Message dispatched successfully, delivered: ${deliveryState.delivered}`);

        // 如果没有发送任何回复，发送一个默认消息
        if (!deliveryState.delivered && deliveryState.skippedNonSilent > 0) {
            log(runtime, 'info', `No reply delivered, sending fallback message`);
            await client.sendMessage({
                receiveId: peerId,
                receiveIdType: isDirect ? 'open_id' : 'chat_id',
                content: { text: '抱歉，我暂时无法生成回复，请稍后再试。' },
            });
        }

    } catch (err) {
        log(runtime, 'error', `Failed to dispatch message: ${err.message}`);
        log(runtime, 'error', `Stack: ${err.stack}`);
    }
}
