export interface User {
  id: string;
  email: string;
  name: string;
  isAdmin: boolean;
  rateCents: number;
  hourlyCostCents: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateUserDto {
  email: string;
  name: string;
  password: string;
  isAdmin?: boolean;
  rateCents?: number;
  hourlyCostCents?: number;
}

export interface UpdateUserDto {
  name?: string;
  email?: string;
  isAdmin?: boolean;
  rateCents?: number;
  hourlyCostCents?: number;
}

export type RateType = "hourly" | "daily";

export interface ProjectUserRate {
  id: string;
  projectId: string;
  userId: string;
  hourlyRateCents: number | null;
  dailyRateCents: number | null;
  budgetHours: number | null;
  budgetCents: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectUserRateWithUser extends ProjectUserRate {
  user: { id: string; name: string };
}

export interface CreateProjectUserRateDto {
  projectId: string;
  userId: string;
  hourlyRateCents?: number;
  dailyRateCents?: number;
  budgetHours?: number;
  budgetCents?: number;
}

export interface UpdateProjectUserRateDto {
  hourlyRateCents?: number | null;
  dailyRateCents?: number | null;
  budgetHours?: number | null;
  budgetCents?: number | null;
}
