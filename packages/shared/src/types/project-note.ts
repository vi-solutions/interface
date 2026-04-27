export interface ProjectNote {
  id: string;
  projectId: string;
  userId: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectNoteWithAuthor extends ProjectNote {
  author: {
    id: string;
    name: string;
  };
}

export interface CreateProjectNoteDto {
  projectId: string;
  userId: string;
  content: string;
}

export interface UpdateProjectNoteDto {
  content: string;
}
