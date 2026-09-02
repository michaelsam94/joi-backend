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

  /** Calls Telegram's `getUpdates` (no offset, so nothing is acknowledged/consumed) and pulls out
   * every distinct chat id that has messaged the bot. Telegram only retains unconfirmed updates
   * for ~24h/100 updates, so this finds anyone who has said something to the bot recently — it's
   * not a permanent registry, just a lightweight "who's talked to us lately" broadcast list. */
  async discoverChatIds(): Promise<string[]> {
    if (!this.bot) return [];
    const updates = await this.bot.getUpdates({ limit: 100 });
    const ids = new Set<string>();
    for (const update of updates) {
      const chatId = update.message?.chat?.id ?? update.my_chat_member?.chat?.id;
      if (chatId !== undefined) ids.add(String(chatId));
    }
    return Array.from(ids);
  }
}
