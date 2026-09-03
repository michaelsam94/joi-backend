import {
  EventRepository,
  CreateEventData,
  UpdateEventData,
  CreateEventPaymentData,
  UpdateEventPaymentData,
} from '../ports/EventRepository';
import { UserRepository } from '../ports/UserRepository';
import { Clock } from '../ports/Clock';
import { NotFoundError, ValidationError } from '../../domain/errors/AppError';
import { Event, EventPayment, paymentStanding, roundMoney } from '../../domain/entities/Event';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function assertEventFields(data: { name?: string; price?: number; eventDate?: string }): void {
  if (data.name !== undefined && !data.name.trim()) throw new ValidationError('Event name is required');
  if (data.price !== undefined && data.price < 0) throw new ValidationError('Price cannot be negative');
  if (data.eventDate !== undefined && !DATE_PATTERN.test(data.eventDate)) {
    throw new ValidationError('Event date must be YYYY-MM-DD');
  }
}

export class CreateEventUseCase {
  constructor(private readonly events: EventRepository) {}
  async execute(data: CreateEventData): Promise<Event> {
    assertEventFields(data);
    return this.events.create({ ...data, price: roundMoney(data.price) });
  }
}

export class UpdateEventUseCase {
  constructor(private readonly events: EventRepository) {}
  async execute(id: string, data: UpdateEventData): Promise<Event> {
    const existing = await this.events.findById(id);
    if (!existing) throw new NotFoundError('Event not found');
    assertEventFields(data);
    return this.events.update(id, data.price !== undefined ? { ...data, price: roundMoney(data.price) } : data);
  }
}

export class DeleteEventUseCase {
  constructor(private readonly events: EventRepository) {}
  async execute(id: string): Promise<void> {
    const existing = await this.events.findById(id);
    if (!existing) throw new NotFoundError('Event not found');
    // event_payments cascades on delete — removing an event takes its payment ledger with it.
    await this.events.delete(id);
  }
}

/** An event plus where the *asking* member stands on it — so the list screen can show "you've
 * paid 200 of 500" without a second round-trip per event. */
export interface EventWithMyStanding extends Event {
  myPaidAmount: number;
  myRemainingAmount: number;
  myFullyPaid: boolean;
}

export interface ListEventsInput {
  /** Who's asking — their own payment totals are folded into the result. */
  viewerId: string;
  /** Members only ever see active events; a moderator can ask for the inactive ones too. */
  activeOnly: boolean;
  /** Default true: hide events whose date has already passed. */
  upcomingOnly: boolean;
}

export class ListEventsUseCase {
  constructor(
    private readonly events: EventRepository,
    private readonly clock: Clock,
  ) {}

  async execute(input: ListEventsInput): Promise<EventWithMyStanding[]> {
    const today = this.clock.now().toISOString().slice(0, 10);
    const [events, totals] = await Promise.all([
      this.events.list({ activeOnly: input.activeOnly, from: input.upcomingOnly ? today : undefined }),
      this.events.totalsByEventForUser(input.viewerId),
    ]);
    return events.map((event) => {
      const standing = paymentStanding(event.price, totals[event.id] ?? 0);
      return {
        ...event,
        myPaidAmount: standing.paidAmount,
        myRemainingAmount: standing.remainingAmount,
        myFullyPaid: standing.fullyPaid,
      };
    });
  }
}

/** One member's line on the moderator's roster for an event. */
export interface EventRosterEntry {
  userId: string;
  fullName: string;
  paidAmount: number;
  remainingAmount: number;
  fullyPaid: boolean;
  payments: EventPayment[];
}

export interface EventRoster {
  event: Event;
  entries: EventRosterEntry[];
  /** Everything collected for the event so far, across all members. */
  totalCollected: number;
  /** What the event would bring in if every active member paid in full. */
  totalExpected: number;
}

/**
 * The moderator's payment sheet for one event: every active member listed whether they've paid
 * anything or not (that's the point — it's the list of who still owes), each with their
 * installments. Anyone who paid but has since been deactivated still appears, so money already
 * collected never silently vanishes from the sheet.
 */
export class GetEventRosterUseCase {
  constructor(
    private readonly events: EventRepository,
    private readonly users: UserRepository,
  ) {}

  async execute(eventId: string): Promise<EventRoster> {
    const event = await this.events.findById(eventId);
    if (!event) throw new NotFoundError('Event not found');

    const [payments, allUsers] = await Promise.all([
      this.events.listPaymentsForEvent(eventId),
      this.users.list({}),
    ]);

    const byUser = new Map<string, EventPayment[]>();
    for (const payment of payments) {
      const list = byUser.get(payment.userId);
      if (list) list.push(payment);
      else byUser.set(payment.userId, [payment]);
    }

    const roster = allUsers.filter((user) => user.active || byUser.has(user.id));
    const entries = roster
      .map((user) => {
        const own = byUser.get(user.id) ?? [];
        const standing = paymentStanding(
          event.price,
          own.reduce((sum, p) => sum + p.amount, 0),
        );
        return {
          userId: user.id,
          fullName: user.fullName,
          paidAmount: standing.paidAmount,
          remainingAmount: standing.remainingAmount,
          fullyPaid: standing.fullyPaid,
          payments: own,
        };
      })
      .sort((a, b) => a.fullName.localeCompare(b.fullName));

    return {
      event,
      entries,
      totalCollected: roundMoney(payments.reduce((sum, p) => sum + p.amount, 0)),
      totalExpected: roundMoney(event.price * entries.length),
    };
  }
}

export interface MyEventPayments {
  eventId: string;
  price: number;
  paidAmount: number;
  remainingAmount: number;
  fullyPaid: boolean;
  payments: EventPayment[];
}

/** What one member sees about their own money on one event — their installments and what's left. */
export class GetMyEventPaymentsUseCase {
  constructor(private readonly events: EventRepository) {}

  async execute(eventId: string, userId: string): Promise<MyEventPayments> {
    const event = await this.events.findById(eventId);
    if (!event) throw new NotFoundError('Event not found');
    const payments = await this.events.listPaymentsForUser(eventId, userId);
    const standing = paymentStanding(
      event.price,
      payments.reduce((sum, p) => sum + p.amount, 0),
    );
    return { eventId, price: event.price, ...standing, payments };
  }
}

/**
 * Records one installment against a member's balance for an event. Called once for a member who
 * pays the whole price up front, or repeatedly as they pay it off in parts — the ledger is the
 * source of truth either way.
 */
export class RecordEventPaymentUseCase {
  constructor(
    private readonly events: EventRepository,
    private readonly users: UserRepository,
  ) {}

  async execute(data: CreateEventPaymentData): Promise<EventPayment> {
    const event = await this.events.findById(data.eventId);
    if (!event) throw new NotFoundError('Event not found');
    const user = await this.users.findById(data.userId);
    if (!user) throw new NotFoundError('User not found');
    if (data.amount === 0) throw new ValidationError('Payment amount cannot be 0');
    return this.events.addPayment({ ...data, amount: roundMoney(data.amount) });
  }
}

/** Corrects an installment a moderator entered wrong — this is how "change the amount paid by a
 * member" is done without losing the rest of their ledger. */
export class UpdateEventPaymentUseCase {
  constructor(private readonly events: EventRepository) {}

  async execute(paymentId: string, data: UpdateEventPaymentData): Promise<EventPayment> {
    const existing = await this.events.findPaymentById(paymentId);
    if (!existing) throw new NotFoundError('Payment not found');
    if (data.amount !== undefined && data.amount === 0) throw new ValidationError('Payment amount cannot be 0');
    return this.events.updatePayment(
      paymentId,
      data.amount !== undefined ? { ...data, amount: roundMoney(data.amount) } : data,
    );
  }
}

export class DeleteEventPaymentUseCase {
  constructor(private readonly events: EventRepository) {}

  async execute(paymentId: string): Promise<void> {
    const existing = await this.events.findPaymentById(paymentId);
    if (!existing) throw new NotFoundError('Payment not found');
    await this.events.deletePayment(paymentId);
  }
}

/**
 * Sets a member's *total* paid for an event to an exact figure, whatever their ledger currently
 * says — the "just make it say 250" affordance, kept separate from editing one installment.
 * Implemented as a single balancing entry rather than a rewrite, so the history of what was
 * actually collected and when stays intact.
 */
export class SetMemberEventTotalUseCase {
  constructor(
    private readonly events: EventRepository,
    private readonly users: UserRepository,
  ) {}

  async execute(input: {
    eventId: string;
    userId: string;
    total: number;
    moderatorId: string;
  }): Promise<MyEventPayments> {
    const event = await this.events.findById(input.eventId);
    if (!event) throw new NotFoundError('Event not found');
    const user = await this.users.findById(input.userId);
    if (!user) throw new NotFoundError('User not found');
    if (input.total < 0) throw new ValidationError('Total paid cannot be negative');

    const payments = await this.events.listPaymentsForUser(input.eventId, input.userId);
    const current = roundMoney(payments.reduce((sum, p) => sum + p.amount, 0));
    const difference = roundMoney(input.total - current);

    if (difference !== 0) {
      await this.events.addPayment({
        eventId: input.eventId,
        userId: input.userId,
        amount: difference,
        note: `Adjusted total to ${input.total}`,
        recordedById: input.moderatorId,
      });
    }

    const updated = await this.events.listPaymentsForUser(input.eventId, input.userId);
    const standing = paymentStanding(
      event.price,
      updated.reduce((sum, p) => sum + p.amount, 0),
    );
    return { eventId: input.eventId, price: event.price, ...standing, payments: updated };
  }
}
