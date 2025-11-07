import { inject, Injectable, signal } from '@angular/core';
import { HttpService } from '../services/http.service';
import { Observable, tap } from 'rxjs';
import { Address } from '../models/user.model';
import { Object } from '../components/object/object.component';

@Injectable({ providedIn: 'root' })
export class ProjectStore {
  #httpService = inject(HttpService);

  private _projects = signal<Project[]>([]);
  private _project = signal<Project | null>(null);
  private _objects = signal<Object[]>([]);

  public readonly projects = this._projects;
  public readonly project = this._project;
  public readonly objects = this._objects;

  public loadProject(id: string | null): void {
    this.#httpService
      .get<Project>(`project/${id}`)
      .pipe()
      .subscribe({
        next: (result) => {
          this._project.set(result);
          this.loadObjects();
        },
      });
  }

  public loadProjects(): void {
    this.#httpService.get<Project[]>('projects').subscribe({
      next: (result) => this._projects.set(result),
    });
  }

  public createProject(project: Project): Observable<any> {
    return this.#httpService.post('projects', project).pipe(tap(() => this.loadProjects()));
  }

  public getObjectsByTerm(term: string): Observable<Object[]> {
    return this.#httpService
      .get<Object[]>(`objects/${this.project()?._id}&${term}`)
      .pipe(tap((objects) => this._objects.set(objects)));
  }

  public createObject(object: Object & { projectId: string }): Observable<any> {
    return this.#httpService.post('object', object).pipe(tap(() => this.getObjectsByTerm('')));
  }

  public loadObjects(): void {
    this.#httpService.get<Object[]>(`objects/${this.project()?._id?.$oid}`).subscribe({
      next: (result) => {
        this._objects.set(result);
      },
    });
  }

  public loadObject(objectId: string): Observable<Object> {
    return this.#httpService.get<Object>(`object/${objectId}`);
  }
}

export interface Project {
  _id?: {
    $oid: string;
  };
  name: string;
  address?: Address;
  createdAt?: string;
  inserterId?: number;
}
