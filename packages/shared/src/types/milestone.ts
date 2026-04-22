export interface Milestone {
  id: string;
  projectId: string;
  name: string;
  completed: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateMilestoneDto {
  projectId: string;
  name: string;
}

export interface UpdateMilestoneDto {
  name?: string;
  completed?: boolean;
}
