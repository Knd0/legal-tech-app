import { Component, OnInit, signal } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { LegalModelService, LegalModel } from '../../../../core/services/legal-model.service';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-modelos-form',
  standalone: false,
  templateUrl: './modelos-form.component.html'
})
export class ModelosFormComponent implements OnInit {
  form: FormGroup;
  isEditMode = signal(false);
  modelId: string | null = null;

  fueros: string[] = [
    'Civil y Comercial',
    'Laboral',
    'Familia',
    'Penal',
    'Contencioso Administrativo',
    'Federal',
    'Ejecuciones Fiscales',
    'Concursal',
  ];

  tiposEscritos: string[] = [
    'Demanda',
    'Contestación',
    'Amparo',
    'Apelación',
    'Cédula',
    'Escrito Simple',
    'Otro'
  ];

  constructor(
    private fb: FormBuilder,
    private legalModelService: LegalModelService,
    private route: ActivatedRoute,
    private router: Router
  ) {
    this.form = this.fb.group({
      titulo: ['', Validators.required],
      fuero: ['', Validators.required],
      tipoEscrito: ['', Validators.required],
      contenido: ['', Validators.required],
      tags: ['']
    });
  }

  ngOnInit(): void {
    this.route.paramMap.subscribe(params => {
      this.modelId = params.get('id');
      if (this.modelId) {
        this.isEditMode.set(true);
        this.legalModelService.findOne(this.modelId).subscribe({
          next: (model) => {
            this.form.patchValue(model);
          },
          error: (err) => {
            console.error(err);
            this.router.navigate(['/modelos']);
          }
        });
      }
    });
  }

  onSubmit(): void {
    if (this.form.valid) {
      const formValue = this.form.value;

      if (this.isEditMode()) {
        this.legalModelService.update(this.modelId!, formValue).subscribe({
          next: () => {
            Swal.fire({
              icon: 'success',
              title: 'Guardado',
              text: 'El modelo se ha actualizado con éxito.',
              toast: true,
              position: 'top-end',
              showConfirmButton: false,
              timer: 3000
            });
            this.router.navigate(['/modelos']);
          },
          error: (err) => {
            console.error(err);
            Swal.fire('Error', 'No se pudo guardar el modelo.', 'error');
          }
        });
      } else {
        this.legalModelService.create(formValue).subscribe({
          next: () => {
            Swal.fire({
              icon: 'success',
              title: 'Creado',
              text: 'El modelo se ha registrado con éxito.',
              toast: true,
              position: 'top-end',
              showConfirmButton: false,
              timer: 3000
            });
            this.router.navigate(['/modelos']);
          },
          error: (err) => {
            console.error(err);
            Swal.fire('Error', 'No se pudo registrar el modelo.', 'error');
          }
        });
      }
    } else {
      this.form.markAllAsTouched();
    }
  }

  goBack(): void {
    this.router.navigate(['/modelos']);
  }
}
