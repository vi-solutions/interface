export interface TimeEntry {
  id: string;
  projectId: string;
  userId: string;
  date: string;
  hours: number;
  description: string | null;
  billable: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTimeEntryDto {
  projectId: string;
  userId: string;
  date: string;
  hours: number;
  description?: string;
  billable?: boolean;
}

export interface UpdateTimeEntryDto extends Partial<CreateTimeEntryDto> {}

export interface TimeEntryWithUser extends TimeEntry {
  user: { id: string; name: string };
}

export interface TimeEntryWithDetails extends TimeEntry {
  user: { id: string; name: string };
  project: { id: string; name: string };
}
