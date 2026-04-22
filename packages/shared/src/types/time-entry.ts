export interface TimeEntry {
  id: string;
  projectId: string;
  userId: string;
  taskId: string | null;
  date: string;
  hours: number;
  description: string | null;
  billable: boolean;
  qboTimeActivityId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTimeEntryDto {
  projectId: string;
  userId: string;
  taskId?: string;
  date: string;
  hours: number;
  description?: string;
  billable?: boolean;
}

export interface UpdateTimeEntryDto extends Partial<CreateTimeEntryDto> {}

export interface TimeEntryWithUser extends TimeEntry {
  user: { id: string; name: string };
  task: { id: string; name: string } | null;
}

export interface TimeEntryWithDetails extends TimeEntry {
  user: { id: string; name: string };
  project: { id: string; name: string };
  task: { id: string; name: string } | null;
}
