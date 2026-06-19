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
   * Uploads files for an object. Without `groupId`, creates a new file group; with `groupId`,
   * appends files to that existing group (multipart field `group_id`).
   */
  uploadFileForObject(
    fileData: FormData,
    objectId: string,
    options?: { groupId?: string },
  ): Observable<string[]> {
    if (options?.groupId) {
      fileData.append('group_id', options.groupId);
    }
    return this.uploadFile(fileData, 'object', objectId);
  }

  /**
   * Uploads files for a project (simple file storage)
   */
  uploadFileForProject(fileData: FormData, projectId: string): Observable<string[]> {
    return this.uploadFile(fileData, 'project', projectId);
  }

  /**
   * Updates metadata for an **object** file group (`projects[].objects[].file_groups[]`).
   * Projects do not have file groups — project files live in `projects[].files` and use {@link updateFileMetadata} per file.
   */
  updateFileGroup(
    groupId: string,
    data: { description?: string; categories?: string[] | null; note?: string | null }
  ): Observable<{ message: string }> {
    const endpoint = `file/group/${groupId}`;
    return this.#httpService.put<{ message: string }>(endpoint, data);
  }

  /**
   * Soft-deletes an **object** file group (not used for project-level uploads).
   */
  deleteFileGroup(groupId: string): Observable<{ message: string }> {
    const endpoint = `file/group/${groupId}`;
    return this.#httpService.delete<{ message: string }>(endpoint);
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
   * Gets project-level files (`projects[].files`) — a flat list, no groups.
   */
  getFilesForProject(projectId: string): Observable<ProjectFile[]> {
    const endpoint = `file/project/${projectId}`;
    return this.#httpService.get<ProjectFile[]>(endpoint);
  }

  /**
   * Moves a file from its current group to another group (object files only)
   */
  moveFileToGroup(
    fileId: string,
    targetGroupId: string
  ): Observable<{ message: string }> {
    const endpoint = `file/${fileId}/move`;
    return this.#httpService.post<{ message: string }>(endpoint, {
      target_group_id: targetGroupId,
    });
  }

  /**
   * Moves a project-level file into an object's file group (removed from project files).
   */
  sendProjectFileToGroup(
    fileId: string,
    objectId: string,
    targetGroupId: string,
  ): Observable<{ message: string; file_id?: string }> {
    const endpoint = `file/${fileId}/send-to-group`;
    return this.#httpService.post<{ message: string; file_id?: string }>(endpoint, {
      object_id: objectId,
      target_group_id: targetGroupId,
    });
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

  /**
   * Gets removed (soft-deleted) files – object name, filename, and optional path for thumbnails.
   */
  getRemovedFiles(): Observable<{ object_name: string; filename: string; path?: string }[]> {
    const endpoint = 'files/removed';
    return this.#httpService.get<{ object_name: string; filename: string; path?: string }[]>(endpoint);
  }

  /**
   * Reorders files within a file group by setting sort_order based on the provided ID order.
   * @param groupId - The file group ID
   * @param fileIds - Ordered array of file IDs (position = sort priority)
   */
  reorderFiles(groupId: string, fileIds: string[]): Observable<{ message: string }> {
    const endpoint = `file/group/${groupId}/reorder`;
    return this.#httpService.put<{ message: string }>(endpoint, { file_ids: fileIds });
  }

  /**
   * Reorders file groups on an object by setting sort_order from the provided ID order.
   * @param objectId - The object ID
   * @param groupIds - Ordered array of file group IDs (position = sort priority)
   */
  reorderFileGroups(objectId: string, groupIds: string[]): Observable<{ message: string }> {
    const endpoint = `file/object/${objectId}/groups/reorder`;
    return this.#httpService.put<{ message: string }>(endpoint, { group_ids: groupIds });
  }
}
