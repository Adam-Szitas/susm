import { effect, inject, Injectable, signal } from "@angular/core";
import { UserStore } from "./user.store";
import { HttpService } from "../services/http.service";
import { Observable } from "rxjs";


@Injectable({ providedIn: 'root' })
export class ProjectStore {

  #userState = inject(UserStore);
  #httpService = inject(HttpService);

  public projects = signal<Project[]>([]);

  constructor() {
    effect(() => {
      if(this.#userState.user()){
        this.loadProjects();
      }
    })
  }

  private loadProjects(): void {
    this.#httpService.get<Project[]>('projects').subscribe({
      next: (result) => this.projects.set(result)
    })
  }

  public createProject(project: Project): Observable<any> {
    return this.#httpService.post<Project>('projects', project);
  }
}

export interface Project {
  id: number;
  name: string;
  address?: string;
  createdAt: string;
  inserterId: number;
}
