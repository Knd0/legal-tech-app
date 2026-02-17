import { Component, effect, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, FormsModule, Validators } from '@angular/forms';

// PrimeNG Imports
import { ButtonModule } from 'primeng/button';
import { TableModule } from 'primeng/table';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { DatePickerModule } from 'primeng/datepicker';
import { TextareaModule } from 'primeng/textarea';
import { TooltipModule } from 'primeng/tooltip';
import { CheckboxModule } from 'primeng/checkbox';

// Services & Models
import { DeadlineService } from '../../../../core/services/deadline.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { GoogleCalendarService } from '../../../../core/services/google-calendar.service';
import { Vencimiento } from '../../../../core/models/vencimiento.model';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-calendario-view',
  standalone: true,
  imports: [
    CommonModule, 
    ReactiveFormsModule,
    FormsModule,
    ButtonModule, 
    TableModule, 
    DialogModule, 
    InputTextModule, 
    SelectModule, 
    DatePickerModule, 
    TextareaModule,
    TooltipModule,
    CheckboxModule
  ],
  templateUrl: './calendario-view.component.html',
  styleUrl: './calendario-view.component.scss'
})
export class CalendarioViewComponent {
  // DI
  deadlineService = inject(DeadlineService);
  notificationService = inject(NotificationService);
  googleCalendarService = inject(GoogleCalendarService);
  fb = inject(FormBuilder);

  // Properties
  deadlines = this.deadlineService.deadlines; 
  
  // View State
  viewMode = signal<'LIST' | 'MONTH'>('LIST');
  currentMonth = signal<Date>(new Date());
  
  // Dialog & Form
  deadlineDialog: boolean = false;
  form: FormGroup;
  isEditMode: boolean = false;
  currentId: string | null = null;

  // Options
  tipos = [
    { label: 'Audiencia', value: 'AUDIENCIA' },
    { label: 'Vencimiento Plazo', value: 'VENCIMIENTO_PLAZO' },
    { label: 'Presentación Escrito', value: 'PRESENTACION_ESCRITO' },
    { label: 'Otro', value: 'OTRO' }
  ];

  estados = [
      { label: 'PENDIENTE', value: 'PENDIENTE' },
      { label: 'CUMPLIDO', value: 'CUMPLIDO' },
      { label: 'CANCELADO', value: 'CANCELADO' },
      { label: 'EXPIRADO', value: 'EXPIRADO' }
  ];

  // Calendar Grid Generation
  calendarDays = computed(() => {
    const today = new Date();
    const curr = this.currentMonth();
    const year = curr.getFullYear();
    const month = curr.getMonth(); // 0-indexed

    const firstDayOfMonth = new Date(year, month, 1);
    const lastDayOfMonth = new Date(year, month + 1, 0);
    
    // Day of week for 1st (0 = Sunday, 1 = Monday, ..., 6 = Saturday)
    const startDayOfWeek = firstDayOfMonth.getDay(); 
    
    const days: any[] = [];
    
    // Previous month padding
    const prevMonthLastDay = new Date(year, month, 0).getDate();
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
       const date = new Date(year, month - 1, prevMonthLastDay - i);
       days.push({ date, isCurrentMonth: false, deadlines: [] });
    }
    
    // Current month days
    for (let day = 1; day <= lastDayOfMonth.getDate(); day++) {
      const date = new Date(year, month, day);
      // Filter deadlines for this day
      const dayDeadlines = this.deadlines().filter(v => {
          if (!v.fechaVencimiento) return false;
          const vDate = new Date(v.fechaVencimiento);
          return vDate.getDate() === day && vDate.getMonth() === month && vDate.getFullYear() === year;
      });
      
      days.push({ 
          date, 
          isCurrentMonth: true, 
          isToday: date.toDateString() === today.toDateString(), 
          deadlines: dayDeadlines 
      });
    }
    
    // Next month padding to fill 6 rows (42 days)
    const remaining = 42 - days.length; 
    for (let i = 1; i <= remaining; i++) {
        const date = new Date(year, month + 1, i);
        days.push({ date, isCurrentMonth: false, deadlines: [] });
    }
    
    return days;
  });

  constructor() {
    this.form = this.fb.group({
      titulo: ['', Validators.required],
      descripcion: [''],
      fechaVencimiento: [null, Validators.required],
      tipo: ['VENCIMIENTO_PLAZO', Validators.required],
      estado: ['PENDIENTE', Validators.required],
      esPerentorio: [false]
    });
  }

  // Helper Methods
  toggleView(mode: 'LIST' | 'MONTH') {
      this.viewMode.set(mode);
  }

  prevMonth() {
      const curr = this.currentMonth();
      this.currentMonth.set(new Date(curr.getFullYear(), curr.getMonth() - 1, 1));
  }

  nextMonth() {
      const curr = this.currentMonth();
      this.currentMonth.set(new Date(curr.getFullYear(), curr.getMonth() + 1, 1));
  }
  
  get currentMonthLabel(): string {
      return this.currentMonth().toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });
  }

  getUrgencyClass(urgency: string | undefined): string {
      switch (urgency) {
          case 'URGENTE': return 'bg-red-100 text-red-700 border-red-200';
          case 'ALTA': return 'bg-orange-100 text-orange-700 border-orange-200';
          case 'MEDIA': return 'bg-yellow-100 text-yellow-700 border-yellow-200';
          default: return 'bg-blue-50 text-blue-700 border-blue-200'; // ORDINARIO / BAJA
      }
  }

  getUrgencyBorder(urgency: string | undefined): string {
      switch (urgency) {
          case 'URGENTE': return 'border-red-200 hover:border-red-300 bg-red-50';
          case 'ALTA': return 'border-orange-200 hover:border-orange-300 bg-orange-50';
          case 'MEDIA': return 'border-yellow-200 hover:border-yellow-300 bg-yellow-50';
          default: return 'border-slate-200 hover:border-slate-300 bg-white'; 
      }
  }

  getUrgencyDot(urgency: string | undefined): string {
      switch (urgency) {
          case 'URGENTE': return 'bg-red-500';
          case 'ALTA': return 'bg-orange-500';
          case 'MEDIA': return 'bg-yellow-500';
          default: return 'bg-blue-500';
      }
  }

  // CRUD Actions
  openNew() {
    this.isEditMode = false;
    this.currentId = null;
    this.form.reset({
      tipo: 'VENCIMIENTO_PLAZO',
      estado: 'PENDIENTE',
      esPerentorio: false
    });
    this.deadlineDialog = true;
  }

  editDeadline(deadline: Vencimiento) {
    this.isEditMode = true;
    this.currentId = deadline.id;
    this.form.patchValue({
      ...deadline,
      fechaVencimiento: new Date(deadline.fechaVencimiento)
    });
    this.deadlineDialog = true;
  }

  markAsCompleted(deadline: Vencimiento) {
      if (deadline.estado !== 'PENDIENTE' && deadline.estado !== 'EXPIRADO') return;
      
      this.deadlineService.markAsCompleted(deadline.id);
      Swal.fire({
          title: '¡Completado!',
          text: 'El vencimiento ha sido marcado como cumplido.',
          icon: 'success',
          timer: 1500,
          showConfirmButton: false
      });
  }

  saveDeadline() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const formValue = this.form.value;
    
    if (this.isEditMode && this.currentId) {
      // Update
      const updatedDeadline: Vencimiento = {
          ...formValue,
          id: this.currentId,
          fechaVencimiento: new Date(formValue.fechaVencimiento)
      };
      this.deadlineService.updateDeadline(updatedDeadline);

      Swal.fire({
        title: 'Actualizado',
        text: 'El vencimiento ha sido actualizado correctamente.',
        icon: 'success',
        timer: 2000,
        showConfirmButton: false
      });
    } else {
      // Create
      const newDeadline: Omit<Vencimiento, 'id'> = {
        ...formValue,
        // estado: 'PENDIENTE', // Taken from form now
        expedienteId: 'a8d7d08b-df5d-417b-a747-557a775b6e77' // Mock ID (Valid UUID from seed)
      };
      this.deadlineService.addDeadline(newDeadline);
      
      Swal.fire({
        title: 'Creado',
        text: 'Nuevo vencimiento agendado.',
        icon: 'success',
        timer: 2000,
        showConfirmButton: false
      });
    }

    this.deadlineDialog = false;
  }

  deleteDeadline(id: string) {
    Swal.fire({
      title: '¿Estás seguro?',
      text: "No podrás revertir esta acción",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#0f172a',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar'
    }).then((result) => {
      if (result.isConfirmed) {
        this.deadlineService.deleteDeadline(id);
        Swal.fire('Eliminado', 'El vencimiento ha sido eliminado.', 'success');
      }
    });
  }

  simulateNotification(deadline: Vencimiento) {
    const alertDays = this.notificationService.daysBeforeAlert();
    const alertHours = this.notificationService.checkFrequencyHours();
    const whatsappEnabled = this.notificationService.enableWhatsapp();
    const waNumber = this.notificationService.whatsappNumber();
    
    let waText = '';
    if (whatsappEnabled && waNumber) {
        waText = ' y WhatsApp';
        // Simulating the actual message sending for the demo
        const daysRemaining = Math.ceil((new Date(deadline.fechaVencimiento).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
        const template = this.notificationService.getNotificationTemplate(deadline, daysRemaining);
        
        // Send real message via service
        this.notificationService.sendWhatsappMessage(waNumber, template);
    }

    Swal.fire({
      title: 'Simulación de Alerta',
      text: `Configuración: ${alertDays} días antes, cada ${alertHours}hs.\nEnviando a App${waText}.\n\nNotificación: "Vence ${deadline.titulo}"`,
      icon: 'info',
      toast: true,
      position: 'top-end',
      showConfirmButton: false,
      timer: 5000
    });
  }

  connectGoogleCalendar() {
    this.googleCalendarService.getAuthUrl().subscribe({
      next: (res) => {
        window.location.href = res.url;
      },
      error: (err) => {
        console.error(err);
        Swal.fire('Error', 'No se pudo iniciar la conexión con Google.', 'error');
      }
    });
  }
}
