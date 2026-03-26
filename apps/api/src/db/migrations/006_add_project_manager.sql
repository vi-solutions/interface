-- 006_add_project_manager.sql
-- Add optional project manager (any user) to projects

ALTER TABLE projects
  ADD COLUMN project_manager_id UUID REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX idx_projects_project_manager_id ON projects(project_manager_id);
