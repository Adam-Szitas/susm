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
  total_users?: number;
  archived_projects_count?: number;
  total_protocol_templates?: number;
  total_protocols_generated?: number;
  total_file_groups?: number;
}

