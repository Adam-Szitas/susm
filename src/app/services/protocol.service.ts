import { inject, Injectable } from '@angular/core';
import { HttpService } from './http.service';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import {
  ProtocolTemplate,
  CreateProtocolTemplate,
  GenerateProtocolRequest,
} from '../models/protocol.model';
import { HttpClient, HttpHeaders, HttpResponse } from '@angular/common/http';
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

  updateTemplate(
    templateId: string,
    template: CreateProtocolTemplate,
  ): Observable<ProtocolTemplate> {
    return this.#httpService.put<ProtocolTemplate>(`protocols/templates/${templateId}`, template);
  }

  deleteTemplate(templateId: string): Observable<{ message: string }> {
    return this.#httpService.delete<{ message: string }>(`protocols/templates/${templateId}`);
  }

  generateProtocol(request: GenerateProtocolRequest): Observable<{ blob: Blob; filename: string }> {
    // For PDF download, we need to handle blob response and extract filename from header
    return this.#http.post<Blob>(`${this.apiUrl}/protocols/generate`, request, {
      headers: new HttpHeaders({ 'Content-Type': 'application/json' }),
      responseType: 'blob' as 'json',
      observe: 'response',
    }).pipe(
      map((response: HttpResponse<Blob>) => {
        
        let filename = `protocol_${Date.now()}.pdf`;
        const contentDisposition = response.headers.get('Content-Disposition');
        
        if (contentDisposition) {
          // Try multiple patterns to extract filename
          // Pattern 1: filename="value" or filename='value'
          let match = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
          if (match && match[1]) {
            filename = match[1].replace(/['"]/g, '').trim();
          } else {
            // Pattern 2: filename*=UTF-8''value or filename*=value
            match = contentDisposition.match(/filename\*=([^;]+)/);
            if (match && match[1]) {
              // Handle UTF-8 encoded filenames: UTF-8''filename or just filename
              filename = match[1].replace(/^UTF-8''/i, '').trim();
            } else {
              // Pattern 3: Just look for filename=value (without quotes)
              match = contentDisposition.match(/filename=([^;]+)/);
              if (match && match[1]) {
                filename = match[1].trim();
              }
            }
          }
        } else {
          console.warn('No Content-Disposition header found!');
        }
        return { blob: response.body!, filename };
      })
    );
  }

  /**
   * Downloads an already stored protocol instance by project/protocol id.
   * This does NOT create/save a new protocol in the backend.
   */
  downloadExistingProtocol(projectId: string, protocolId: string): Observable<void> {
    return new Observable((observer) => {
      this.#http
        .get(`${this.apiUrl}/protocols/${projectId}/${protocolId}`, {
          responseType: 'blob',
          observe: 'response',
        })
        .subscribe({
          next: (response: HttpResponse<Blob>) => {
            let filename = `protocol_${Date.now()}.pdf`;
            const contentDisposition = response.headers.get('Content-Disposition');
            
            if (contentDisposition) {
              // Try multiple patterns to extract filename
              // Pattern 1: filename="value" or filename='value'
              let match = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
              if (match && match[1]) {
                filename = match[1].replace(/['"]/g, '').trim();
              } else {
                // Pattern 2: filename*=UTF-8''value or filename*=value
                match = contentDisposition.match(/filename\*=([^;]+)/);
                if (match && match[1]) {
                  // Handle UTF-8 encoded filenames: UTF-8''filename or just filename
                  filename = match[1].replace(/^UTF-8''/i, '').trim();
                } else {
                  // Pattern 3: Just look for filename=value (without quotes)
                  match = contentDisposition.match(/filename=([^;]+)/);
                  if (match && match[1]) {
                    filename = match[1].trim();
                  }
                }
              }
            } else {
              console.warn('No Content-Disposition header found!');
            }
                        
            const url = window.URL.createObjectURL(response.body!);
            const link = document.createElement('a');
            link.href = url;
            link.download = filename;
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
        next: ({ blob, filename }) => {
          const url = window.URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = filename;
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

  deleteProtocol(projectId: string, protoclId: string): Observable<string> {
    return this.#http.delete<string>(`${this.apiUrl}/protocols/${projectId}/${protoclId}`);
  }

  previewProtocolStructure(request: GenerateProtocolRequest): Observable<any> {
    return this.#httpService.post<any>('protocols/preview', request);
  }
}
