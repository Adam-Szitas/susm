import { inject, Injectable } from '@angular/core';
import { HttpService } from './http.service';
import { Observable } from 'rxjs';
import { FileUploadTarget } from '../models/file.model';
import { NotificationService } from './notification.service';
import { HttpHeaders } from '@angular/common/http';

export interface FileUploadResult {
  path: string;
}

@Injectable({
  providedIn: 'root',
})
export class FileService {
  #httpService = inject(HttpService);
  #notificationService = inject(NotificationService);

  /**
   * Uploads a file for an object or project
   * @param fileData - FormData containing the file
   * @param target - 'object' or 'project'
   * @param id - The ID of the object or project
   * @returns Observable with the upload result
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
    // Pass empty HttpHeaders to prevent default 'application/json' header
    const headers = new HttpHeaders();
    return this.#httpService.post<string[]>(endpoint, fileData, headers);
  }

  /**
   * Uploads a file for an object
   */
  uploadFileForObject(fileData: FormData, objectId: string): Observable<string[]> {
    return this.uploadFile(fileData, 'object', objectId);
  }

  /**
   * Uploads a file for a project
   */
  uploadFileForProject(fileData: FormData, projectId: string): Observable<string[]> {
    return this.uploadFile(fileData, 'project', projectId);
  }

  /**
   * Gets all files for a specific object
   * @param objectId - The ID of the object
   * @returns Observable with array of files
   */
  getFilesForObject(objectId: string): Observable<any[]> {
    const endpoint = `file/object/${objectId}`;
    return this.#httpService.get<any[]>(endpoint);
  }

  /**
   * Gets all files for a specific project
   * @param projectId - The ID of the project
   * @returns Observable with array of files
   */
  getFilesForProject(projectId: string): Observable<any[]> {
    const endpoint = `file/project/${projectId}`;
    return this.#httpService.get<any[]>(endpoint);
  }
}
