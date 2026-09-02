export interface Prize {
  id: string;
  name: string;
  description: string | null;
  pointsCost: number;
  imageUrl: string | null;
  active: boolean;
}

export interface PrizeRedemption {
  id: string;
  prizeId: string;
  userId: string;
  pointsSpent: number;
  redeemedById: string;
  createdAt: Date;
}
