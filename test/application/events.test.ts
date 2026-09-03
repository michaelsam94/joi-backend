import {
  CreateEventUseCase,
  ListEventsUseCase,
  GetEventRosterUseCase,
  GetMyEventPaymentsUseCase,
  RecordEventPaymentUseCase,
  UpdateEventPaymentUseCase,
  DeleteEventPaymentUseCase,
  SetMemberEventTotalUseCase,
} from '../../src/application/events/EventUseCases';
import { paymentStanding } from '../../src/domain/entities/Event';
import { NotFoundError, ValidationError } from '../../src/domain/errors/AppError';
import { FakeEventRepository, FakeUserRepository, FixedClock } from './fakes';

/** The whole cast a payment test needs: an event, a moderator recording, and a member paying. */
async function setup(price = 500) {
  const events = new FakeEventRepository();
  const users = new FakeUserRepository();
  const moderator = await users.create({ fullName: 'Mod', username: 'mod', passwordHash: 'h', role: 'MODERATOR' });
  const member = await users.create({ fullName: 'Member', username: 'mem', passwordHash: 'h', role: 'MEMBER' });
  const event = await events.create({ name: 'Summer Trip', price, eventDate: '2026-07-01' });
  return { events, users, moderator, member, event };
}

describe('paymentStanding', () => {
  it('reports what is left, and never reports a negative remainder for an overpayment', () => {
    expect(paymentStanding(500, 200)).toEqual({ paidAmount: 200, remainingAmount: 300, fullyPaid: false });
    expect(paymentStanding(500, 500)).toEqual({ paidAmount: 500, remainingAmount: 0, fullyPaid: true });
    expect(paymentStanding(500, 600)).toEqual({ paidAmount: 600, remainingAmount: 0, fullyPaid: true });
    // a free event is paid for the moment it exists
    expect(paymentStanding(0, 0).fullyPaid).toBe(true);
  });

  it('does not let repeated decimal arithmetic drift', () => {
    expect(paymentStanding(100, 0.1 + 0.2)).toEqual({ paidAmount: 0.3, remainingAmount: 99.7, fullyPaid: false });
  });
});

describe('CreateEventUseCase', () => {
  it('rejects a blank name, a negative price and a malformed date', async () => {
    const events = new FakeEventRepository();
    const useCase = new CreateEventUseCase(events);
    const base = { name: 'Trip', price: 100, eventDate: '2026-07-01' };

    await expect(useCase.execute({ ...base, name: '  ' })).rejects.toBeInstanceOf(ValidationError);
    await expect(useCase.execute({ ...base, price: -1 })).rejects.toBeInstanceOf(ValidationError);
    await expect(useCase.execute({ ...base, eventDate: '01-07-2026' })).rejects.toBeInstanceOf(ValidationError);
    await expect(useCase.execute({ ...base, price: 0 })).resolves.toMatchObject({ price: 0 });
  });
});

describe('RecordEventPaymentUseCase', () => {
  it('accumulates installments so a member can pay the price across several payments', async () => {
    const { events, users, moderator, member, event } = await setup(500);
    const record = new RecordEventPaymentUseCase(events, users);
    const mine = new GetMyEventPaymentsUseCase(events);

    await record.execute({ eventId: event.id, userId: member.id, amount: 200, recordedById: moderator.id });
    let standing = await mine.execute(event.id, member.id);
    expect(standing).toMatchObject({ paidAmount: 200, remainingAmount: 300, fullyPaid: false });

    await record.execute({ eventId: event.id, userId: member.id, amount: 300, recordedById: moderator.id });
    standing = await mine.execute(event.id, member.id);
    expect(standing).toMatchObject({ paidAmount: 500, remainingAmount: 0, fullyPaid: true });
    expect(standing.payments).toHaveLength(2);
  });

  it('settles the whole price in one payment just as happily', async () => {
    const { events, users, moderator, member, event } = await setup(500);
    await new RecordEventPaymentUseCase(events, users).execute({
      eventId: event.id,
      userId: member.id,
      amount: 500,
      recordedById: moderator.id,
    });
    expect(await new GetMyEventPaymentsUseCase(events).execute(event.id, member.id)).toMatchObject({
      paidAmount: 500,
      fullyPaid: true,
    });
  });

  it('rejects a zero amount and an unknown event or member', async () => {
    const { events, users, moderator, member, event } = await setup();
    const record = new RecordEventPaymentUseCase(events, users);

    await expect(
      record.execute({ eventId: event.id, userId: member.id, amount: 0, recordedById: moderator.id }),
    ).rejects.toBeInstanceOf(ValidationError);
    await expect(
      record.execute({ eventId: 'nope', userId: member.id, amount: 50, recordedById: moderator.id }),
    ).rejects.toBeInstanceOf(NotFoundError);
    await expect(
      record.execute({ eventId: event.id, userId: 'nope', amount: 50, recordedById: moderator.id }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe('changing what a member has paid', () => {
  it('edits one installment without disturbing the rest of the ledger', async () => {
    const { events, users, moderator, member, event } = await setup(500);
    const record = new RecordEventPaymentUseCase(events, users);
    const first = await record.execute({
      eventId: event.id,
      userId: member.id,
      amount: 200,
      recordedById: moderator.id,
    });
    await record.execute({ eventId: event.id, userId: member.id, amount: 100, recordedById: moderator.id });

    await new UpdateEventPaymentUseCase(events).execute(first.id, { amount: 350 });

    const standing = await new GetMyEventPaymentsUseCase(events).execute(event.id, member.id);
    expect(standing.paidAmount).toBe(450);
    expect(standing.payments).toHaveLength(2);
  });

  it('removes an installment entered by mistake', async () => {
    const { events, users, moderator, member, event } = await setup(500);
    const payment = await new RecordEventPaymentUseCase(events, users).execute({
      eventId: event.id,
      userId: member.id,
      amount: 200,
      recordedById: moderator.id,
    });

    await new DeleteEventPaymentUseCase(events).execute(payment.id);

    expect(await new GetMyEventPaymentsUseCase(events).execute(event.id, member.id)).toMatchObject({
      paidAmount: 0,
      remainingAmount: 500,
    });
    await expect(new DeleteEventPaymentUseCase(events).execute(payment.id)).rejects.toBeInstanceOf(NotFoundError);
  });

  it('sets a total outright with a balancing entry, keeping the earlier history', async () => {
    const { events, users, moderator, member, event } = await setup(500);
    await new RecordEventPaymentUseCase(events, users).execute({
      eventId: event.id,
      userId: member.id,
      amount: 200,
      recordedById: moderator.id,
    });

    const setTotal = new SetMemberEventTotalUseCase(events, users);
    const raised = await setTotal.execute({
      eventId: event.id,
      userId: member.id,
      total: 350,
      moderatorId: moderator.id,
    });
    expect(raised).toMatchObject({ paidAmount: 350, remainingAmount: 150 });
    expect(raised.payments).toHaveLength(2); // the original 200 is still on record

    // lowering it works the same way, via a negative balancing entry
    const lowered = await setTotal.execute({
      eventId: event.id,
      userId: member.id,
      total: 100,
      moderatorId: moderator.id,
    });
    expect(lowered.paidAmount).toBe(100);

    // setting it to what it already is adds nothing
    const unchanged = await setTotal.execute({
      eventId: event.id,
      userId: member.id,
      total: 100,
      moderatorId: moderator.id,
    });
    expect(unchanged.payments).toHaveLength(lowered.payments.length);

    await expect(
      setTotal.execute({ eventId: event.id, userId: member.id, total: -5, moderatorId: moderator.id }),
    ).rejects.toBeInstanceOf(ValidationError);
  });
});

describe('ListEventsUseCase', () => {
  it('hides events whose date has passed, but keeps the one happening today', async () => {
    const events = new FakeEventRepository();
    await events.create({ name: 'Last year', price: 0, eventDate: '2026-01-01' });
    await events.create({ name: 'Today', price: 0, eventDate: '2026-06-15' });
    await events.create({ name: 'Later', price: 0, eventDate: '2026-09-01' });
    const useCase = new ListEventsUseCase(events, new FixedClock(new Date('2026-06-15T09:00:00.000Z')));

    const upcoming = await useCase.execute({ viewerId: 'someone', activeOnly: true, upcomingOnly: true });
    expect(upcoming.map((e) => e.name)).toEqual(['Today', 'Later']);

    const all = await useCase.execute({ viewerId: 'someone', activeOnly: true, upcomingOnly: false });
    expect(all).toHaveLength(3);
  });

  it("carries each viewer's own balance, and nobody else's", async () => {
    const { events, users, moderator, member, event } = await setup(500);
    const other = await users.create({ fullName: 'Other', username: 'oth', passwordHash: 'h', role: 'MEMBER' });
    const record = new RecordEventPaymentUseCase(events, users);
    await record.execute({ eventId: event.id, userId: member.id, amount: 200, recordedById: moderator.id });
    await record.execute({ eventId: event.id, userId: other.id, amount: 500, recordedById: moderator.id });

    const useCase = new ListEventsUseCase(events, new FixedClock(new Date('2026-01-01T00:00:00.000Z')));
    const [asMember] = await useCase.execute({ viewerId: member.id, activeOnly: true, upcomingOnly: true });
    expect(asMember).toMatchObject({ myPaidAmount: 200, myRemainingAmount: 300, myFullyPaid: false });

    const [asOther] = await useCase.execute({ viewerId: other.id, activeOnly: true, upcomingOnly: true });
    expect(asOther).toMatchObject({ myPaidAmount: 500, myFullyPaid: true });
  });
});

describe('GetEventRosterUseCase', () => {
  it('lists every member — including the ones who have paid nothing yet — with the totals', async () => {
    const { events, users, moderator, member, event } = await setup(500);
    const zoe = await users.create({ fullName: 'Zoe', username: 'zoe', passwordHash: 'h', role: 'MEMBER' });
    await new RecordEventPaymentUseCase(events, users).execute({
      eventId: event.id,
      userId: member.id,
      amount: 200,
      recordedById: moderator.id,
    });

    const roster = await new GetEventRosterUseCase(events, users).execute(event.id);

    expect(roster.entries.map((e) => e.fullName)).toEqual(['Member', 'Mod', 'Zoe']); // sorted by name
    expect(roster.entries.find((e) => e.userId === member.id)).toMatchObject({
      paidAmount: 200,
      remainingAmount: 300,
      fullyPaid: false,
    });
    expect(roster.entries.find((e) => e.userId === zoe.id)).toMatchObject({ paidAmount: 0, remainingAmount: 500 });
    expect(roster.totalCollected).toBe(200);
    expect(roster.totalExpected).toBe(1500);
  });

  it('keeps a deactivated member who already paid on the sheet', async () => {
    const { events, users, moderator, member, event } = await setup(500);
    await new RecordEventPaymentUseCase(events, users).execute({
      eventId: event.id,
      userId: member.id,
      amount: 500,
      recordedById: moderator.id,
    });
    await users.update(member.id, { active: false });
    const quitter = await users.create({ fullName: 'Quitter', username: 'q', passwordHash: 'h', role: 'MEMBER' });
    await users.update(quitter.id, { active: false });

    const roster = await new GetEventRosterUseCase(events, users).execute(event.id);
    const names = roster.entries.map((e) => e.fullName);
    expect(names).toContain('Member'); // paid, so their money stays visible
    expect(names).not.toContain('Quitter'); // inactive and never paid — off the sheet
  });
});
