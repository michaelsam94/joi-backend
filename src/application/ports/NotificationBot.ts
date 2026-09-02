export interface NotificationBot {
  /** Sends a message to a single chat id. Implementations should not throw on failure for one chat — they should let callers try the next one. */
  sendMessage(chatId: string, text: string): Promise<void>;
  /** Finds every chat id that has recently messaged the bot (e.g. "/start"), so a broadcast can
   * reach everyone who's registered themselves with Telegram without a hand-maintained list.
   * Implementations should return [] rather than throw when nothing can be discovered. */
  discoverChatIds(): Promise<string[]>;
}
