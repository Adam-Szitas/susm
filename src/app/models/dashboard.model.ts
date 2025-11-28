export interface ProjectStats {
  name: string;
  object_count: number;
}

export interface DashboardStats {
  superuser_name: string;
  total_projects: number;
  projects_with_objects: ProjectStats[];
  total_objects: number;
  project_files_count: number;
  object_files_count: number;
}

