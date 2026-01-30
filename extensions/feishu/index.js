import { FeishuClient } from './client.js';
import { monitorFeishuProvider } from './monitor.js';

/**
 * OpenClaw Feishu Channel Plugin
 * 使用飞书官方 SDK 的 WebSocket 长连接模式
 */
export default {
    id: 'feishu',
    meta: {
        label: 'Feishu',
        description: 'Feishu (Lark) Bot Integration via WebSocket Long Connection',
        systemImage: 'bubble.left.and.bubble.right',
    },

    // Register the channel when OpenClaw starts the plugin
    register: (api) => {
        const { logger, config } = api;

        // Register as a chat channel
        api.registerChannel({
            plugin: {
                id: 'feishu',
                meta: {
                    label: 'Feishu',
                    description: 'Feishu (Lark) Bot Integration via WebSocket Long Connection',
                    systemImage: 'bubble.left.and.bubble.right',
                    order: 100,
                },
                capabilities: {
                    chatTypes: ['direct', 'group'],
                    nativeCommands: true,
                    media: false,
                },

                // Account management for CLI / status
                config: {
                    listAccountIds: (cfg) => {
                        const channel = cfg.channels?.feishu;
                        if (!channel) return [];
                        return channel.accounts ? Object.keys(channel.accounts) : ['default'];
                    },
                    resolveAccount: (cfg, accountId) => {
                        const channel = cfg.channels?.feishu;
                        if (!channel) return null;
                        if (accountId === 'default' && !channel.accounts) return { config: channel, accountId: 'default' };
                        const account = channel.accounts?.[accountId];
                        return account ? { config: account, accountId } : null;
                    },
                },

                // Outbound messaging
                outbound: {
                    deliveryMode: 'direct',
                    sendText: async ({ to, text, accountId }) => {
                        const acc = config.channels.feishu.accounts?.[accountId] || config.channels.feishu;
                        const client = new FeishuClient({
                            appId: acc.appId,
                            appSecret: acc.appSecret,
                        });

                        await client.sendMessage({
                            receiveId: to,
                            receiveIdType: to.startsWith('ou_') ? 'open_id' : 'chat_id',
                            content: { text },
                        });

                        return { ok: true };
                    },
                },

                // Status reporting for CLI
                status: {
                    defaultRuntime: {
                        accountId: 'default',
                        running: false,
                        lastStartAt: null,
                        lastStopAt: null,
                        lastError: null,
                    },
                    buildChannelSummary: ({ snapshot }) => {
                        return {
                            configured: snapshot.configured,
                            running: snapshot.running,
                            lastError: snapshot.lastError,
                            detail: snapshot.running ? 'ok' : (snapshot.lastError || 'idle'),
                        };
                    },
                },

                // Background gateway service
                gateway: {
                    startAccount: async (ctx) => {
                        const { account, runtime: gatewayRuntime, log } = ctx;
                        console.error(`[feishu] startAccount called for ${account.accountId}`);
                        log?.info(`[feishu] Starting account ${account.accountId}`);

                        const client = new FeishuClient({
                            appId: account.config.appId,
                            appSecret: account.config.appSecret,
                        });

                        try {
                            console.error(`[feishu] Initializing WebSocket monitor...`);
                            // Start the WebSocket long connection monitor
                            await monitorFeishuProvider({
                                client,
                                cfg: ctx.cfg,
                                accountId: account.accountId,
                                runtime: gatewayRuntime || api.logger,
                                abortSignal: ctx.abortSignal,
                            });
                            console.error(`[feishu] WebSocket monitor started`);
                            log?.info(`[feishu] Monitor started for ${account.accountId}`);
                        } catch (err) {
                            console.error(`[feishu] ERROR in startAccount: ${err.message}`);
                            log?.error(`[feishu] Failed to start monitor for ${account.accountId}: ${err.message}`);
                            throw err;
                        }
                    },
                },
            },
        });

        logger.info('Feishu channel registered (WebSocket mode)');
    },
};
