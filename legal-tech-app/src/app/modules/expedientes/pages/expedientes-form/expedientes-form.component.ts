import { Component, effect, OnInit, signal } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ExpedienteService } from '../../../../core/services/expediente.service';
import { ClientService } from '../../../../core/services/client.service';
import { Expediente, EstadoExpediente } from '../../../../core/models/expediente.model';
import { Cliente } from '../../../../core/models/cliente.model';

@Component({
  selector: 'app-expedientes-form',
  standalone: false,
  templateUrl: './expedientes-form.component.html',
  styleUrl: './expedientes-form.component.scss'
})
export class ExpedientesFormComponent implements OnInit {
  form: FormGroup;
  isEditMode = signal(false);
  expedienteId: string | null = null;
  clientes: Cliente[] = [];

  estados: { label: string, value: EstadoExpediente }[] = [
    { label: 'Iniciado', value: 'INICIADO' },
    { label: 'Prueba', value: 'PRUEBA' },
    { label: 'Alegatos', value: 'ALEGATOS' },
    { label: 'Sentencia', value: 'SENTENCIA' },
    { label: 'Archivado', value: 'ARCHIVADO' }
  ];

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

  constructor(
    private fb: FormBuilder,
    private expedienteService: ExpedienteService,
    private clientService: ClientService,
    private route: ActivatedRoute,
    private router: Router
  ) {
    // Sync clients for dropdown
    effect(() => {
      this.clientes = this.clientService.clients();
    });

    this.form = this.fb.group({
      nroExpediente: ['', Validators.required],
      caratula: ['', Validators.required],
      fuero: ['', Validators.required],
      juzgado: ['', Validators.required],
      secretaria: [''],
      fechaInicio: [new Date(), Validators.required],
      estado: ['INICIADO', Validators.required],
      clienteId: ['', Validators.required],
      contraparte: [''],
      abogadoContraparte: [''],
      descripcion: ['']
    });
  }

  ngOnInit(): void {
    this.route.paramMap.subscribe(params => {
      this.expedienteId = params.get('id');
      if (this.expedienteId) {
        this.isEditMode.set(true);
        const expediente = this.expedienteService.getExpedienteById(this.expedienteId);
        if (expediente) {
          this.loadForm(expediente);
        } else {
          this.router.navigate(['/expedientes']);
        }
      }
    });
  }

  loadForm(expediente: Expediente) {
    this.form.patchValue({
      ...expediente,
      fechaInicio: expediente.fechaInicio ? new Date(expediente.fechaInicio) : null
    });
  }

  onSubmit() {
    if (this.form.valid) {
      const formValue = this.form.value;
      
      if (this.isEditMode()) {
        this.expedienteService.updateExpediente(this.expedienteId!, formValue);
      } else {
        this.expedienteService.addExpediente(formValue);
      }
      
      this.router.navigate(['/expedientes']);
    } else {
      this.form.markAllAsTouched();
    }
  }
}
