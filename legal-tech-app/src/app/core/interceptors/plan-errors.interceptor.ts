import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import Swal from 'sweetalert2';
import { PlanService } from '../services/plan.service';

/**
 * Traduce los rechazos del plan (402 y 403 con code PLAN_*) en un mensaje claro
 * con salida a la página de planes. Se muestra un instante después para
 * reemplazar el aviso genérico ("Error al guardar") que dispara cada servicio.
 */
export const planErrorsInterceptor: HttpInterceptorFn = (req, next) => {
  const router = inject(Router);
  const plan = inject(PlanService);
  return next(req).pipe(
    catchError((err: HttpErrorResponse) => {
      const code = err.error?.code;
      const isPlanError = err.status === 402 || (err.status === 403 && typeof code === 'string' && code.startsWith('PLAN_'));
      if (isPlanError) {
        plan.refresh();
        setTimeout(() => {
          Swal.fire({
            icon: err.status === 402 ? 'warning' : 'info',
            title: err.status === 402 ? 'Suscripción vencida' : 'Función del Plan Profesional',
            text: err.error?.message ?? 'Esta acción requiere otro plan.',
            showCancelButton: true,
            confirmButtonText: 'Ver planes',
            cancelButtonText: 'Ahora no',
            confirmButtonColor: '#C66B3D',
          }).then((r) => {
            if (r.isConfirmed) router.navigate(['/subscription/pricing']);
          });
        }, 60);
      }
      return throwError(() => err);
    }),
  );
};
