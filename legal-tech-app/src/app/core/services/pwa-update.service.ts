import { Injectable, ApplicationRef } from '@angular/core';
import { SwUpdate, VersionReadyEvent } from '@angular/service-worker';
import { filter, concatMap, tap, first } from 'rxjs/operators';
import { interval } from 'rxjs';
import Swal from 'sweetalert2';

@Injectable({
  providedIn: 'root'
})
export class PwaUpdateService {

  constructor(
    private updates: SwUpdate,
    private appRef: ApplicationRef
  ) {
    if (this.updates.isEnabled) {
      this.checkForUpdates();
      this.pollForUpdates();
    }
  }

  /**
   * Subscribes to version updates and automatically reloads the page
   */
  private checkForUpdates() {
    this.updates.versionUpdates
      .pipe(
        filter((evt): evt is VersionReadyEvent => evt.type === 'VERSION_READY')
      )
      .subscribe(() => {
        console.log('New PWA version ready. Reloading page automatically...');
        document.location.reload();
      });
  }

  /**
   * Polls for updates every 6 hours
   */
  private pollForUpdates() {
    // Allow the app to stabilize first, then poll
    const appIsStable$ = this.appRef.isStable.pipe(first(isStable => isStable === true));
    const everySixHours$ = interval(6 * 60 * 60 * 1000); // 6 hours
    
    appIsStable$.pipe(
      concatMap(() => everySixHours$),
      tap(() => console.log('Checking for PWA updates...'))
    ).subscribe(() => this.updates.checkForUpdate());
  }
}
