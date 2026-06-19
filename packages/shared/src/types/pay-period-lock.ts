export interface PayPeriodLock {
  id: string;
  periodStart: string;
  periodEnd: string;
  lockedBy: string | null;
  lockedAt: string;
  createdAt: string;
  updatedAt: string;
  lockedByUser?: { id: string; name: string } | null;
}

export interface CreatePayPeriodLockDto {
  periodStart: string;
  periodEnd: string;
}
