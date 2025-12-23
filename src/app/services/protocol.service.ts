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

  updateTemplate(templateId: string, template: CreateProtocolTemplate): Observable<ProtocolTemplate> {
    return this.#httpService.put<ProtocolTemplate>(`protocols/templates/${templateId}`, template);
  }

  deleteTemplate(templateId: string): Observable<{ message: string }> {
    return this.#httpService.delete<{ message: string }>(`protocols/templates/${templateId}`);
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

  /**
   * Downloads an already stored protocol instance by project/protocol id.
   * This does NOT create/save a new protocol in the backend.
   */
  downloadExistingProtocol(
    projectId: string,
    protocolId: string
  ): Observable<void> {
    return new Observable((observer) => {
      this.#http
        .get(`${this.apiUrl}/protocols/${projectId}/${protocolId}`, {
          responseType: 'blob',
        })
        .subscribe({
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
            console.error('Failed to download protocol instance:', error);
            observer.error(error);
          },
        });
    });
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

  previewProtocolStructure(request: GenerateProtocolRequest): Observable<any> {
    return this.#httpService.post<any>('protocols/preview', request);
  }
}

