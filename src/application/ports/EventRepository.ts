import { Event, EventPayment } from '../../domain/entities/Event';

export interface CreateEventData {
  name: string;
  description?: string | null;
  location?: string | null;
  price: number;
  /** YYYY-MM-DD. */
  eventDate: string;
  /** HH:MM. */
  eventTime?: string | null;
  imageUrl?: string | null;
}

export interface UpdateEventData {
  name?: string;
  description?: string | null;
  location?: string | null;
  price?: number;
  eventDate?: string;
  eventTime?: string | null;
  imageUrl?: string | null;
  active?: boolean;
}

export interface CreateEventPaymentData {
  eventId: string;
  userId: string;
  amount: number;
  note?: string | null;
  recordedById: string;
}

export interface UpdateEventPaymentData {
  amount?: number;
  note?: string | null;
}

export interface EventListFilter {
  activeOnly?: boolean;
  /** YYYY-MM-DD — when set, only events on or after this date are returned. */
  from?: string;
}

export interface EventRepository {
  create(data: CreateEventData): Promise<Event>;
  findById(id: string): Promise<Event | null>;
  list(filter?: EventListFilter): Promise<Event[]>;
  update(id: string, data: UpdateEventData): Promise<Event>;
  delete(id: string): Promise<void>;

  addPayment(data: CreateEventPaymentData): Promise<EventPayment>;
  findPaymentById(id: string): Promise<EventPayment | null>;
  updatePayment(id: string, data: UpdateEventPaymentData): Promise<EventPayment>;
  deletePayment(id: string): Promise<void>;
  /** Every installment recorded against one event, oldest first. */
  listPaymentsForEvent(eventId: string): Promise<EventPayment[]>;
  /** One member's installments for one event, oldest first. */
  listPaymentsForUser(eventId: string, userId: string): Promise<EventPayment[]>;
  /** eventId -> total this one member has paid, for every event they've paid anything towards.
   * Lets the event list carry each viewer's own balance without a query per event. */
  totalsByEventForUser(userId: string): Promise<Record<string, number>>;
}
