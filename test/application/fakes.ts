import { UserRepository, CreateUserData, UpdateUserData } from '../../src/application/ports/UserRepository';
import { User } from '../../src/domain/entities/User';
import {
  PointTransactionRepository,
  CreatePointTransactionData,
} from '../../src/application/ports/PointTransactionRepository';
import { PointTransaction } from '../../src/domain/entities/PointTransaction';
import { AttendanceRepository } from '../../src/application/ports/AttendanceRepository';
import { Attendance } from '../../src/domain/entities/Attendance';
import { PrizeRepository, CreatePrizeData, UpdatePrizeData } from '../../src/application/ports/PrizeRepository';
import { Prize, PrizeRedemption } from '../../src/domain/entities/Prize';
import {
  EventRepository,
  CreateEventData,
  UpdateEventData,
  CreateEventPaymentData,
  UpdateEventPaymentData,
  EventListFilter,
} from '../../src/application/ports/EventRepository';
import { Event, EventPayment } from '../../src/domain/entities/Event';
import { Clock } from '../../src/application/ports/Clock';
import { DatabaseExportRepository, ExportTable } from '../../src/application/ports/DatabaseExportRepository';
import { DocumentExporter, QrSheetEntry } from '../../src/application/ports/DocumentExporter';

let counter = 0;
const nextId = () => `id-${++counter}`;

export function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: nextId(),
    fullName: 'Test User',
    username: `user${counter}`,
    passwordHash: 'hash',
    role: 'MEMBER',
    mustChangePassword: false,
    qrToken: `qr-${counter}`,
    telegramChatId: null,
    totalPoints: 0,
    active: true,
    dateOfBirth: null,
    phoneNumber: null,
    address: null,
    className: null,
    note: null,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    ...overrides,
  };
}

export class FakeUserRepository implements UserRepository {
  users: User[] = [];

  async create(data: CreateUserData): Promise<User> {
    const user = makeUser({ ...data });
    this.users.push(user);
    return user;
  }
  async findById(id: string): Promise<User | null> {
    return this.users.find((u) => u.id === id) ?? null;
  }
  async findByUsername(username: string): Promise<User | null> {
    return this.users.find((u) => u.username === username) ?? null;
  }
  async findByQrToken(qrToken: string): Promise<User | null> {
    return this.users.find((u) => u.qrToken === qrToken) ?? null;
  }
  async list(filter?: { activeOnly?: boolean }): Promise<User[]> {
    return filter?.activeOnly ? this.users.filter((u) => u.active) : this.users;
  }
  async update(id: string, data: UpdateUserData): Promise<User> {
    const user = this.users.find((u) => u.id === id)!;
    Object.assign(user, data);
    return user;
  }
  async setPassword(id: string, passwordHash: string, mustChangePassword: boolean): Promise<void> {
    const user = this.users.find((u) => u.id === id)!;
    user.passwordHash = passwordHash;
    user.mustChangePassword = mustChangePassword;
  }
  async incrementPoints(id: string, delta: number): Promise<User> {
    const user = this.users.find((u) => u.id === id)!;
    user.totalPoints += delta;
    return user;
  }
}

export class FakePointTransactionRepository implements PointTransactionRepository {
  transactions: PointTransaction[] = [];

  async create(data: CreatePointTransactionData): Promise<PointTransaction> {
    const tx: PointTransaction = {
      id: nextId(),
      userId: data.userId,
      points: data.points,
      type: data.type,
      reason: data.reason ?? null,
      createdById: data.createdById ?? null,
      createdAt: new Date(),
    };
    this.transactions.push(tx);
    return tx;
  }
  async listByUser(userId: string): Promise<PointTransaction[]> {
    return this.transactions.filter((t) => t.userId === userId);
  }
}

export class FakeAttendanceRepository implements AttendanceRepository {
  records: Attendance[] = [];

  async create(userId: string, meetingDate: Date, checkedById: string): Promise<Attendance> {
    const record: Attendance = { id: nextId(), userId, meetingDate, checkedById, createdAt: new Date() };
    this.records.push(record);
    return record;
  }
  async findByUserAndDate(userId: string, meetingDate: Date): Promise<Attendance | null> {
    return (
      this.records.find((r) => r.userId === userId && r.meetingDate.getTime() === meetingDate.getTime()) ?? null
    );
  }
  async listByDate(meetingDate: Date): Promise<Attendance[]> {
    return this.records.filter((r) => r.meetingDate.getTime() === meetingDate.getTime());
  }
  async countByUser(userId: string): Promise<number> {
    return this.records.filter((r) => r.userId === userId).length;
  }
  async countTotalMeetings(): Promise<number> {
    return new Set(this.records.map((r) => r.meetingDate.getTime())).size;
  }
  async lastAttendanceDate(userId: string): Promise<Date | null> {
    const mine = this.records.filter((r) => r.userId === userId);
    if (mine.length === 0) return null;
    return new Date(Math.max(...mine.map((r) => r.meetingDate.getTime())));
  }
}

export class FakePrizeRepository implements PrizeRepository {
  prizes: Prize[] = [];
  redemptions: PrizeRedemption[] = [];

  async create(data: CreatePrizeData): Promise<Prize> {
    const prize: Prize = {
      id: nextId(),
      name: data.name,
      description: data.description ?? null,
      pointsCost: data.pointsCost,
      imageUrl: data.imageUrl ?? null,
      active: true,
      quantity: data.quantity ?? null,
    };
    this.prizes.push(prize);
    return prize;
  }
  async findById(id: string): Promise<Prize | null> {
    return this.prizes.find((p) => p.id === id) ?? null;
  }
  async list(filter?: { activeOnly?: boolean }): Promise<Prize[]> {
    return filter?.activeOnly ? this.prizes.filter((p) => p.active) : this.prizes;
  }
  async update(id: string, data: UpdatePrizeData): Promise<Prize> {
    const prize = this.prizes.find((p) => p.id === id)!;
    Object.assign(prize, data);
    return prize;
  }
  async delete(id: string): Promise<void> {
    this.prizes = this.prizes.filter((p) => p.id !== id);
  }
  async createRedemption(
    prizeId: string,
    userId: string,
    pointsSpent: number,
    redeemedById: string,
  ): Promise<PrizeRedemption> {
    const redemption: PrizeRedemption = { id: nextId(), prizeId, userId, pointsSpent, redeemedById, createdAt: new Date() };
    this.redemptions.push(redemption);
    return redemption;
  }
  async tryReserveOne(prizeId: string): Promise<boolean> {
    const prize = this.prizes.find((p) => p.id === prizeId);
    if (!prize || prize.quantity === null || prize.quantity <= 0) return false;
    prize.quantity -= 1;
    return true;
  }
  async listRedeemedPrizeIdsByUser(userId: string): Promise<string[]> {
    return Array.from(new Set(this.redemptions.filter((r) => r.userId === userId).map((r) => r.prizeId)));
  }
}

export class FixedClock implements Clock {
  constructor(private readonly date: Date) {}
  now(): Date {
    return this.date;
  }
}

export class FakeDatabaseExportRepository implements DatabaseExportRepository {
  constructor(private readonly tables: ExportTable[] = []) {}
  async exportAllTables(): Promise<ExportTable[]> {
    return this.tables;
  }
}

export class FakeDocumentExporter implements DocumentExporter {
  lastQrEntries: QrSheetEntry[] | null = null;
  lastDatabaseTabs: ExportTable[] | null = null;

  async exportQrSheet(entries: QrSheetEntry[]): Promise<{ url: string }> {
    this.lastQrEntries = entries;
    return { url: 'https://docs.google.com/document/d/fake-qr-doc/edit' };
  }

  async exportDatabaseSheet(tabs: ExportTable[]): Promise<{ url: string }> {
    this.lastDatabaseTabs = tabs;
    return { url: 'https://docs.google.com/spreadsheets/d/fake-sheet/edit' };
  }
}

export function makeEvent(overrides: Partial<Event> = {}): Event {
  return {
    id: nextId(),
    name: 'Summer Trip',
    description: null,
    location: 'Alexandria',
    price: 500,
    eventDate: '2026-07-01',
    eventTime: null,
    imageUrl: null,
    active: true,
    ...overrides,
  };
}

export class FakeEventRepository implements EventRepository {
  events: Event[] = [];
  payments: EventPayment[] = [];

  async create(data: CreateEventData): Promise<Event> {
    const event = makeEvent({
      ...data,
      description: data.description ?? null,
      location: data.location ?? null,
      eventTime: data.eventTime ?? null,
      imageUrl: data.imageUrl ?? null,
    });
    this.events.push(event);
    return event;
  }
  async findById(id: string): Promise<Event | null> {
    return this.events.find((e) => e.id === id) ?? null;
  }
  async list(filter?: EventListFilter): Promise<Event[]> {
    return this.events
      .filter((e) => (filter?.activeOnly ? e.active : true))
      .filter((e) => (filter?.from ? e.eventDate >= filter.from : true))
      .sort((a, b) => a.eventDate.localeCompare(b.eventDate));
  }
  async update(id: string, data: UpdateEventData): Promise<Event> {
    const event = this.events.find((e) => e.id === id)!;
    Object.assign(event, data);
    return event;
  }
  async delete(id: string): Promise<void> {
    this.events = this.events.filter((e) => e.id !== id);
    this.payments = this.payments.filter((p) => p.eventId !== id);
  }

  async addPayment(data: CreateEventPaymentData): Promise<EventPayment> {
    const payment: EventPayment = {
      id: nextId(),
      eventId: data.eventId,
      userId: data.userId,
      amount: data.amount,
      note: data.note ?? null,
      recordedById: data.recordedById,
      createdAt: new Date(`2026-01-0${Math.min(9, this.payments.length + 1)}`),
    };
    this.payments.push(payment);
    return payment;
  }
  async findPaymentById(id: string): Promise<EventPayment | null> {
    return this.payments.find((p) => p.id === id) ?? null;
  }
  async updatePayment(id: string, data: UpdateEventPaymentData): Promise<EventPayment> {
    const payment = this.payments.find((p) => p.id === id)!;
    Object.assign(payment, data);
    return payment;
  }
  async deletePayment(id: string): Promise<void> {
    this.payments = this.payments.filter((p) => p.id !== id);
  }
  async listPaymentsForEvent(eventId: string): Promise<EventPayment[]> {
    return this.payments.filter((p) => p.eventId === eventId);
  }
  async listPaymentsForUser(eventId: string, userId: string): Promise<EventPayment[]> {
    return this.payments.filter((p) => p.eventId === eventId && p.userId === userId);
  }
  async totalsByEventForUser(userId: string): Promise<Record<string, number>> {
    const totals: Record<string, number> = {};
    for (const payment of this.payments.filter((p) => p.userId === userId)) {
      totals[payment.eventId] = (totals[payment.eventId] ?? 0) + payment.amount;
    }
    return totals;
  }
}
