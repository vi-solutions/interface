import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import { Pool } from "pg";
import { DATABASE_POOL } from "../db/database.module";

const CHECK_INTERVAL_MS = 60_000;
const DEFAULT_TIME_ZONE = "America/Vancouver";
const REMINDER_HOUR = 16;

interface ReminderCandidate {
  id: string;
  email: string;
  name: string;
}

export interface ZonedNow {
  date: string;
  hour: number;
  weekday: string;
}

export function getZonedNow(
  now: Date,
  timeZone = DEFAULT_TIME_ZONE,
): ZonedNow {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
    weekday: "short",
  }).formatToParts(now);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";

  return {
    date: `${value("year")}-${value("month")}-${value("day")}`,
    hour: Number(value("hour")),
    weekday: value("weekday"),
  };
}

@Injectable()
export class TimeRemindersService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TimeRemindersService.name);
  private timer: ReturnType<typeof setInterval> | null = null;
  private running = false;

  constructor(@Inject(DATABASE_POOL) private readonly pool: Pool) {}

  onModuleInit(): void {
    if (!this.isConfigured()) {
      this.logger.warn(
        "Time reminders disabled: RESEND_API_KEY or TIME_REMINDER_FROM_EMAIL is missing",
      );
      return;
    }

    void this.checkAndSend();
    this.timer = setInterval(() => void this.checkAndSend(), CHECK_INTERVAL_MS);
    this.timer.unref?.();
    this.logger.log(
      `Time reminders enabled for weekdays at 4:00 PM ${this.timeZone}`,
    );
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  private get timeZone(): string {
    return process.env.TIME_REMINDER_TIME_ZONE ?? DEFAULT_TIME_ZONE;
  }

  private isConfigured(): boolean {
    return Boolean(
      process.env.RESEND_API_KEY && process.env.TIME_REMINDER_FROM_EMAIL,
    );
  }

  async checkAndSend(now = new Date()): Promise<void> {
    if (!this.isConfigured() || this.running) return;

    const zoned = getZonedNow(now, this.timeZone);
    if (["Sat", "Sun"].includes(zoned.weekday) || zoned.hour < REMINDER_HOUR) {
      return;
    }

    this.running = true;
    try {
      const candidates = await this.findCandidates(zoned.date);
      for (const candidate of candidates) {
        await this.sendCandidate(candidate, zoned.date);
      }
    } catch (error) {
      this.logger.error("Failed to run the daily time reminder check", error);
    } finally {
      this.running = false;
    }
  }

  private async findCandidates(date: string): Promise<ReminderCandidate[]> {
    const { rows } = await this.pool.query<ReminderCandidate>(
      `SELECT u.id, u.email, u.name
       FROM users u
       WHERE u.active = TRUE
         AND u.role IN ('employee', 'contractor')
         AND NOT EXISTS (
         SELECT 1 FROM time_entries te
         WHERE te.user_id = u.id AND te.date = $1
       )
       ORDER BY u.name`,
      [date],
    );
    return rows;
  }

  private async sendCandidate(
    candidate: ReminderCandidate,
    date: string,
  ): Promise<void> {
    const claimed = await this.claim(candidate.id, date);
    if (!claimed) return;

    try {
      await this.sendEmail(candidate, date);
      await this.pool.query(
        `UPDATE time_entry_reminders
         SET status = 'sent', sent_at = NOW(), last_error = NULL,
             updated_at = NOW()
         WHERE user_id = $1 AND reminder_date = $2`,
        [candidate.id, date],
      );
      this.logger.log(`Sent time reminder to ${candidate.email}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await this.pool.query(
        `UPDATE time_entry_reminders
         SET status = 'failed', last_error = $3, updated_at = NOW()
         WHERE user_id = $1 AND reminder_date = $2`,
        [candidate.id, date, message.slice(0, 1000)],
      );
      this.logger.error(`Failed to send time reminder to ${candidate.email}`);
    }
  }

  private async claim(userId: string, date: string): Promise<boolean> {
    const { rowCount } = await this.pool.query(
      `INSERT INTO time_entry_reminders (user_id, reminder_date)
       VALUES ($1, $2)
       ON CONFLICT (user_id, reminder_date) DO UPDATE
       SET status = 'claimed', claimed_at = NOW(), updated_at = NOW()
       WHERE time_entry_reminders.status = 'failed'
          OR (
            time_entry_reminders.status = 'claimed'
            AND time_entry_reminders.claimed_at < NOW() - INTERVAL '10 minutes'
          )
       RETURNING id`,
      [userId, date],
    );
    return rowCount === 1;
  }

  private async sendEmail(
    candidate: ReminderCandidate,
    date: string,
  ): Promise<void> {
    const timeUrl = `${process.env.WEB_URL ?? "http://localhost:3000"}/time`;
    const safeName = escapeHtml(candidate.name);
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.TIME_REMINDER_FROM_EMAIL,
        to: [candidate.email],
        subject: "Reminder: enter today's time",
        text: `Hi ${candidate.name},\n\nYou don't have any time entered for ${date}. Please enter your time before the end of the day:\n\n${timeUrl}\n\nThank you.`,
        html: `<p>Hi ${safeName},</p><p>You don't have any time entered for ${date}. Please enter your time before the end of the day.</p><p><a href="${escapeHtml(timeUrl)}">Enter today's time</a></p><p>Thank you.</p>`,
      }),
    });

    if (!response.ok) {
      const details = await response.text();
      throw new Error(`Resend returned ${response.status}: ${details}`);
    }
  }
}

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>'"]/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        "'": "&#39;",
        '"': "&quot;",
      })[character]!,
  );
}
