export interface Prize {
  id: string;
  name: string;
  description: string | null;
  pointsCost: number;
  imageUrl: string | null;
  active: boolean;
  /** Remaining stock. Null means unlimited (the original behavior — no stock tracking).
   * 0 means out of stock: redemption is blocked until a moderator raises it again. */
  quantity: number | null;
}

export interface PrizeRedemption {
  id: string;
  prizeId: string;
  userId: string;
  pointsSpent: number;
  redeemedById: string;
  createdAt: Date;
}
