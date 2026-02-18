import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { finalize } from 'rxjs';
import { LoadingService } from '../services/loading.service';

export const loadingInterceptor: HttpInterceptorFn = (req, next) => {
  const loadingService = inject(LoadingService);
  
  // Skip loader for background tasks if needed (e.g. notifications polling)
  if (req.headers.has('X-Skip-Loader')) {
      const newReq = req.clone({ headers: req.headers.delete('X-Skip-Loader') });
      return next(newReq);
  }

  loadingService.show();

  return next(req).pipe(
    finalize(() => {
      loadingService.hide();
    })
  );
};
