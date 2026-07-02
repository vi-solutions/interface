export interface Task {
  id: string;
  projectId: string;
  name: string;
  description: string | null;
  budgetHours: number | null;
  countsTowardBudget: boolean;
  loggedHours: number;
  createdAt: string;
  updatedAt: string;
}

export interface TaskUserBudget {
  id: string;
  taskId: string;
  userId: string;
  budgetHours: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface TaskUserBudgetWithUser extends TaskUserBudget {
  user: { id: string; name: string };
}

export interface CreateTaskDto {
  projectId: string;
  name: string;
  description?: string;
  budgetHours?: number;
  countsTowardBudget?: boolean;
}

export interface UpdateTaskDto {
  name?: string;
  description?: string | null;
  budgetHours?: number | null;
  countsTowardBudget?: boolean;
}

export interface CreateTaskUserBudgetDto {
  taskId: string;
  userId: string;
  budgetHours?: number;
}

export interface UpdateTaskUserBudgetDto {
  budgetHours?: number | null;
}
