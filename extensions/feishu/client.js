/**
 * Feishu (Lark) API Client for OpenClaw
 * Using official @larksuiteoapi/node-sdk
 */
import * as Lark from '@larksuiteoapi/node-sdk';

export class FeishuClient {
  constructor(options) {
    this.appId = options.appId;
    this.appSecret = options.appSecret;
    
    // 创建官方 SDK 客户端
    this.client = new Lark.Client({
      appId: this.appId,
      appSecret: this.appSecret,
      disableTokenCache: false,
    });
  }

  /**
   * 发送消息
   */
  async sendMessage(params) {
    const { receiveId, receiveIdType, content, msgType = 'text' } = params;

    try {
      const res = await this.client.im.message.create({
        params: {
          receive_id_type: receiveIdType,
        },
        data: {
          receive_id: receiveId,
          msg_type: msgType,
          content: typeof content === 'string' ? content : JSON.stringify(content),
        },
      });

      return res;
    } catch (err) {
      console.error(`[feishu] sendMessage error: ${err.message}`);
      throw err;
    }
  }

  /**
   * 回复消息
   */
  async replyMessage(params) {
    const { messageId, content, msgType = 'text' } = params;

    try {
      const res = await this.client.im.message.reply({
        path: {
          message_id: messageId,
        },
        data: {
          msg_type: msgType,
          content: typeof content === 'string' ? content : JSON.stringify(content),
        },
      });

      return res;
    } catch (err) {
      console.error(`[feishu] replyMessage error: ${err.message}`);
      throw err;
    }
  }

  /**
   * 获取官方 SDK 客户端实例
   */
  getClient() {
    return this.client;
  }

  /**
   * 下载消息中的图片资源
   * @param {string} messageId - 消息 ID
   * @param {string} imageKey - 图片的 image_key (file_key)
   * @returns {Promise<{buffer: Buffer, contentType: string}>}
   */
  async downloadImage(messageId, imageKey) {
    try {
      // 使用 im.messageResource.get API
      // 文档: https://open.feishu.cn/document/uAjLw4CM/ukTMukTMukTM/reference/im-v1/message-resource/get
      const res = await this.client.im.messageResource.get({
        params: {
          type: 'image',  // 资源类型: image, file, audio, video
        },
        path: {
          message_id: messageId,
          file_key: imageKey,
        },
      });

      // SDK 返回对象包含 getReadableStream 方法
      if (res && typeof res.getReadableStream === 'function') {
        const stream = res.getReadableStream();
        const chunks = [];
        for await (const chunk of stream) {
          chunks.push(chunk);
        }
        const contentType = res.headers?.['content-type'] || 'image/png';
        return {
          buffer: Buffer.concat(chunks),
          contentType,
        };
      }

      // 如果返回的是 Buffer
      if (res instanceof Buffer) {
        return {
          buffer: res,
          contentType: 'image/png',
        };
      }

      throw new Error('Unexpected response format from image download');
    } catch (err) {
      console.error(`[feishu] downloadImage error: ${err.message}`);
      throw err;
    }
  }

  /**
   * 下载文件
   * @param {string} fileKey - 文件的 file_key
   * @returns {Promise<{buffer: Buffer, contentType: string, fileName: string}>}
   */
  async downloadFile(fileKey) {
    try {
      const res = await this.client.im.file.get({
        path: {
          file_key: fileKey,
        },
      });

      if (res instanceof Buffer) {
        return {
          buffer: res,
          contentType: 'application/octet-stream',
          fileName: fileKey,
        };
      }

      if (res && typeof res.pipe === 'function') {
        const chunks = [];
        for await (const chunk of res) {
          chunks.push(chunk);
        }
        return {
          buffer: Buffer.concat(chunks),
          contentType: 'application/octet-stream',
          fileName: fileKey,
        };
      }

      throw new Error('Unexpected response format from file download');
    } catch (err) {
      console.error(`[feishu] downloadFile error: ${err.message}`);
      throw err;
    }
  }
}
