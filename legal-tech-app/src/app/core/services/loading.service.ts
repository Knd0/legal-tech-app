import { Injectable, signal } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class LoadingService {
  isLoading = signal(false);
  private activeRequests = 0;
  private timeoutId: any;

  show() {
    this.activeRequests++;
    if (this.activeRequests === 1) {
      // Only show loader if request takes longer than 300ms
      this.timeoutId = setTimeout(() => {
        this.isLoading.set(true);
      }, 300);
    }
  }

  hide() {
    this.activeRequests--;
    if (this.activeRequests <= 0) {
      this.activeRequests = 0;
      // If completed before timeout, clear it and don't show loader
      if (this.timeoutId) {
          clearTimeout(this.timeoutId);
          this.timeoutId = null;
      }
      this.isLoading.set(false);
    }
  }
}
