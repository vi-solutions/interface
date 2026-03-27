export interface TimeCategory {
  id: string;
  name: string;
  description: string | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTimeCategoryDto {
  name: string;
  description?: string;
}

export interface UpdateTimeCategoryDto extends Partial<CreateTimeCategoryDto> {}

export interface ProjectTimeCategory {
  id: string;
  projectId: string;
  timeCategoryId: string | null;
  name: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateProjectTimeCategoryDto {
  projectId: string;
  timeCategoryId?: string;
  name?: string;
  description?: string;
}

export interface UpdateProjectTimeCategoryDto {
  name?: string;
  description?: string;
}
