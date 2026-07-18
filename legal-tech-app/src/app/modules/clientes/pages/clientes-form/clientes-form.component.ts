import { Component, effect, OnInit, signal } from '@angular/core';
import { FormArray, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ClientService } from '../../../../core/services/client.service';
import { Cliente, Familiar } from '../../../../core/models/cliente.model';

@Component({
  selector: 'app-clientes-form',
  standalone: false,
  templateUrl: './clientes-form.component.html',
  styleUrl: './clientes-form.component.scss'
})
export class ClientesFormComponent implements OnInit {
  form: FormGroup;
  isEditMode = signal(false);
  clienteId: string | null = null;

  constructor(
    private fb: FormBuilder,
    private clientService: ClientService,
    private route: ActivatedRoute,
    private router: Router
  ) {
    this.form = this.fb.group({
      nombre: ['', Validators.required],
      apellido: ['', Validators.required],
      dni: ['', Validators.required],
      cuit: [''],
      fechaNacimiento: [null],
      domicilio: [''],
      localidad: ['Concordia'], // Default value
      telefono: ['', Validators.required],
      telefonoAlternativo: [''],
      email: ['', [Validators.email]],
      ocupacion: [''],
      objetoConsulta: [''],
      origenConsulta: [''],
      tieneExpedientesPrevios: [false],
      observaciones: [''], // Used for internal notes
      pretension: [''],
      grupoFamiliar: this.fb.array([])
    });
  }

  ngOnInit(): void {
    this.route.paramMap.subscribe(params => {
      this.clienteId = params.get('id');
      if (this.clienteId) {
        this.isEditMode.set(true);
        const cacheCliente = this.clientService.getClienteById(this.clienteId);
        if (cacheCliente) {
          this.loadForm(cacheCliente);
        } else {
          this.clientService.getClientByIdHttp(this.clienteId).subscribe({
            next: (cliente) => {
              if (cliente) {
                this.loadForm(cliente);
              } else {
                this.router.navigate(['/clientes']);
              }
            },
            error: () => {
              this.router.navigate(['/clientes']);
            }
          });
        }
      }
    });
  }

  get grupoFamiliar() {
    return this.form.get('grupoFamiliar') as FormArray;
  }

  addFamiliar(familiar?: Familiar) {
    const familiarForm = this.fb.group({
      nombre: [familiar?.nombre || '', Validators.required],
      apellido: [familiar?.apellido || '', Validators.required],
      vinculo: [familiar?.vinculo || '', Validators.required],
      dni: [familiar?.dni || ''],
      fechaNacimiento: [familiar?.fechaNacimiento || null],
      edad: [familiar?.edad || null],
      domicilio: [familiar?.domicilio || ''],
      telefono: [familiar?.telefono || ''],
      ocupacion: [familiar?.ocupacion || ''],
      escuela: [familiar?.escuela || ''],
      actividades: [familiar?.actividades || ''],
      salud: [familiar?.salud || ''],
      observaciones: [familiar?.observaciones || '']
    });
    this.grupoFamiliar.push(familiarForm);
  }

  removeFamiliar(index: number) {
    this.grupoFamiliar.removeAt(index);
  }

  loadForm(cliente: Cliente) {
    this.form.patchValue({
      ...cliente,
      fechaNacimiento: cliente.fechaNacimiento ? new Date(cliente.fechaNacimiento) : null
    });

    // Clear existing FormArray
    this.grupoFamiliar.clear();

    // Populate FormArray
    if (cliente.grupoFamiliar) {
      cliente.grupoFamiliar.forEach(familiar => this.addFamiliar(familiar));
    }
  }

  onSubmit() {
    if (this.form.valid) {
      const formValue = this.form.value;
      
      if (this.isEditMode()) {
        this.clientService.updateClient(this.clienteId!, formValue);
      } else {
        this.clientService.addClient(formValue);
      }
      
      this.router.navigate(['/clientes']);
    } else {
      this.form.markAllAsTouched();
    }
  }
}
