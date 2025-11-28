import { inject, Injectable } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { NotificationService } from './notification.service';

export interface AppError {
  status?: number;
  message: string;
  originalError?: unknown;
}

@Injectable({
  providedIn: 'root',
})
export class ErrorHandlerService {
  #notificationService = inject(NotificationService);

  /**
   * Handles HTTP errors and displays appropriate notifications
   */
  handleHttpError(error: unknown): AppError {
    if (error instanceof HttpErrorResponse) {
      return this.handleHttpErrorResponse(error);
    }

    if (error && typeof error === 'object' && 'message' in error) {
      const appError = error as AppError;
      this.#notificationService.showError(appError.message);
      return appError;
    }

    const message = 'An unexpected error occurred';
    this.#notificationService.showError(message);
    return { message, originalError: error };
  }

  private handleHttpErrorResponse(error: HttpErrorResponse): AppError {
    let message = 'An unknown error occurred';

    if (error.error instanceof Error) {
      // Client-side error (e.g., network failure)
      message = `Network error: ${error.error.message}`;
    } else if (error.error && typeof error.error === 'object') {
      // Server-side error with error object
      message = error.error.error || error.error.message || this.getDefaultMessage(error.status);
    } else {
      message = this.getDefaultMessage(error.status);
    }

    // Log for debugging
    console.error('HTTP Error:', {
      status: error.status,
      message,
      error: error.error,
      url: error.url,
    });

    // Show notification based on error type
    if (error.status === 401) {
      this.#notificationService.showError('Session expired. Please log in again.');
    } else if (error.status === 403) {
      this.#notificationService.showError('You do not have permission to perform this action.');
    } else if (error.status === 404) {
      this.#notificationService.showError('The requested resource was not found.');
    } else if (error.status >= 500) {
      this.#notificationService.showError('Server error. Please try again later.');
    } else {
      this.#notificationService.showError(message);
    }

    return {
      status: error.status,
      message,
      originalError: error,
    };
  }

  private getDefaultMessage(status?: number): string {
    switch (status) {
      case 400:
        return 'Invalid request. Please check your input.';
      case 401:
        return 'Unauthorized. Please log in.';
      case 403:
        return 'Forbidden. You do not have permission.';
      case 404:
        return 'Resource not found.';
      case 409:
        return 'Conflict. This resource already exists.';
      case 422:
        return 'Validation error. Please check your input.';
      case 500:
        return 'Internal server error. Please try again later.';
      case 503:
        return 'Service unavailable. Please try again later.';
      default:
        return 'An error occurred. Please try again.';
    }
  }
}

