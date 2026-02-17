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
   * Subscribes to version updates and prompts the user
   */
  private checkForUpdates() {
    this.updates.versionUpdates
      .pipe(
        filter((evt): evt is VersionReadyEvent => evt.type === 'VERSION_READY')
      )
      .subscribe(() => {
        this.promptUserToUpdate();
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

  private promptUserToUpdate() {
    Swal.fire({
      title: 'Nueva versión disponible',
      text: 'Se ha instalado una nueva versión de la aplicación. Actualiza para ver los cambios.',
      icon: 'info',
      showCancelButton: true,
      confirmButtonColor: '#3085d6',
      cancelButtonColor: '#d33',
      confirmButtonText: 'Actualizar ahora',
      cancelButtonText: 'Más tarde'
    }).then((result) => {
      if (result.isConfirmed) {
        // Reload the page to activate the new version
        document.location.reload();
      }
    });
  }
}
