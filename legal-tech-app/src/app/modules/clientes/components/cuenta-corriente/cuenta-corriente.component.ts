import { Component, Input, OnInit, inject, signal, computed, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MovimientoService, Movimiento, Balance } from '../../../../core/services/movimiento.service';
import { ConfiguracionService } from '../../../../core/services/configuracion.service';
import { CalculoHonorariosService } from '../../../../core/services/calculo-honorarios.service';
import Swal from 'sweetalert2';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';
import { TagModule } from 'primeng/tag';

import { AuthService } from '../../../../core/services/auth.service';
import { ClientService } from '../../../../core/services/client.service';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

import { GavelLoaderComponent } from '../../../../shared/components/gavel-loader'; 

@Component({
  selector: 'app-cuenta-corriente',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, TableModule, ButtonModule, TooltipModule, TagModule, GavelLoaderComponent],
  templateUrl: './cuenta-corriente.component.html',
  styleUrls: ['./cuenta-corriente.component.scss']
})
export class CuentaCorrienteComponent implements OnInit {
  @Input() clientId!: string;

  movimientoService = inject(MovimientoService);
  clientService = inject(ClientService);
  configService = inject(ConfiguracionService);
  calculoService = inject(CalculoHonorariosService);
  authService = inject(AuthService);
  fb = inject(FormBuilder);

  balance = signal<Balance | null>(null);
  movimientos = computed(() => this.balance()?.movimientos || []);
  
  showModal = false;
  showSettingsModal = false;
  movimientoForm: FormGroup;
  settingsForm: FormGroup;

  estimatedTotal = signal<number>(0);

  constructor() {
    this.movimientoForm = this.fb.group({
      tipo: ['HONORARIO', Validators.required],
      unidad: ['PESOS', Validators.required],
      cantidad: [null], // For JUS/UMA
      monto: ['', [Validators.required, Validators.min(0.01)]], // Final amount in Pesos
      fecha: [new Date().toISOString().split('T')[0], Validators.required],
      descripcion: ['', Validators.required],
      estado: ['PENDIENTE', Validators.required],
      expedienteId: [null] 
    });

    this.settingsForm = this.fb.group({
      valorJus: [0, Validators.required],
      valorUma: [0, Validators.required]
    });

    // Auto-calculate amount when Unit or Quantity changes
    effect(() => {
        // This effect is tricky with reactive forms, handling via valueChanges below
    });

    this.movimientoForm.valueChanges.subscribe(val => {
        if (val.unidad !== 'PESOS' && val.cantidad) {
            const calculated = this.calculoService.convertir(val.cantidad, val.unidad);
            if (calculated !== val.monto) {
                this.movimientoForm.patchValue({ monto: calculated }, { emitEvent: false });
            }
        }
    });
  }

  ngOnInit(): void {
    if (this.clientId) {
      this.loadBalance();
      this.loadFacturas();
    }
  }

  loadBalance() {
    this.movimientoService.getBalance(this.clientId).subscribe({
      next: (data) => this.balance.set(data),
      error: (err) => console.error('Error loading balance', err)
    });
  }

  openModal() {
    this.showModal = true;
    this.editingId = null; // Reset to create mode
    this.movimientoForm.reset({ // Use reset instead of patchValue for cleaner state
      tipo: 'HONORARIO',
      unidad: 'PESOS',
      cantidad: null,
      monto: '',
      fecha: new Date().toISOString().split('T')[0],
      descripcion: '',
      estado: 'PENDIENTE',
      expedienteId: null
    });
  }

  openSettings() {
    this.showSettingsModal = true;
    this.settingsForm.patchValue({
        valorJus: this.configService.valorJus(),
        valorUma: this.configService.valorUma()
    });
  }
  
  closeModal() {
    this.showModal = false;
    this.showSettingsModal = false;
    this.editingId = null;
  }

  saveSettings() {
      // Parallel updates
      this.configService.updateSetting('VALOR_JUS_ENTRE_RIOS', this.settingsForm.value.valorJus).subscribe();
      this.configService.updateSetting('VALOR_UMA_NACION', this.settingsForm.value.valorUma).subscribe(() => {
          this.closeModal();
          Swal.fire({ icon: 'success', title: 'Valores actualizados', toast: true, position: 'top-end', timer: 2000, showConfirmButton: false });
      });
  }

  isSubmitting = false;
  editingId: string | null = null; // Track which movement is being edited

  onSubmit() {
    if (this.movimientoForm.invalid || this.isSubmitting) return;

    this.isSubmitting = true;
    const formValue = this.movimientoForm.value;
    const movimientoData: Partial<Movimiento> = {
      ...formValue,
      clientId: this.clientId
    };

    const request$ = this.editingId 
        ? this.movimientoService.update(this.editingId, movimientoData)
        : this.movimientoService.create(movimientoData);

    request$.subscribe({
      next: () => {
        this.isSubmitting = false;
        this.loadBalance();
        this.closeModal();
        Swal.fire({
          icon: 'success',
          title: this.editingId ? 'Movimiento actualizado' : 'Movimiento registrado',
          showConfirmButton: false,
          timer: 1500
        });
      },
      error: (err) => {
        this.isSubmitting = false;
        console.error('Error saving movement', err);
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: 'No se pudo guardar el movimiento'
        });
      }
    });
  }

  editMovimiento(m: Movimiento) {
      this.editingId = m.id;
      this.showModal = true;
      
      this.movimientoForm.patchValue({
          tipo: m.tipo,
          unidad: m.unidad,
          cantidad: m.cantidad,
          monto: m.monto,
          fecha: new Date(m.fecha).toISOString().split('T')[0],
          descripcion: m.descripcion,
          estado: m.estado,
          expedienteId: m.expedienteId
      });
  }

  deleteMovimiento(id: string) {
      Swal.fire({
          title: '¿Eliminar movimiento?',
          text: 'Esta acción no se puede deshacer',
          icon: 'warning',
          showCancelButton: true,
          confirmButtonText: 'Sí, eliminar',
          cancelButtonText: 'Cancelar',
          confirmButtonColor: '#ef4444'
      }).then((result) => {
          if (result.isConfirmed) {
              this.movimientoService.delete(id).subscribe({
                  next: () => {
                      this.loadBalance();
                      Swal.fire('Eliminado', 'El movimiento ha sido eliminado', 'success');
                  },
                  error: (err) => {
                      console.error('Error deleting', err);
                      Swal.fire('Error', 'No se pudo eliminar el movimiento', 'error');
                  }
              });
          }
      });
  }

  getTipoLabel(tipo: string): string {
    return tipo.charAt(0) + tipo.slice(1).toLowerCase();
  }

  getTipoClass(tipo: string): string {
    switch (tipo) {
      case 'HONORARIO': return 'bg-blue-100 text-blue-800';
      case 'REGULADO': return 'bg-purple-100 text-purple-800';
      case 'CONVENIO': return 'bg-indigo-100 text-indigo-800';
      case 'GASTO': return 'bg-orange-100 text-orange-800';
      case 'PAGO': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  }

  getEstadoClass(estado: string): string {
      switch (estado) {
          case 'PENDIENTE': return 'bg-red-50 text-red-600 border-red-200';
          case 'PARCIAL': return 'bg-yellow-50 text-yellow-600 border-yellow-200';
          case 'PAGADO': return 'bg-green-50 text-green-600 border-green-200';
          default: return 'bg-slate-50 text-slate-600';
      }
  }

  generateInvoice(movimiento: Movimiento) {
      Swal.fire({
          title: 'Generar Factura AFIP',
          text: `¿Desea generar una factura C por ${movimiento.monto}?`,
          icon: 'question',
          showCancelButton: true,
          confirmButtonText: 'Sí, Facturar',
          cancelButtonText: 'Cancelar'
      }).then((result) => {
          if (result.isConfirmed) {
              this.movimientoService.createFactura(movimiento).subscribe({
                  next: (res) => {
                      Swal.fire('Factura Generada', `CAE: ${res.cae}`, 'success');
                      this.loadFacturas(); // Refresh list
                  },
                  error: (err) => {
                       console.error(err);
                       Swal.fire('Error', 'No se pudo generar la factura. Revise la configuración de AFIP.', 'error');
                  }
              });
          }
      });
  }

  // FACTURAS LOGIC
  facturas = signal<any[]>([]);
  facturasTotalRecords = signal<number>(0);
  facturasLoading = signal<boolean>(false);
  facturasRows = signal<number>(5);
  facturasFirst = signal<number>(0);
  facturasPage = signal<number>(1);

  loadFacturas() {
      if (!this.clientId) return;
      this.facturasLoading.set(true);
      this.movimientoService.getFacturasByClientPaginated(this.clientId, this.facturasPage(), this.facturasRows()).subscribe({
          next: (res) => {
              this.facturas.set(res.data);
              this.facturasTotalRecords.set(res.total);
              this.facturasLoading.set(false);
          },
          error: (err) => {
              console.error('Error fetching invoices', err);
              this.facturasLoading.set(false);
          }
      });
  }

  loadFacturasLazy(event: any) {
      const pageNum = Math.floor(event.first / event.rows) + 1;
      this.facturasPage.set(pageNum);
      this.facturasRows.set(event.rows);
      this.facturasFirst.set(event.first);
      this.loadFacturas();
  }

  printFactura(factura: any) {
      const client = this.clientService.getClienteById(this.clientId);
      if (!client) {
          Swal.fire('Error', 'No se pudo obtener la información del cliente.', 'error');
          return;
      }

      // Validate User Profile
      const user = this.authService.currentUser();
      if (!user || !user.cuit || !user.address || !user.puntoVenta) {
          Swal.fire({
              title: 'Perfil Incompleto',
              text: 'Para generar facturas, necesitas completar tu CUIT, Domicilio y Punto de Venta en tu perfil.',
              icon: 'warning',
              confirmButtonText: 'Ir a Mi Perfil'
          }).then((result) => {
              if (result.isConfirmed) {
                  // Navigate to Profile (Need Router)
                  // Injecting Router dynamically or via constructor
                  window.location.href = '/profile';
              }
          });
          return;
      }

      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.width;

      // HEADER
      doc.setFontSize(20);
      doc.setFont('helvetica', 'bold');
      doc.text('ESTUDIO JURIDICO', 15, 20);
      
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(`Abogada/o: ${user.fullName}`, 15, 30);
      doc.text(`Dirección: ${user.address}`, 15, 35);
      doc.text(`Email: ${user.email}`, 15, 40);
      doc.text(`Condición IVA: ${user.condicionIva || 'Responsable Monotributo'}`, 15, 45);
      if (user.iibb) {
          doc.text(`IIBB: ${user.iibb}`, 15, 50);
      }
      if (user.initActivityUser) {
          doc.text(`Inicio Act: ${new Date(user.initActivityUser).toLocaleDateString()}`, 15, 55);
      }

      // INVOICE BOX
      doc.setDrawColor(0);
      doc.setFillColor(255, 255, 255);
      doc.rect(120, 10, 80, 40);
      
      doc.setFontSize(18);
      doc.setFont('helvetica', 'bold');
      doc.text('FACTURA', 160, 20, { align: 'center' });
      
      doc.setFontSize(24);
      doc.text('C', 140, 20);
      doc.rect(136, 12, 8, 8); // Box around C
      
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text(`N° 000${factura.puntoVenta}-0000${factura.nroCbte}`, 130, 30);
      
      doc.setFont('helvetica', 'normal');
      doc.text(`Fecha: ${new Date(factura.createdAt).toLocaleDateString()}`, 130, 38);
      doc.text(`CUIT: ${user.cuit}`, 130, 44);

      // CLIENT INFO
      doc.line(10, 60, pageWidth - 10, 60);
      
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text('Datos del Cliente', 15, 68);
      
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(`Nombre: ${client.nombre} ${client.apellido}`, 15, 76);
      doc.text(`DNI/CUIT: ${client.dni || client.cuit || '-'}`, 15, 82);
      doc.text(`Dirección: ${client.domicilio || '-'}`, 15, 88);
      doc.text(`Condición IVA: Consumidor Final`, 120, 76);

      // ITEMS TABLE
      autoTable(doc, {
          startY: 95,
          head: [['Cantidad', 'Descripción', 'Precio Unit.', 'Subtotal']],
          body: [
              ['1', 'Honorarios Profesionales / Gastos Jurídicos', `$ ${factura.impTotal}`, `$ ${factura.impTotal}`]
          ],
          theme: 'grid',
          headStyles: { fillColor: [15, 23, 42] }, // Slate 900
      });

      const finalY = (doc as any).lastAutoTable.finalY + 10;

      // TOTALS
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text(`TOTAL: $ ${factura.impTotal}`, 150, finalY);

      // CAE FOOTER
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(`CAE: ${factura.cae}`, 150, finalY + 10);
      doc.text(`Vto. CAE: ${new Date(factura.vtoCae).toLocaleDateString()}`, 150, finalY + 16);

      // Save
      doc.save(`Factura_${factura.nroCbte}.pdf`);
  }
}
