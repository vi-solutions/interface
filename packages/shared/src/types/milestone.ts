export interface Milestone {
  id: string;
  projectId: string;
  name: string;
  date: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateMilestoneDto {
  projectId: string;
  name: string;
  date?: string;
}

export interface UpdateMilestoneDto {
  name?: string;
  date?: string | null;
}
