export interface HarvestUserMatch {
  harvestId: number;
  harvestName: string;
  harvestEmail: string;
  appUserId: string | null;
  appUserName: string | null;
  matched: boolean;
}

export interface HarvestProjectMatch {
  harvestId: string;
  appProjectId: string;
  appProjectName: string | null;
}

export interface HarvestPreviewTimeEntry {
  harvestId: number;
  date: string;
  hours: number;
  description: string | null;
  billable: boolean;
  harvestProjectId: number;
  harvestProjectName: string;
  harvestTaskName: string;
  harvestUserName: string;
  appProjectId: string | null;
  appUserId: string | null;
  appProjectName: string | null;
  isDuplicate: boolean;
  isMapped: boolean;
}

export interface HarvestPreviewExpense {
  harvestId: number;
  date: string;
  totalCents: number;
  notes: string | null;
  harvestProjectId: number;
  harvestProjectName: string;
  categoryName: string;
  harvestUserName: string;
  appProjectId: string | null;
  appUserId: string | null;
  appProjectName: string | null;
  isDuplicate: boolean;
  isMapped: boolean;
}

export interface HarvestPreviewResult {
  configFound: boolean;
  from: string;
  to: string;
  users: HarvestUserMatch[];
  projects: HarvestProjectMatch[];
  timeEntries: HarvestPreviewTimeEntry[];
  expenses: HarvestPreviewExpense[];
  summary: {
    timeTotal: number;
    timeToImport: number;
    timeDuplicates: number;
    timeUnmapped: number;
    expenseTotal: number;
    expenseToImport: number;
    expenseDuplicates: number;
    expenseUnmapped: number;
  };
}

export interface HarvestImportResult {
  timeInserted: number;
  expensesInserted: number;
}

export interface HarvestProjectMapping {
  id: string;
  harvestProjectId: string;
  harvestProjectName: string;
  appProjectId: string;
  appProjectName: string | null;
  createdAt: string;
}

export interface HarvestStatus {
  credentialsConfigured: boolean;
  mappingCount: number;
}
