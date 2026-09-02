import TelegramBot from 'node-telegram-bot-api';
import { NotificationBot } from '../../application/ports/NotificationBot';

export class TelegramNotificationBot implements NotificationBot {
  private readonly bot: TelegramBot | null;

  constructor(token: string | undefined) {
    // polling: false — this bot only ever pushes the weekly report, it doesn't need to receive messages.
    this.bot = token ? new TelegramBot(token, { polling: false }) : null;
  }

  get enabled(): boolean {
    return this.bot !== null;
  }

  async sendMessage(chatId: string, text: string): Promise<void> {
    if (!this.bot) {
      console.warn('[telegram] TELEGRAM_BOT_TOKEN not set — skipping send to', chatId);
      return;
    }
    await this.bot.sendMessage(chatId, text, { parse_mode: 'Markdown' });
  }
}
