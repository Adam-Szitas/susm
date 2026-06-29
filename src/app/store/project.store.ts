import { computed, inject, Injectable, signal } from '@angular/core';
import { HttpService } from '../services/http.service';
import { Observable, tap, throwError } from 'rxjs';
import type { AppError } from '../services/error-handler.service';
import {
  Project,
  Object,
  ObjectWithProject,
  ProjectFile,
  TodoItem,
  ObjectTodoEntry,
  normalizeTodoItemStatus,
  todoEntrySubItemId,
} from '../models';

@Injectable({ providedIn: 'root' })
export class ProjectStore {
  #httpService = inject(HttpService);

  private _projects = signal<Project[]>([]);
  private _project = signal<Project | null>(null);
  private _objects = signal<Object[]>([]);
  private _objectsWithProjects = signal<ObjectWithProject[]>([]);
  private _loading = signal(false);
  private _error = signal<string | null>(null);
  private _files = signal<ProjectFile[]>([]);
  #loadProjectRequestId = 0;
  #loadObjectsRequestId = 0;

  // Public readonly signals
  readonly projects = computed(() => this._projects());
  readonly project = computed(() => this._project());
  readonly objects = computed(() => this._objects());
  readonly objectsWithProjects = computed(() => this._objectsWithProjects());
  readonly loading = computed(() => this._loading());
  readonly error = computed(() => this._error());
  readonly files = computed(() => this._files());

  public setProject(project: Project): void {
    this._project.set(project);
  }

  /** Remove a protocol from the in-memory project after a successful delete (list + reload stay in sync). */
  removeProtocolInstance(protocolId: string): void {
    const project = this._project();
    if (!project?.protocols?.length) return;
    const next = project.protocols.filter((p) => p._id?.$oid !== protocolId);
    if (next.length === project.protocols.length) return;
    this._project.set({ ...project, protocols: next });
  }

  loadProject(id: string | null): Observable<Project> {
    if (!id) {
      const message = 'Project ID is required';
      this._error.set(message);
      return throwError(() => ({ message } satisfies AppError));
    }

    const requestId = ++this.#loadProjectRequestId;
    this._loading.set(true);
    this._error.set(null);

    this.#httpService.get<ProjectFile[]>(`file/project/${id}`).subscribe({
      next: (files) => {
        if (requestId !== this.#loadProjectRequestId) {
          return;
        }
        this._files.set(files);
      },
    });

    return this.#httpService.get<Project>(`project/${id}`).pipe(
      tap({
        next: (result) => {
          if (requestId !== this.#loadProjectRequestId) {
            return;
          }
          this._project.set(result);
          this.loadObjects(requestId);
        },
        error: (error: AppError) => {
          if (requestId !== this.#loadProjectRequestId) {
            return;
          }
          this._error.set(error.message || 'Failed to load project');
          this._loading.set(false);
        },
      }),
    );
  }

  loadProjects(): void {
    this._loading.set(true);
    this._error.set(null);

    this.#httpService.get<Project[]>('projects').subscribe({
      next: (result) => {
        this._projects.set(result);
        this._loading.set(false);
      },
      error: (error) => {
        this._error.set(error.message || 'Failed to load projects');
        this._loading.set(false);
      },
    });
  }

  createProject(project: Project): Observable<Project> {
    this._loading.set(true);
    this._error.set(null);

    return this.#httpService.post<Project>('projects', project).pipe(
      tap({
        next: () => {
          this.loadProjects();
          this._loading.set(false);
        },
        error: (error) => {
          this._error.set(error.message || 'Failed to create project');
          this._loading.set(false);
        },
      }),
    );
  }

  getObjectsByTerm(term: string): Observable<Object[]> {
    const projectId = this._project()?._id?.$oid;
    if (!projectId) {
      this._error.set('No project selected');
      return new Observable((observer) => {
        observer.error(new Error('No project selected'));
      });
    }

    const url = term ? `objects/${projectId}?search=${encodeURIComponent(term)}` : `objects/${projectId}`;
    return this.#httpService
      .get<Object[]>(url)
      .pipe(tap((objects) => this._objects.set(objects)));
  }

  createObject(object: Object & { projectId: string }): Observable<Object> {
    this._loading.set(true);
    this._error.set(null);

    return this.#httpService.post<Object>('object', object).pipe(
      tap({
        next: () => {
          this.getObjectsByTerm('').subscribe();
          this._loading.set(false);
        },
        error: (error) => {
          this._error.set(error.message || 'Failed to create object');
          this._loading.set(false);
        },
      }),
    );
  }

  createObjects(payload: {
    projectId: { $oid: string };
    objects: {
      address: { house_number: string; level?: string; door_number?: string };
      note: string;
      status: string;
      prefix?: string | null;
    }[];
  }): Observable<Object[]> {
    this._loading.set(true);
    this._error.set(null);

    return this.#httpService.post<Object[]>('objects/bulk', payload).pipe(
      tap({
        next: () => {
          this.getObjectsByTerm('').subscribe();
          this._loading.set(false);
        },
        error: (error) => {
          this._error.set(error.message || 'Failed to create objects');
          this._loading.set(false);
        },
      }),
    );
  }

  loadObjects(projectRequestId?: number): void {
    const projectId = this._project()?._id?.$oid;
    if (!projectId) {
      this._error.set('No project selected');
      return;
    }

    const requestId = ++this.#loadObjectsRequestId;
    this._loading.set(true);
    this._error.set(null);

    this.#httpService.get<Object[]>(`objects/${projectId}`).subscribe({
      next: (result) => {
        if (projectRequestId != null && projectRequestId !== this.#loadProjectRequestId) {
          return;
        }
        if (requestId !== this.#loadObjectsRequestId) {
          return;
        }
        this._objects.set(result);
        this._loading.set(false);
      },
      error: (error) => {
        if (projectRequestId != null && projectRequestId !== this.#loadProjectRequestId) {
          return;
        }
        if (requestId !== this.#loadObjectsRequestId) {
          return;
        }
        this._error.set(error.message || 'Failed to load objects');
        this._loading.set(false);
      },
    });
  }

  /** Persist object display/protocol order for a project. */
  reorderObjects(projectId: string, objectIds: string[]): Observable<{ message: string }> {
    return this.#httpService
      .put<{ message: string }>(`project/${projectId}/objects/reorder`, { object_ids: objectIds })
      .pipe(
        tap(() => {
          this.loadObjects();
        }),
      );
  }

  loadAllObjects(): void {
    this._loading.set(true);
    this._error.set(null);
    this.#httpService.get<ObjectWithProject[] | any>(`objects`).subscribe({
      next: (result) => {
        this._objectsWithProjects.set(result);
        this._loading.set(false);
      },
      error: (error) => {
        this._error.set(error.message || 'Failed to load objects');
        this._loading.set(false);
      },
    });
  }

  loadObject(objectId: string): Observable<Object> {
    return this.#httpService.get<Object>(`object/${objectId}`);
  }

  updateProjectTodoItems(
    projectId: string,
    todoItems: {
      id?: string | null;
      title: string;
      note?: string | null;
      sub_items?: {
        id?: string | null;
        title: string;
        color: string;
      }[];
    }[],
  ): Observable<Project> {
    const payload = {
      todo_items: todoItems.map((item) => ({
        id: item.id ? String(item.id) : undefined,
        title: item.title,
        note: item.note ?? null,
        sub_items: (item.sub_items ?? []).map((sub) => ({
          id: sub.id ? String(sub.id) : undefined,
          title: sub.title,
          color: sub.color,
        })),
      })),
    };
    return this.#httpService.put<Project>(`project/${projectId}/todo-items`, payload).pipe(
      tap((project) => {
        this._project.set(project);
        this.loadObjects();
        const projects = this._projects();
        const index = projects.findIndex((p) => p._id?.$oid === projectId);
        if (index !== -1) {
          projects[index] = project;
          this._projects.set([...projects]);
        }
      }),
    );
  }

  updateObjectTodos(objectId: string, todoEntries: ObjectTodoEntry[]): Observable<Object> {
    const payload = {
      todo_entries: todoEntries.map((entry) => ({
        todo_item_id:
          typeof entry.todo_item_id === 'string'
            ? entry.todo_item_id
            : entry.todo_item_id.$oid,
        todo_sub_item_id: todoEntrySubItemId(entry) ?? undefined,
        status: normalizeTodoItemStatus(entry.status),
      })),
    };
    return this.#httpService.put<Object>(`object/${objectId}/todos`, payload).pipe(
      tap((updatedObject) => {
        const project = this._project();
        if (project?.objects) {
          const index = project.objects.findIndex((o) => o._id?.$oid === objectId);
          if (index !== -1) {
            project.objects[index] = updatedObject;
            this._project.set({ ...project });
          }
        }
        const objects = this._objects();
        const objIndex = objects.findIndex((o) => o._id?.$oid === objectId);
        if (objIndex !== -1) {
          objects[objIndex] = updatedObject;
          this._objects.set([...objects]);
        }
      }),
    );
  }

  updateProjectCategories(projectId: string, categories: string[]): Observable<Project> {
    return this.#httpService.put<Project>(`project/${projectId}/categories`, { categories }).pipe(
      tap((project) => {
        this._project.set(project);
        this.loadObjects();
        const projects = this._projects();
        const index = projects.findIndex((p) => p._id?.$oid === projectId);
        if (index !== -1) {
          projects[index] = project;
          this._projects.set([...projects]);
        }
      }),
    );
  }

  updateProjectCategory(projectId: string, category: string | null): Observable<Project> {
    return this.#httpService.put<Project>(`project/${projectId}/category`, { category }).pipe(
      tap((updatedProject) => {
        this._project.set(updatedProject);
        const projects = this._projects();
        const index = projects.findIndex((p) => p._id?.$oid === projectId);
        if (index !== -1) {
          projects[index] = updatedProject;
          this._projects.set([...projects]);
        }
      }),
    );
  }

  updateObjectCategory(objectId: string, category: string | null): Observable<Object> {
    return this.#httpService.put<Object>(`object/${objectId}/category`, { category }).pipe(
      tap((updatedObject) => {
        const project = this._project();
        if (project?.objects) {
          const index = project.objects.findIndex((o) => o._id?.$oid === objectId);
          if (index !== -1) {
            project.objects[index] = updatedObject;
            this._project.set({ ...project });
          }
        }
        const objects = this._objects();
        const objIndex = objects.findIndex((o) => o._id?.$oid === objectId);
        if (objIndex !== -1) {
          objects[objIndex] = updatedObject;
          this._objects.set([...objects]);
        }
      }),
    );
  }

  updateObjectStatus(objectId: string, status: string): Observable<Object> {
    return this.#httpService.put<Object>(`object/${objectId}/status`, { status }).pipe(
      tap((updatedObject) => {
        // Update object in current project if loaded
        const project = this._project();
        if (project?.objects) {
          const index = project.objects.findIndex((o) => o._id?.$oid === objectId);
          if (index !== -1) {
            project.objects[index] = updatedObject;
            this._project.set({ ...project });
          }
        }
        // Update objects list
        const objects = this._objects();
        const objIndex = objects.findIndex((o) => o._id?.$oid === objectId);
        if (objIndex !== -1) {
          objects[objIndex] = updatedObject;
          this._objects.set([...objects]);
        }
        // Update objectsWithProjects if needed
        const objectsWithProjects = this._objectsWithProjects();
        const objWithProjectIndex = objectsWithProjects.findIndex(
          (item) => item.object._id?.$oid === objectId,
        );
        if (objWithProjectIndex !== -1) {
          objectsWithProjects[objWithProjectIndex].object = updatedObject;
          this._objectsWithProjects.set([...objectsWithProjects]);
        }
      }),
    );
  }

  public toggleArchiveProject(projectId: string, archive: boolean, archive_comment?: string): Observable<Project> {
    return this.#httpService.put<Project>(`project/${projectId}/archive`, { archive, archive_comment }).pipe(
      tap({
        next: (result) => {
          this._project.set(result);
        },
        error: (error) => {
          this._error.set(error.message || 'Failed to archive project');
        },
      }),
    );
  }

  /** Soft-delete project (sets deleted_at). Project will no longer appear in list. */
  public deleteProject(projectId: string): Observable<{ message: string }> {
    return this.#httpService.put<{ message: string }>(`project/${projectId}/delete`, {}).pipe(
      tap({
        next: () => {
          this._project.set(null);
          this.loadProjects();
        },
        error: (error) => {
          this._error.set(error.message || 'Failed to delete project');
        },
      }),
    );
  }

  deleteObject(objectId: string): Observable<{ message: string }> {
    return this.#httpService.delete<{ message: string }>(`object/${objectId}`).pipe(
      tap({
        next: () => {
          const objects = this._objects();
          this._objects.set(objects.filter((o) => o._id?.$oid !== objectId));

          const objectsWithProjects = this._objectsWithProjects();
          this._objectsWithProjects.set(
            objectsWithProjects.filter((item) => item.object._id?.$oid !== objectId),
          );

          const project = this._project();
          if (project?.objects) {
            project.objects = project.objects.filter((o) => o._id?.$oid !== objectId);
            this._project.set({ ...project });
          }
        },
        error: (error) => {
          this._error.set(error.message || 'Failed to delete object');
        },
      }),
    );
  }

  clearError(): void {
    this._error.set(null);
  }

  /** Drop cached project/object/file state (call on logout). */
  reset(): void {
    this.#loadProjectRequestId = 0;
    this.#loadObjectsRequestId = 0;
    this._projects.set([]);
    this._project.set(null);
    this._objects.set([]);
    this._objectsWithProjects.set([]);
    this._files.set([]);
    this._loading.set(false);
    this._error.set(null);
  }
}
