import { inject, Injectable } from '@angular/core';
import { HttpService } from './http.service';
import { Observable } from 'rxjs';
import {
  ProtocolTemplate,
  CreateProtocolTemplate,
  GenerateProtocolRequest,
} from '../models/protocol.model';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { environment } from '../environment';

@Injectable({
  providedIn: 'root',
})
export class ProtocolService {
  #httpService = inject(HttpService);
  #http = inject(HttpClient);
  private readonly apiUrl: string;

  constructor() {
    this.apiUrl = environment.be;
  }

  getTemplates(): Observable<ProtocolTemplate[]> {
    return this.#httpService.get<ProtocolTemplate[]>('protocols/templates');
  }

  createTemplate(template: CreateProtocolTemplate): Observable<ProtocolTemplate> {
    return this.#httpService.post<ProtocolTemplate>('protocols/templates', template);
  }

  generateProtocol(request: GenerateProtocolRequest): Observable<Blob> {
    // For PDF download, we need to handle blob response
    // Note: We use HttpClient directly here to handle blob response type
    return this.#http.post<Blob>(
      `${this.apiUrl}/protocols/generate`,
      request,
      {
        headers: new HttpHeaders({ 'Content-Type': 'application/json' }),
        responseType: 'blob' as 'json',
      }
    );
  }

  downloadProtocol(request: GenerateProtocolRequest): Observable<void> {
    return new Observable((observer) => {
      this.generateProtocol(request).subscribe({
        next: (blob) => {
          const url = window.URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = `protocol_${Date.now()}.pdf`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          window.URL.revokeObjectURL(url);
          observer.next();
          observer.complete();
        },
        error: (error) => {
          console.error('Failed to generate protocol:', error);
          observer.error(error);
        },
      });
    });
  }
}

