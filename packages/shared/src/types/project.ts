export type ProjectStatus =
  | "draft"
  | "active"
  | "on-hold"
  | "completed"
  | "archived";
export type ProjectPhase =
  | "assessment"
  | "analysis"
  | "restoration"
  | "permitting"
  | "reporting";

export interface Project {
  id: string;
  clientId: string;
  name: string;
  code: string | null;
  description: string | null;
  status: ProjectStatus;
  phase: ProjectPhase | null;
  startDate: string | null;
  endDate: string | null;
  budgetCents: number | null;
  projectManagerId: string | null;
  googleDriveFolderId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateProjectDto {
  clientId: string;
  name: string;
  code?: string;
  description?: string;
  status?: ProjectStatus;
  phase?: ProjectPhase;
  startDate?: string;
  endDate?: string;
  budgetCents?: number;
  projectManagerId?: string;
}

export interface UpdateProjectDto extends Partial<CreateProjectDto> {}

export interface ProjectWithClient extends Project {
  client: { id: string; name: string };
  projectManager: { id: string; name: string } | null;
}
