import { inject, Injectable } from '@angular/core';
import { HttpService } from './http.service';
import { Router } from '@angular/router';

@Injectable({
  providedIn: 'root',
})
export class FileService {
  #httpService = inject(HttpService);
  #router = inject(Router);

  uploadFile(fileData: FormData, belongsTo: 'object' | 'project' = 'object') {
    if (belongsTo === 'project') {
      return this.#httpService.post('/file', fileData);
    } else {
      return this.#httpService.post('file?object_id=69090abd39c5a205bae2da86', fileData);
    }
  }
}
