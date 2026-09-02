export type PointType = 'ATTENDANCE' | 'MANUAL_ADD' | 'MANUAL_REMOVE' | 'PRIZE_REDEEM';

export interface PointTransaction {
  id: string;
  userId: string;
  points: number;
  type: PointType;
  reason: string | null;
  createdById: string | null;
  createdAt: Date;
}

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  fullName: string;
  totalPoints: number;
  level: string;
}

/**
 * Pure ranking rule: sort by points desc, ties broken by whoever reached that
 * total earliest (earlier createdAt/joinedAt wins), then assign dense ranks
 * (equal points => equal rank, e.g. 1,2,2,4).
 */
export function buildLeaderboard(
  users: Array<{ userId: string; fullName: string; totalPoints: number; level: string; tieBreaker: Date }>,
): LeaderboardEntry[] {
  const sorted = [...users].sort((a, b) => {
    if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
    return a.tieBreaker.getTime() - b.tieBreaker.getTime();
  });

  const result: LeaderboardEntry[] = [];
  let lastPoints: number | null = null;
  let lastRank = 0;
  sorted.forEach((u, idx) => {
    const rank = u.totalPoints === lastPoints ? lastRank : idx + 1;
    lastPoints = u.totalPoints;
    lastRank = rank;
    result.push({ rank, userId: u.userId, fullName: u.fullName, totalPoints: u.totalPoints, level: u.level });
  });
  return result;
}
