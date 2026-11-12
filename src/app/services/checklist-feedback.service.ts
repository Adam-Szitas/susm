import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { catchError, map, Observable, of, tap, throwError } from 'rxjs';
import {
  ChecklistFeedbackAcceptResult,
  ChecklistFeedbackShare,
  ChecklistFeedbackSubmission,
  PublicFeedbackChange,
  PublicFeedbackGate,
  PublicFeedbackGone,
  PublicFeedbackSession,
  PublicFeedbackView,
} from '@models';
import { environment } from '../environment';
import { HttpService } from './http.service';

export const CHECKLIST_FEEDBACK_SESSION_HEADER = 'x-checklist-feedback-session';

/** Result of a public call: either data, or the share is locked (410: expired/revoked). */
export type PublicFeedbackResult<T> =
  | { kind: 'ok'; data: T }
  | { kind: 'gone'; gone: PublicFeedbackGone }
  | { kind: 'error'; status: number; message: string };

/**
 * Checklist feedback share API. No email is ever sent from SUSM: the app returns copyable
 * URLs and the user distributes them. Pending submissions double as the creator's
 * persistent notification inbox (only the share creator can list them).
 */
@Injectable({ providedIn: 'root' })
export class ChecklistFeedbackService {
  #http = inject(HttpService);
  #raw = inject(HttpClient);

  readonly #pending = signal<ChecklistFeedbackSubmission[]>([]);
  readonly pendingSubmissions = this.#pending.asReadonly();
  readonly pendingCount = computed(() => this.#pending().length);

  // -- Authenticated -------------------------------------------------------

  createShares(
    projectId: string,
    todoItemIds: string[],
    count = 1,
    label?: string,
  ): Observable<ChecklistFeedbackShare[]> {
    return this.#http.post<ChecklistFeedbackShare[]>(
      `project/${projectId}/checklist-feedback/shares`,
      { todo_item_ids: todoItemIds, count, label: label?.trim() || null },
    );
  }

  listShares(projectId: string): Observable<ChecklistFeedbackShare[]> {
    return this.#http.get<ChecklistFeedbackShare[]>(`project/${projectId}/checklist-feedback/shares`);
  }

  revokeShare(projectId: string, shareId: string): Observable<unknown> {
    return this.#http.post(`project/${projectId}/checklist-feedback/shares/${shareId}/revoke`, {});
  }

  listSubmissions(
    status: 'pending' | 'accepted' | 'rejected' | 'all' = 'pending',
  ): Observable<ChecklistFeedbackSubmission[]> {
    return this.#http.get<ChecklistFeedbackSubmission[]>('checklist-feedback/submissions', { status });
  }

  /** Refreshes the creator-only pending inbox (badge). Errors are swallowed: badge is optional. */
  refreshPending(): void {
    this.#raw
      .get<ChecklistFeedbackSubmission[]>(`${environment.be}/checklist-feedback/submissions`, {
        params: { status: 'pending' },
      })
      .pipe(catchError(() => of(null)))
      .subscribe((list) => {
        if (list) this.#pending.set(list);
      });
  }

  clearPending(): void {
    this.#pending.set([]);
  }

  accept(submissionId: string): Observable<ChecklistFeedbackAcceptResult> {
    return this.#http
      .post<ChecklistFeedbackAcceptResult>(`checklist-feedback/submissions/${submissionId}/accept`, {})
      .pipe(tap(() => this.#dropPending(submissionId)));
  }

  reject(submissionId: string): Observable<unknown> {
    return this.#http
      .post(`checklist-feedback/submissions/${submissionId}/reject`, {})
      .pipe(tap(() => this.#dropPending(submissionId)));
  }

  #dropPending(id: string): void {
    this.#pending.update((list) => list.filter((item) => item.id !== id));
  }

  // -- Public (no JWT; token in path, claimed-email session header) ----------

  publicGate(token: string): Observable<PublicFeedbackResult<PublicFeedbackGate>> {
    return this.#public(this.#raw.get<PublicFeedbackGate>(this.#publicUrl(token)));
  }

  publicSession(token: string, email: string): Observable<PublicFeedbackResult<PublicFeedbackSession>> {
    return this.#public(
      this.#raw.post<PublicFeedbackSession>(`${this.#publicUrl(token)}/session`, { email }),
    );
  }

  publicView(token: string, session: string): Observable<PublicFeedbackResult<PublicFeedbackView>> {
    return this.#public(
      this.#raw.get<PublicFeedbackView>(`${this.#publicUrl(token)}/view`, {
        headers: this.#sessionHeaders(session),
      }),
    );
  }

  publicSubmit(
    token: string,
    session: string,
    changes: PublicFeedbackChange[],
  ): Observable<PublicFeedbackResult<{ id: string; status: 'pending'; change_count: number }>> {
    return this.#public(
      this.#raw.post<{ id: string; status: 'pending'; change_count: number }>(
        `${this.#publicUrl(token)}/submit`,
        { changes },
        { headers: this.#sessionHeaders(session) },
      ),
    );
  }

  #publicUrl(token: string): string {
    return `${environment.be}/public/checklist-feedback/${encodeURIComponent(token)}`;
  }

  #sessionHeaders(session: string): HttpHeaders {
    return new HttpHeaders({ [CHECKLIST_FEEDBACK_SESSION_HEADER]: session });
  }

  #public<T>(request: Observable<T>): Observable<PublicFeedbackResult<T>> {
    return request.pipe(
      map((data): PublicFeedbackResult<T> => ({ kind: 'ok', data })),
      catchError((error: unknown) => {
        if (!(error instanceof HttpErrorResponse)) return throwError(() => error);
        if (error.status === 410 && error.error && typeof error.error === 'object') {
          return of<PublicFeedbackResult<T>>({ kind: 'gone', gone: error.error as PublicFeedbackGone });
        }
        const body = error.error as { error?: string } | string | null;
        const message = typeof body === 'string' ? body : (body?.error ?? error.message);
        return of<PublicFeedbackResult<T>>({ kind: 'error', status: error.status, message });
      }),
    );
  }
}
