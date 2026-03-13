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
