import { inject, Injectable } from '@angular/core';
import { HttpService } from './http.service';
import { Observable, throwError, timer, EmptyError } from 'rxjs';
import { catchError, exhaustMap, first, map, switchMap, take } from 'rxjs/operators';
import {
  ProtocolTemplate,
  CreateProtocolTemplate,
  GenerateProtocolRequest,
} from '../models/protocol.model';
import { HttpClient, HttpErrorResponse, HttpHeaders, HttpResponse } from '@angular/common/http';
import { environment } from '../environment';

interface ProtocolGenerateJob {
  job_id: string;
  status: 'queued' | 'running' | 'ready' | 'failed';
  filename?: string;
  error?: string;
}

const GENERATE_POLL_MS = 1000;
const GENERATE_POLL_MAX = 600;

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
    return this.#http
      .post<ProtocolGenerateJob>(`${this.apiUrl}/protocols/generate`, request, {
        headers: new HttpHeaders({ 'Content-Type': 'application/json' }),
      })
      .pipe(
        catchError((error: unknown) => throwError(() => this.#jobHttpError(error))),
        switchMap((job) => this.#pollJobUntilReady(job.job_id)),
        switchMap((job) => this.#downloadJobPdf(job.job_id, job.filename)),
      );
  }

  #pollJobUntilReady(jobId: string): Observable<ProtocolGenerateJob> {
    return timer(0, GENERATE_POLL_MS).pipe(
      take(GENERATE_POLL_MAX),
      exhaustMap(() =>
        this.#http.get<ProtocolGenerateJob>(`${this.apiUrl}/protocols/jobs/${jobId}`).pipe(
          catchError((error: unknown) => throwError(() => this.#jobHttpError(error))),
        ),
      ),
      map((job) => {
        if (job.status === 'failed') {
          throw new Error(job.error || 'Failed to generate protocol');
        }
        return job;
      }),
      first((job) => job.status === 'ready'),
      catchError((error: unknown) => {
        if (error instanceof EmptyError) {
          return throwError(() => new Error('PDF generation took too long. Please try again.'));
        }
        return throwError(() => error);
      }),
    );
  }

  #downloadJobPdf(
    jobId: string,
    fallbackFilename?: string,
  ): Observable<{ blob: Blob; filename: string }> {
    return this.#http
      .get(`${this.apiUrl}/protocols/jobs/${jobId}/download`, {
        responseType: 'blob',
        observe: 'response',
      })
      .pipe(
        map((response: HttpResponse<Blob>) => ({
          blob: response.body!,
          filename:
            this.#filenameFromContentDisposition(response.headers.get('Content-Disposition'))
            || fallbackFilename
            || `protocol_${Date.now()}.pdf`,
        })),
        catchError((error: unknown) => throwError(() => this.#jobHttpError(error))),
      );
  }

  #filenameFromContentDisposition(header: string | null): string | null {
    if (!header) {
      return null;
    }
    let match = header.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
    if (match?.[1]) {
      return match[1].replace(/['"]/g, '').trim();
    }
    match = header.match(/filename\*=([^;]+)/);
    if (match?.[1]) {
      return match[1].replace(/^UTF-8''/i, '').trim();
    }
    match = header.match(/filename=([^;]+)/);
    return match?.[1]?.trim() ?? null;
  }

  #jobHttpError(error: unknown): Error {
    if (error instanceof HttpErrorResponse) {
      if (error.status === 429) {
        return new Error(
          typeof error.error === 'string' && error.error.trim()
            ? error.error
            : 'A protocol is already generating. Wait for it to finish.',
        );
      }
      if (typeof error.error === 'string' && error.error.trim()) {
        return new Error(error.error);
      }
      if (error.error && typeof error.error === 'object' && 'message' in error.error) {
        const message = (error.error as { message?: string }).message;
        if (message) {
          return new Error(message);
        }
      }
      return new Error(error.message || 'Failed to generate protocol');
    }
    if (error instanceof Error) {
      return error;
    }
    return new Error('Failed to generate protocol');
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

  deleteProtocol(projectId: string, protocolId: string): Observable<{ message: string }> {
    return this.#httpService.delete<{ message: string }>(`protocols/${projectId}/${protocolId}`);
  }

  /** Attach a user-selected PDF as a protocol on the project (multipart). */
  uploadProtocolPdf(projectId: string, file: File): Observable<{ message: string }> {
    const form = new FormData();
    form.append('file', file, file.name);
    const headers = new HttpHeaders();
    return this.#httpService.post<{ message: string }>(`protocols/upload/${projectId}`, form, headers);
  }

  previewProtocolStructure(request: GenerateProtocolRequest): Observable<any> {
    return this.#httpService.post<any>('protocols/preview', request);
  }
}
