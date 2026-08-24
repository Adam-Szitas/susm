import { inject, Injectable } from '@angular/core';
import { HttpService } from './http.service';
import { Observable, defer, from, throwError, timer } from 'rxjs';
import { catchError, concatMap, map, toArray } from 'rxjs/operators';
import { FileUploadTarget, FileGroup, ProjectFile } from '../models/file.model';
import { NotificationService } from './notification.service';
import { ErrorHandlerService } from './error-handler.service';
import { HttpHeaders } from '@angular/common/http';
import type { AppError } from './error-handler.service';
import {
  isRetryableUploadError,
  UPLOAD_MAX_ATTEMPTS,
  uploadRetryDelayMs,
} from '../utils/upload-retry';

export interface FileWithContext {
  file: {
    _id: { $oid: string };
    path: string;
    filename: string;
    description?: string;
    category?: string;
    created_at: string;
  };
  project: {
    id: string;
    name: string;
  } | null;
  object: {
    id: string;
    street?: string;
    description?: string;
    house_number?: string;
  } | null;
}

export interface PaginatedPicturesResponse {
  items: FileWithContext[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
  projects: { id: string; name: string }[];
  categories: string[];
}

export interface FileUploadMetadata {
  description?: string;
  note?: string;
  categories?: string[];
  groupId?: string;
}

@Injectable({
  providedIn: 'root',
})
export class FileService {
  #httpService = inject(HttpService);
  #notificationService = inject(NotificationService);
  #errorHandler = inject(ErrorHandlerService);

  /**
   * Uploads files for an object or project.
   * Project files and appends to an existing group are sent one file per request (smaller payloads, retries).
   * New object groups keep a single multipart request so all photos land in one group.
   */
  uploadFile(
    fileData: FormData,
    target: FileUploadTarget = 'object',
    id?: string,
    options?: { files?: globalThis.File[]; metadata?: FileUploadMetadata },
  ): Observable<string[]> {
    if (!id) {
      const errorMsg =
        target === 'project'
          ? 'Project ID is required for project file upload'
          : 'Object ID is required for object file upload';
      this.#notificationService.showError(errorMsg);
      return throwError(() => new Error(errorMsg));
    }

    const endpoint = `file/${target}/${id}`;
    const files = options?.files;
    const metadata = options?.metadata;
    const groupId = metadata?.groupId ?? fileData.get('group_id')?.toString();

    if (files?.length && (target === 'project' || groupId)) {
      return this.#uploadFilesSequentially(endpoint, files, metadata ?? {});
    }

    return this.#uploadWithRetry(() =>
      this.#httpService.post<string[]>(endpoint, fileData, new HttpHeaders(), {
        suppressErrorNotification: true,
      }),
    );
  }

  uploadFileForObject(
    fileData: FormData,
    objectId: string,
    options?: { groupId?: string; files?: globalThis.File[]; metadata?: FileUploadMetadata },
  ): Observable<string[]> {
    const metadata: FileUploadMetadata = {
      ...(options?.metadata ?? {}),
      groupId: options?.groupId,
    };
    if (options?.groupId) {
      fileData.append('group_id', options.groupId);
    }
    return this.uploadFile(fileData, 'object', objectId, {
      files: options?.files,
      metadata,
    });
  }

  uploadFileForProject(
    fileData: FormData,
    projectId: string,
    files?: globalThis.File[],
    metadata?: FileUploadMetadata,
  ): Observable<string[]> {
    return this.uploadFile(fileData, 'project', projectId, { files, metadata });
  }

  #uploadFilesSequentially(
    endpoint: string,
    files: globalThis.File[],
    metadata: FileUploadMetadata,
  ): Observable<string[]> {
    return from(files).pipe(
      concatMap((file) => {
        const form = this.#buildSingleFileForm(file, metadata);
        return this.#uploadWithRetry(() =>
          this.#httpService.post<string[]>(endpoint, form, new HttpHeaders(), {
            suppressErrorNotification: true,
          }),
        );
      }),
      toArray(),
      map((batches) => batches.flat()),
    );
  }

  #buildSingleFileForm(file: globalThis.File, metadata: FileUploadMetadata): FormData {
    const form = new FormData();
    form.append('avatar', file, file.name);
    if (metadata.description) {
      form.append('description', metadata.description);
    }
    if (metadata.note) {
      form.append('note', metadata.note);
    }
    if (metadata.categories?.length) {
      const unique = [...new Set(metadata.categories.map((c) => c.trim()).filter(Boolean))];
      if (unique.length > 0) {
        form.append('categories', JSON.stringify(unique));
      }
    }
    if (metadata.groupId) {
      form.append('group_id', metadata.groupId);
    }
    return form;
  }

  #uploadWithRetry<T>(request: () => Observable<T>): Observable<T> {
    let attempt = 0;
    const run = (): Observable<T> =>
      defer(request).pipe(
        catchError((error) => {
          attempt += 1;
          if (attempt < UPLOAD_MAX_ATTEMPTS && isRetryableUploadError(error)) {
            return timer(uploadRetryDelayMs(attempt - 1)).pipe(concatMap(() => run()));
          }
          return throwError(() => error);
        }),
      );

    return run().pipe(
      catchError((error) => {
        this.#errorHandler.handleHttpError(error, { notify: true });
        return throwError(() => error as AppError);
      }),
    );
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
    targetGroupId: string,
    targetSubGroupId?: string | null,
  ): Observable<{ message: string }> {
    const endpoint = `file/${fileId}/move`;
    return this.#httpService.post<{ message: string }>(endpoint, {
      target_group_id: targetGroupId,
      ...(targetSubGroupId ? { target_sub_group_id: targetSubGroupId } : {}),
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
    data: { description?: string; note?: string | null; filename?: string; created_at?: string }
  ): Observable<{ message: string }> {
    const endpoint = `file/${fileId}`;
    return this.#httpService.put<{ message: string }>(endpoint, data);
  }

  /**
   * Paginated picture listing with project/object context (images only).
   */
  getPicturesPage(query: {
    page: number;
    limit?: number;
    search?: string;
    category?: string;
    project_id?: string;
    date_from?: string;
    date_to?: string;
  }): Observable<PaginatedPicturesResponse> {
    return this.#httpService.get<PaginatedPicturesResponse>('files', {
      page: query.page,
      limit: query.limit ?? 50,
      search: query.search,
      category: query.category,
      project_id: query.project_id,
      date_from: query.date_from,
      date_to: query.date_to,
    });
  }

  /**
   * @deprecated Use {@link getPicturesPage} — returns paginated pictures from the server.
   */
  getAllFilesWithContext(): Observable<PaginatedPicturesResponse> {
    return this.getPicturesPage({ page: 1, limit: 50 });
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

  createSubGroupWithUpload(
    groupId: string,
    files: globalThis.File[],
    metadata: { name: string; categories?: string[]; note?: string },
  ): Observable<unknown> {
    const form = new FormData();
    form.append('name', metadata.name.trim());
    if (metadata.note?.trim()) {
      form.append('note', metadata.note.trim());
    }
    if (metadata.categories?.length) {
      const unique = [...new Set(metadata.categories.map((c) => c.trim()).filter(Boolean))];
      if (unique.length) {
        form.append('categories', JSON.stringify(unique));
      }
    }
    for (const file of files) {
      form.append('avatar', file, file.name);
    }
    return this.#uploadWithRetry(() =>
      this.#httpService.post(`file/group/${groupId}/sub-groups`, form, new HttpHeaders(), {
        suppressErrorNotification: true,
      }),
    );
  }

  addFilesToSubGroup(subGroupId: string, files: globalThis.File[]): Observable<string[]> {
    return from(files).pipe(
      concatMap((file) => {
        const form = new FormData();
        form.append('avatar', file, file.name);
        return this.#uploadWithRetry(() =>
          this.#httpService.post<string[]>(`file/sub-group/${subGroupId}/files`, form, new HttpHeaders(), {
            suppressErrorNotification: true,
          }),
        );
      }),
      toArray(),
      map((batches) => batches.flat()),
    );
  }

  updateSubGroup(
    subGroupId: string,
    data: { name?: string; categories?: string[]; note?: string | null },
  ): Observable<{ message: string }> {
    return this.#httpService.put<{ message: string }>(`file/sub-group/${subGroupId}`, data);
  }

  deleteSubGroup(
    subGroupId: string,
    mode: 'delete_all' | 'unwrap',
  ): Observable<{ message: string }> {
    return this.#httpService.delete<{ message: string }>(
      `file/sub-group/${subGroupId}?mode=${mode}`,
    );
  }

  reorderSubGroups(groupId: string, subGroupIds: string[]): Observable<{ message: string }> {
    return this.#httpService.put<{ message: string }>(`file/group/${groupId}/sub-groups/reorder`, {
      sub_group_ids: subGroupIds,
    });
  }

  reorderSubGroupFiles(subGroupId: string, fileIds: string[]): Observable<{ message: string }> {
    return this.#httpService.put<{ message: string }>(`file/sub-group/${subGroupId}/reorder`, {
      file_ids: fileIds,
    });
  }
}
