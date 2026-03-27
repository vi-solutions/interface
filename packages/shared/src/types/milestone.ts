export interface Milestone {
  id: string;
  projectId: string;
  name: string;
  budgetHours: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateMilestoneDto {
  projectId: string;
  name: string;
  budgetHours?: number;
}

export interface UpdateMilestoneDto {
  name?: string;
  budgetHours?: number | null;
}
