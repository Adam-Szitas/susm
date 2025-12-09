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

  previewTemplate(template: CreateProtocolTemplate, sampleData?: any): Observable<Blob> {
    const request = {
      template,
      sample_data: sampleData || null,
    };
    return this.#http.post<Blob>(`${this.apiUrl}/protocols/preview`, request, {
      headers: new HttpHeaders({ 'Content-Type': 'application/json' }),
      responseType: 'blob' as 'json',
    });
  }

  openPreview(template: CreateProtocolTemplate, sampleData?: any): Observable<void> {
    return new Observable((observer) => {
      this.previewTemplate(template, sampleData).subscribe({
        next: (blob) => {
          const url = window.URL.createObjectURL(blob);
          window.open(url, '_blank');
          // Clean up after a delay to allow the browser to load the PDF
          setTimeout(() => {
            window.URL.revokeObjectURL(url);
          }, 1000);
          observer.next();
          observer.complete();
        },
        error: (error) => {
          console.error('Failed to preview protocol:', error);
          observer.error(error);
        },
      });
    });
  }
}

