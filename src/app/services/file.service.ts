import { inject, Injectable } from '@angular/core';
import { HttpService } from './http.service';
import { Observable } from 'rxjs';
import { FileUploadTarget, FileGroup, ProjectFile } from '../models/file.model';
import { NotificationService } from './notification.service';
import { HttpHeaders } from '@angular/common/http';

@Injectable({
  providedIn: 'root',
})
export class FileService {
  #httpService = inject(HttpService);
  #notificationService = inject(NotificationService);

  /**
   * Uploads files for an object or project
   * For objects: Creates a new file group
   * For projects: Creates simple files without groups
   * @param fileData - FormData containing the file(s)
   * @param target - 'object' or 'project'
   * @param id - The ID of the object or project
   * @returns Observable with the upload result (array of uploaded file paths)
   */
  uploadFile(
    fileData: FormData,
    target: FileUploadTarget = 'object',
    id?: string
  ): Observable<string[]> {
    if (!id) {
      const errorMsg =
        target === 'project'
          ? 'Project ID is required for project file upload'
          : 'Object ID is required for object file upload';
      this.#notificationService.showError(errorMsg);
      throw new Error(errorMsg);
    }

    const endpoint = `file/${target}/${id}`;
    // Don't set Content-Type header for FormData - browser will set it with boundary
    const headers = new HttpHeaders();
    return this.#httpService.post<string[]>(endpoint, fileData, headers);
  }

  /**
   * Uploads files for an object (creates a new file group)
   */
  uploadFileForObject(fileData: FormData, objectId: string): Observable<string[]> {
    return this.uploadFile(fileData, 'object', objectId);
  }

  /**
   * Uploads files for a project (simple file storage)
   */
  uploadFileForProject(fileData: FormData, projectId: string): Observable<string[]> {
    return this.uploadFile(fileData, 'project', projectId);
  }

  /**
   * Updates metadata (description/category) for a file group (object files only)
   */
  updateFileGroup(
    groupId: string,
    data: { description?: string; category?: string | null }
  ): Observable<{ message: string }> {
    const endpoint = `file/group/${groupId}`;
    return this.#httpService.put<{ message: string }>(endpoint, data);
  }

  /**
   * Gets all file groups for a specific object
   * @param objectId - The ID of the object
   * @returns Observable with array of file groups
   */
  getFilesForObject(objectId: string): Observable<FileGroup[]> {
    const endpoint = `file/object/${objectId}`;
    return this.#httpService.get<FileGroup[]>(endpoint);
  }

  /**
   * Gets all files for a specific project
   * @param projectId - The ID of the project
   * @returns Observable with array of project files
   */
  getFilesForProject(projectId: string): Observable<ProjectFile[]> {
    const endpoint = `file/project/${projectId}`;
    return this.#httpService.get<ProjectFile[]>(endpoint);
  }

  /**
   * Deletes a file by its ID
   * For object files: removes from group
   * For project files: soft delete
   * @param fileId - The ID of the file to delete
   * @returns Observable with the delete result
   */
  deleteFile(fileId: string): Observable<{ message: string }> {
    const endpoint = `file/${fileId}`;
    return this.#httpService.delete<{ message: string }>(endpoint);
  }

  /**
   * Updates metadata for a single file item
   * @param fileId - The ID of the file
   * @param data - Updated metadata (description, filename, created_at)
   */
  updateFileMetadata(
    fileId: string,
    data: { description?: string; filename?: string; created_at?: string }
  ): Observable<{ message: string }> {
    const endpoint = `file/${fileId}`;
    return this.#httpService.put<{ message: string }>(endpoint, data);
  }

  /**
   * Gets all files with their project and object context
   */
  getAllFilesWithContext(): Observable<any[]> {
    const endpoint = 'files';
    return this.#httpService.get<any[]>(endpoint);
  }
}
