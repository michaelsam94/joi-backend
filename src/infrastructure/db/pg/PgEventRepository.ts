import { Pool } from 'pg';
import {
  EventRepository,
  CreateEventData,
  UpdateEventData,
  CreateEventPaymentData,
  UpdateEventPaymentData,
  EventListFilter,
} from '../../../application/ports/EventRepository';
import { Event, EventPayment } from '../../../domain/entities/Event';

interface EventRow {
  id: string;
  name: string;
  description: string | null;
  location: string | null;
  /** pg returns NUMERIC as a string to avoid silently losing precision — parsed below. */
  price: string;
  event_date: Date | string;
  event_time: string | null;
  image_url: string | null;
  active: boolean;
}

interface EventPaymentRow {
  id: string;
  event_id: string;
  user_id: string;
  amount: string;
  note: string | null;
  recorded_by_id: string;
  created_at: Date;
}

/** A DATE column comes back as a JS Date in the server's timezone; slicing the ISO string of a
 * Date built from a UTC-midnight DATE is the same round-trip the rest of the app does. */
const toDateString = (value: Date | string): string =>
  typeof value === 'string' ? value.slice(0, 10) : value.toISOString().slice(0, 10);

const toEvent = (row: EventRow): Event => ({
  id: row.id,
  name: row.name,
  description: row.description,
  location: row.location,
  price: Number(row.price),
  eventDate: toDateString(row.event_date),
  eventTime: row.event_time,
  imageUrl: row.image_url,
  active: row.active,
});

const toPayment = (row: EventPaymentRow): EventPayment => ({
  id: row.id,
  eventId: row.event_id,
  userId: row.user_id,
  amount: Number(row.amount),
  note: row.note,
  recordedById: row.recorded_by_id,
  createdAt: row.created_at,
});

export class PgEventRepository implements EventRepository {
  constructor(private readonly db: Pool) {}

  async create(data: CreateEventData): Promise<Event> {
    const { rows } = await this.db.query<EventRow>(
      `INSERT INTO events (name, description, location, price, event_date, event_time, image_url)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [
        data.name,
        data.description ?? null,
        data.location ?? null,
        data.price,
        data.eventDate,
        data.eventTime ?? null,
        data.imageUrl ?? null,
      ],
    );
    return toEvent(rows[0]);
  }

  async findById(id: string): Promise<Event | null> {
    const { rows } = await this.db.query<EventRow>('SELECT * FROM events WHERE id = $1', [id]);
    return rows[0] ? toEvent(rows[0]) : null;
  }

  async list(filter?: EventListFilter): Promise<Event[]> {
    const conditions: string[] = [];
    const values: unknown[] = [];
    if (filter?.activeOnly) conditions.push('active = TRUE');
    if (filter?.from) {
      values.push(filter.from);
      conditions.push(`event_date >= $${values.length}`);
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const { rows } = await this.db.query<EventRow>(
      `SELECT * FROM events ${where} ORDER BY event_date ASC, name ASC`,
      values,
    );
    return rows.map(toEvent);
  }

  async update(id: string, data: UpdateEventData): Promise<Event> {
    const sets: string[] = [];
    const values: unknown[] = [];
    let i = 1;

    const assign = (column: string, value: unknown) => {
      sets.push(`${column} = $${i++}`);
      values.push(value);
    };

    if (data.name !== undefined) assign('name', data.name);
    if (data.description !== undefined) assign('description', data.description);
    if (data.location !== undefined) assign('location', data.location);
    if (data.price !== undefined) assign('price', data.price);
    if (data.eventDate !== undefined) assign('event_date', data.eventDate);
    if (data.eventTime !== undefined) assign('event_time', data.eventTime);
    if (data.imageUrl !== undefined) assign('image_url', data.imageUrl);
    if (data.active !== undefined) assign('active', data.active);
    sets.push('updated_at = now()');

    values.push(id);
    const { rows } = await this.db.query<EventRow>(
      `UPDATE events SET ${sets.join(', ')} WHERE id = $${i} RETURNING *`,
      values,
    );
    return toEvent(rows[0]);
  }

  async delete(id: string): Promise<void> {
    await this.db.query('DELETE FROM events WHERE id = $1', [id]);
  }

  async addPayment(data: CreateEventPaymentData): Promise<EventPayment> {
    const { rows } = await this.db.query<EventPaymentRow>(
      `INSERT INTO event_payments (event_id, user_id, amount, note, recorded_by_id)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [data.eventId, data.userId, data.amount, data.note ?? null, data.recordedById],
    );
    return toPayment(rows[0]);
  }

  async findPaymentById(id: string): Promise<EventPayment | null> {
    const { rows } = await this.db.query<EventPaymentRow>('SELECT * FROM event_payments WHERE id = $1', [id]);
    return rows[0] ? toPayment(rows[0]) : null;
  }

  async updatePayment(id: string, data: UpdateEventPaymentData): Promise<EventPayment> {
    const sets: string[] = [];
    const values: unknown[] = [];
    let i = 1;

    if (data.amount !== undefined) {
      sets.push(`amount = $${i++}`);
      values.push(data.amount);
    }
    if (data.note !== undefined) {
      sets.push(`note = $${i++}`);
      values.push(data.note);
    }
    sets.push('updated_at = now()');

    values.push(id);
    const { rows } = await this.db.query<EventPaymentRow>(
      `UPDATE event_payments SET ${sets.join(', ')} WHERE id = $${i} RETURNING *`,
      values,
    );
    return toPayment(rows[0]);
  }

  async deletePayment(id: string): Promise<void> {
    await this.db.query('DELETE FROM event_payments WHERE id = $1', [id]);
  }

  async listPaymentsForEvent(eventId: string): Promise<EventPayment[]> {
    const { rows } = await this.db.query<EventPaymentRow>(
      'SELECT * FROM event_payments WHERE event_id = $1 ORDER BY created_at ASC',
      [eventId],
    );
    return rows.map(toPayment);
  }

  async listPaymentsForUser(eventId: string, userId: string): Promise<EventPayment[]> {
    const { rows } = await this.db.query<EventPaymentRow>(
      'SELECT * FROM event_payments WHERE event_id = $1 AND user_id = $2 ORDER BY created_at ASC',
      [eventId, userId],
    );
    return rows.map(toPayment);
  }

  async totalsByEventForUser(userId: string): Promise<Record<string, number>> {
    // Summed in SQL as NUMERIC so the arithmetic is exact; only the final per-event figure
    // becomes a JS number.
    const { rows } = await this.db.query<{ event_id: string; total: string }>(
      `SELECT event_id, SUM(amount) AS total FROM event_payments WHERE user_id = $1 GROUP BY event_id`,
      [userId],
    );
    const totals: Record<string, number> = {};
    for (const row of rows) totals[row.event_id] = Number(row.total);
    return totals;
  }
}
