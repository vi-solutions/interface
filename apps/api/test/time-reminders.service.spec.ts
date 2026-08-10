import {
  getZonedNow,
  TimeRemindersService,
} from "../src/time-reminders/time-reminders.service";

describe("TimeRemindersService", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      RESEND_API_KEY: "test-key",
      TIME_REMINDER_FROM_EMAIL: "time@example.com",
      WEB_URL: "https://app.example.com",
    };
  });

  afterEach(() => {
    process.env = originalEnv;
    jest.restoreAllMocks();
  });

  it("uses Vancouver local time across daylight saving time", () => {
    expect(getZonedNow(new Date("2026-08-10T23:00:00Z"))).toEqual({
      date: "2026-08-10",
      hour: 16,
      weekday: "Mon",
    });
    expect(getZonedNow(new Date("2026-12-10T00:00:00Z"))).toEqual({
      date: "2026-12-09",
      hour: 16,
      weekday: "Wed",
    });
  });

  it("does not query before 4 PM or on weekends", async () => {
    const pool = { query: jest.fn() };
    const service = new TimeRemindersService(pool as never);

    await service.checkAndSend(new Date("2026-08-10T22:59:00Z"));
    await service.checkAndSend(new Date("2026-08-09T23:00:00Z"));

    expect(pool.query).not.toHaveBeenCalled();
  });

  it("sends once to eligible candidates and records delivery", async () => {
    const pool = {
      query: jest
        .fn()
        .mockResolvedValueOnce({
          rows: [{ id: "user-1", email: "worker@example.com", name: "Sam" }],
        })
        .mockResolvedValueOnce({ rowCount: 1, rows: [{ id: "reminder-1" }] })
        .mockResolvedValueOnce({ rowCount: 1, rows: [] }),
    };
    const fetchMock = jest
      .spyOn(global, "fetch")
      .mockResolvedValue({ ok: true } as Response);
    const service = new TimeRemindersService(pool as never);

    await service.checkAndSend(new Date("2026-08-10T23:00:00Z"));

    const candidateSql = pool.query.mock.calls[0][0] as string;
    expect(candidateSql).toContain("u.active = TRUE");
    expect(candidateSql).toContain("u.role IN ('employee', 'contractor')");
    expect(candidateSql).toContain("te.date = $1");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(pool.query.mock.calls[2][0]).toContain("status = 'sent'");
  });
});
