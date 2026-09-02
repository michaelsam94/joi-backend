import { UserRepository } from '../ports/UserRepository';
import { buildLeaderboard, LeaderboardEntry } from '../../domain/entities/PointTransaction';
import { levelForPoints } from '../../domain/entities/User';

export class GetLeaderboardUseCase {
  constructor(private readonly users: UserRepository) {}

  async execute(): Promise<LeaderboardEntry[]> {
    const all = await this.users.list({ activeOnly: true });
    const members = all.filter((u) => u.role === 'MEMBER');
    return buildLeaderboard(
      members.map((u) => ({
        userId: u.id,
        fullName: u.fullName,
        totalPoints: u.totalPoints,
        level: levelForPoints(u.totalPoints),
        tieBreaker: u.createdAt,
      })),
    );
  }
}
