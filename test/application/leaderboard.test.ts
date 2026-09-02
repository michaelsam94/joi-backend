import { buildLeaderboard } from '../../src/domain/entities/PointTransaction';
import { levelForPoints } from '../../src/domain/entities/User';

describe('buildLeaderboard', () => {
  it('ranks by points descending', () => {
    const board = buildLeaderboard([
      { userId: 'a', fullName: 'A', totalPoints: 10, level: 'Bronze', tieBreaker: new Date('2026-01-01') },
      { userId: 'b', fullName: 'B', totalPoints: 30, level: 'Bronze', tieBreaker: new Date('2026-01-02') },
      { userId: 'c', fullName: 'C', totalPoints: 20, level: 'Bronze', tieBreaker: new Date('2026-01-03') },
    ]);
    expect(board.map((e) => e.userId)).toEqual(['b', 'c', 'a']);
    expect(board.map((e) => e.rank)).toEqual([1, 2, 3]);
  });

  it('gives tied points the same dense rank, broken only for ordering by earliest tieBreaker', () => {
    const board = buildLeaderboard([
      { userId: 'a', fullName: 'A', totalPoints: 20, level: 'Bronze', tieBreaker: new Date('2026-01-05') },
      { userId: 'b', fullName: 'B', totalPoints: 20, level: 'Bronze', tieBreaker: new Date('2026-01-01') },
      { userId: 'c', fullName: 'C', totalPoints: 10, level: 'Bronze', tieBreaker: new Date('2026-01-01') },
    ]);
    // b joined earlier than a, so b sorts first among the tie, but both share rank 1
    expect(board.map((e) => e.userId)).toEqual(['b', 'a', 'c']);
    expect(board.map((e) => e.rank)).toEqual([1, 1, 3]);
  });

  it('handles an empty list', () => {
    expect(buildLeaderboard([])).toEqual([]);
  });
});

describe('levelForPoints', () => {
  it.each([
    [0, 'Bronze'],
    [99, 'Bronze'],
    [100, 'Silver'],
    [299, 'Silver'],
    [300, 'Gold'],
    [599, 'Gold'],
    [600, 'Diamond'],
    [10000, 'Diamond'],
  ])('%i points -> %s', (points, expected) => {
    expect(levelForPoints(points)).toBe(expected);
  });
});
