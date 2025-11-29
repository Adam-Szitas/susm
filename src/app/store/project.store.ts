import { computed, inject, Injectable, signal } from '@angular/core';
import { HttpService } from '../services/http.service';
import { Observable, tap } from 'rxjs';
import { Project, Object, ObjectWithProject, File } from '../models';

@Injectable({ providedIn: 'root' })
export class ProjectStore {
  #httpService = inject(HttpService);

  private _projects = signal<Project[]>([]);
  private _project = signal<Project | null>(null);
  private _objects = signal<Object[]>([]);
  private _objectsWithProjects = signal<ObjectWithProject[]>([]);
  private _loading = signal(false);
  private _error = signal<string | null>(null);
  private _files = signal<File[]>([]);

  // Public readonly signals
  readonly projects = computed(() => this._projects());
  readonly project = computed(() => this._project());
  readonly objects = computed(() => this._objects());
  readonly objectsWithProjects = computed(() => this._objectsWithProjects());
  readonly loading = computed(() => this._loading());
  readonly error = computed(() => this._error());
  readonly files = computed(() => this._files());

  loadProject(id: string | null): void {
    if (!id) {
      this._error.set('Project ID is required');
      return;
    }

    this._loading.set(true);
    this._error.set(null);

    this.#httpService.get<Project>(`project/${id}`).subscribe({
      next: (result) => {
        this._project.set(result);
        this.loadObjects();
        this._loading.set(false);
      },
      error: (error) => {
        this._error.set(error.message || 'Failed to load project');
        this._loading.set(false);
      },
    });

    this.#httpService.get<File[]>(`file/project/${id}`).subscribe({
      next: (files) => {
        const mappedFiles = files.map((file) => ({
          ...file,
          path: file.path,
          filename: file.path.split(/[\\/]/).pop() || '',
        }));
        this._files.set(mappedFiles);
      },
    });
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

    return this.#httpService
      .get<Object[]>(`objects/${projectId}&${term}`)
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

  loadObjects(): void {
    const projectId = this._project()?._id?.$oid;
    if (!projectId) {
      this._error.set('No project selected');
      return;
    }

    this._loading.set(true);
    this._error.set(null);

    this.#httpService.get<Object[]>(`objects/${projectId}`).subscribe({
      next: (result) => {
        this._objects.set(result);
        this._loading.set(false);
      },
      error: (error) => {
        this._error.set(error.message || 'Failed to load objects');
        this._loading.set(false);
      },
    });
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

  public toggleArchiveProject(projectId: string, archive: boolean): void {
    this.#httpService.put<Project>(`project/${projectId}/archive`, { archive }).subscribe({
      next: (result) => {
        this._project.set(result);
      },
      error: (error) => {
        this._error.set(error.message || 'Failed to archive project');
      },
    });
  }

  clearError(): void {
    this._error.set(null);
  }
}
