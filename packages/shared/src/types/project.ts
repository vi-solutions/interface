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
  description: string | null;
  status: ProjectStatus;
  phase: ProjectPhase | null;
  startDate: string | null;
  endDate: string | null;
  budgetCents: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateProjectDto {
  clientId: string;
  name: string;
  description?: string;
  status?: ProjectStatus;
  phase?: ProjectPhase;
  startDate?: string;
  endDate?: string;
  budgetCents?: number;
}

export interface UpdateProjectDto extends Partial<CreateProjectDto> {}

export interface ProjectWithClient extends Project {
  client: { id: string; name: string };
}
