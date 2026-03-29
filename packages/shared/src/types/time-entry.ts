export interface TimeEntry {
  id: string;
  projectId: string;
  userId: string;
  milestoneId: string | null;
  projectTimeCategoryId: string | null;
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
  milestoneId?: string;
  projectTimeCategoryId?: string;
  date: string;
  hours: number;
  description?: string;
  billable?: boolean;
}

export interface UpdateTimeEntryDto extends Partial<CreateTimeEntryDto> {}

export interface TimeEntryWithUser extends TimeEntry {
  user: { id: string; name: string };
  milestone: { id: string; name: string } | null;
  timeCategory: { id: string; name: string } | null;
}

export interface TimeEntryWithDetails extends TimeEntry {
  user: { id: string; name: string };
  project: { id: string; name: string };
  milestone: { id: string; name: string } | null;
  timeCategory: { id: string; name: string } | null;
}
