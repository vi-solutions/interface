export type ExpenseType = "dollar" | "per_km" | "per_day";

export interface Expense {
  id: string;
  name: string;
  description: string | null;
  type: ExpenseType;
  rateCents: number;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateExpenseDto {
  name: string;
  description?: string;
  type: ExpenseType;
  rateCents?: number;
}

export interface UpdateExpenseDto extends Partial<CreateExpenseDto> {}

export interface ProjectExpense {
  id: string;
  projectId: string;
  expenseId: string | null;
  name: string;
  description: string | null;
  type: ExpenseType;
  rateCents: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateProjectExpenseDto {
  projectId: string;
  expenseId?: string;
  name?: string;
  description?: string;
  type?: ExpenseType;
  rateCents: number;
}

export interface UpdateProjectExpenseDto {
  name?: string;
  description?: string;
  type?: ExpenseType;
  rateCents?: number;
}

export interface UserExpense {
  id: string;
  projectId: string;
  userId: string;
  projectExpenseId: string;
  date: string;
  quantity: number | null;
  totalCents: number;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface UserExpenseWithDetails extends UserExpense {
  user: { id: string; name: string };
  expenseName: string;
  expenseType: ExpenseType;
}

export interface CreateUserExpenseDto {
  projectId: string;
  userId: string;
  projectExpenseId: string;
  date: string;
  quantity?: number;
  totalCents: number;
  notes?: string;
}

export interface UpdateUserExpenseDto {
  date?: string;
  quantity?: number;
  totalCents?: number;
  notes?: string;
}
