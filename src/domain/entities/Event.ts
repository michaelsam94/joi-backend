export interface Event {
  id: string;
  name: string;
  description: string | null;
  location: string | null;
  /** Price per person. 0 means free. */
  price: number;
  /** YYYY-MM-DD. */
  eventDate: string;
  /** HH:MM start time, or null when it isn't fixed yet. */
  eventTime: string | null;
  imageUrl: string | null;
  active: boolean;
}

/**
 * One installment. A member can settle an event's price in a single payment or across many, so
 * what they've "paid" is always the sum of these — never a single stored total that could drift.
 */
export interface EventPayment {
  id: string;
  eventId: string;
  userId: string;
  amount: number;
  note: string | null;
  recordedById: string;
  createdAt: Date;
}

/** Money is carried as a plain number; every value crossing a boundary goes through this so
 * repeated float arithmetic can't leave 19.999999999999996 in a response. */
export function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

export interface PaymentStanding {
  paidAmount: number;
  /** What's still owed. Clamped at 0 — an overpayment shows up as paidAmount > price, not as a
   * negative remainder. */
  remainingAmount: number;
  fullyPaid: boolean;
}

/** Pure domain rule: where one member stands against one event's price. */
export function paymentStanding(price: number, paidAmount: number): PaymentStanding {
  const paid = roundMoney(paidAmount);
  return {
    paidAmount: paid,
    remainingAmount: Math.max(0, roundMoney(price - paid)),
    fullyPaid: paid >= price,
  };
}

/** True when the event hasn't happened yet, relative to a YYYY-MM-DD "today". The day of the
 * event itself still counts as upcoming — it's only over once the date has passed. */
export function isUpcoming(event: Event, today: string): boolean {
  return event.eventDate >= today;
}
