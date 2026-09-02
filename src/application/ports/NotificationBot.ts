export interface NotificationBot {
  /** Sends a message to a single chat id. Implementations should not throw on failure for one chat — they should let callers try the next one. */
  sendMessage(chatId: string, text: string): Promise<void>;
}
