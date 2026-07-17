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
import { AuthService } from '../../../../core/services/auth.service';
import { SubscriptionService } from '../../../../core/services/subscription.service';
import { ExpedienteService } from '../../../../core/services/expediente.service';
import { CalendarEventService } from '../../../../core/services/calendar-event.service';
import { Vencimiento } from '../../../../core/models/vencimiento.model';
import { CalendarEvent } from '../../../../core/models/calendar-event.model';
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
  authService = inject(AuthService);
  subscriptionService = inject(SubscriptionService);
  expedienteService = inject(ExpedienteService);
  calendarEventService = inject(CalendarEventService);

  fb = inject(FormBuilder);

  expedienteOptions = computed(() =>
    this.expedienteService.expedientes().map(e => ({
      label: `${e.nroExpediente} — ${e.caratula}`,
      value: e.id
    }))
  );

  // Properties
  deadlines = this.deadlineService.deadlines;
  calendarEvents = this.calendarEventService.events;

  // View State
  viewMode = signal<'LIST' | 'MONTH'>('LIST');
  listTab = signal<'VENCIMIENTOS' | 'EVENTOS'>('VENCIMIENTOS');
  currentMonth = signal<Date>(new Date());

  // Deadline Dialog & Form
  deadlineDialog: boolean = false;
  form: FormGroup;
  isEditMode: boolean = false;
  currentId: string | null = null;

  // Event Dialog & Form
  eventDialog: boolean = false;
  eventForm: FormGroup;
  isEventEditMode: boolean = false;
  currentEventId: string | null = null;

  // PDF Upload & Extraction State
  analyzingPdf = signal<boolean>(false);

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

  tiposEvento = [
    { label: 'Reunión', value: 'REUNION' },
    { label: 'Llamada', value: 'LLAMADA' },
    { label: 'Recordatorio', value: 'RECORDATORIO' },
    { label: 'Otro', value: 'OTRO' },
  ];

  coloresEvento = [
    { label: 'Azul',    value: '#3b82f6' },
    { label: 'Verde',   value: '#22c55e' },
    { label: 'Violeta', value: '#a855f7' },
    { label: 'Naranja', value: '#f97316' },
    { label: 'Rosa',    value: '#ec4899' },
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
      const dayDeadlines = this.deadlines().filter(v => {
          if (!v.fechaVencimiento) return false;
          const vDate = new Date(v.fechaVencimiento);
          return vDate.getDate() === day && vDate.getMonth() === month && vDate.getFullYear() === year;
      });
      const dayEvents = this.calendarEvents().filter(e => {
          if (!e.fecha) return false;
          const eDate = new Date(e.fecha);
          return eDate.getDate() === day && eDate.getMonth() === month && eDate.getFullYear() === year;
      });
      days.push({
          date,
          isCurrentMonth: true,
          isToday: date.toDateString() === today.toDateString(),
          deadlines: dayDeadlines,
          events: dayEvents
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
      esPerentorio: [false],
      expedienteId: [null]
    });

    this.eventForm = this.fb.group({
      titulo: ['', Validators.required],
      descripcion: [''],
      fecha: [null, Validators.required],
      fechaFin: [null],
      tipo: ['REUNION', Validators.required],
      color: ['#3b82f6'],
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

  urgencyLevel(v: Vencimiento): 'URGENTE' | 'ALTA' | 'MEDIA' | 'BAJA' {
      if (v.esPerentorio) return 'URGENTE';
      if (v.tipo === 'AUDIENCIA') return 'ALTA';
      if (v.tipo === 'VENCIMIENTO_PLAZO') return 'MEDIA';
      return 'BAJA';
  }

  getUrgencyClass(v: Vencimiento): string {
      switch (this.urgencyLevel(v)) {
          case 'URGENTE': return 'bg-red-100 text-red-700 border-red-200';
          case 'ALTA': return 'bg-orange-100 text-orange-700 border-orange-200';
          case 'MEDIA': return 'bg-yellow-100 text-yellow-700 border-yellow-200';
          default: return 'bg-blue-50 text-blue-700 border-blue-200';
      }
  }

  getUrgencyBorder(v: Vencimiento): string {
      switch (this.urgencyLevel(v)) {
          case 'URGENTE': return 'border-red-200 hover:border-red-300 bg-red-50';
          case 'ALTA': return 'border-orange-200 hover:border-orange-300 bg-orange-50';
          case 'MEDIA': return 'border-yellow-200 hover:border-yellow-300 bg-yellow-50';
          default: return 'border-slate-200 hover:border-slate-300 bg-white';
      }
  }

  getUrgencyDot(v: Vencimiento): string {
      switch (this.urgencyLevel(v)) {
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
        expedienteId: formValue.expedienteId || null
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

  triggerPdfUpload() {
    const fileInput = document.getElementById('pdfFileInput');
    if (fileInput) {
      fileInput.click();
    }
  }

  onPdfFileSelected(event: any) {
    const file = event.target?.files?.[0];
    if (!file) return;

    this.analyzingPdf.set(true);
    
    Swal.fire({
      title: 'Analizando PDF...',
      text: 'Gemini está leyendo el escrito y extrayendo los plazos judiciales.',
      allowOutsideClick: false,
      didOpen: () => {
        Swal.showLoading();
      }
    });

    this.deadlineService.analyzePdf(file).subscribe({
      next: (data) => {
        Swal.close();
        this.analyzingPdf.set(false);
        
        // Open the review/confirm dialog with a prefilled form
        this.isEditMode = false;
        this.currentId = null;
        
        this.form.patchValue({
          titulo: data.titulo,
          descripcion: data.descripcion,
          fechaVencimiento: data.fechaVencimiento ? new Date(data.fechaVencimiento) : new Date(),
          tipo: 'VENCIMIENTO_PLAZO',
          estado: 'PENDIENTE',
          esPerentorio: true,
          expedienteId: null
        });
        
        this.deadlineDialog = true;
        
        Swal.fire({
          icon: 'info',
          title: 'Datos Extraídos',
          text: 'Completamos el formulario con los datos del PDF. Selecciona el expediente y confirma.',
          timer: 5000,
          toast: true,
          position: 'top-end',
          showConfirmButton: false
        });
      },
      error: (err) => {
        Swal.close();
        this.analyzingPdf.set(false);
        console.error(err);
        Swal.fire(
          'Error de Análisis', 
          err.error?.message || 'No se pudo analizar el PDF con Gemini. Verifica que GEMINI_API_KEY esté configurada en el servidor.', 
          'error'
        );
      }
    });
    
    event.target.value = '';
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

  // --- EVENT CRUD ---

  openNewEvent() {
    this.isEventEditMode = false;
    this.currentEventId = null;
    this.eventForm.reset({ tipo: 'REUNION', color: '#3b82f6' });
    this.eventDialog = true;
  }

  editEvent(ev: CalendarEvent) {
    this.isEventEditMode = true;
    this.currentEventId = ev.id;
    this.eventForm.patchValue({ ...ev, fecha: new Date(ev.fecha), fechaFin: ev.fechaFin ? new Date(ev.fechaFin) : null });
    this.eventDialog = true;
  }

  saveEvent() {
    if (this.eventForm.invalid) { this.eventForm.markAllAsTouched(); return; }
    const val = this.eventForm.value;
    if (this.isEventEditMode && this.currentEventId) {
      this.calendarEventService.updateEvent(this.currentEventId, val);
      Swal.fire({ title: 'Actualizado', icon: 'success', timer: 1500, showConfirmButton: false });
    } else {
      this.calendarEventService.addEvent(val);
      Swal.fire({ title: 'Evento creado', icon: 'success', timer: 1500, showConfirmButton: false });
    }
    this.eventDialog = false;
  }

  deleteEvent(id: string) {
    Swal.fire({ title: '¿Eliminar evento?', icon: 'warning', showCancelButton: true, confirmButtonColor: '#dc2626', confirmButtonText: 'Sí, eliminar', cancelButtonText: 'Cancelar' })
      .then(r => { if (r.isConfirmed) this.calendarEventService.deleteEvent(id); });
  }

  simulateNotification(deadline: Vencimiento) {
    const currentUser = this.authService.currentUser();
    const waNumber = currentUser?.phoneNumber;
    const isPhoneVerified = currentUser?.isPhoneVerified;

    if (!waNumber) {
      Swal.fire({
        title: 'Teléfono no registrado',
        text: 'Cargá tu número de teléfono de WhatsApp en tu Perfil para poder recibir alertas.',
        icon: 'warning',
      });
      return;
    }

    if (!isPhoneVerified) {
      Swal.fire({
        title: 'Teléfono no verificado',
        text: 'Debes verificar tu número de teléfono de WhatsApp en tu Perfil primero.',
        icon: 'warning',
      });
      return;
    }

    const daysRemaining = Math.ceil(
      (new Date(deadline.fechaVencimiento).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
    );
    const template = this.notificationService.getNotificationTemplate(deadline, daysRemaining);
    this.notificationService.sendWhatsappMessage(waNumber, template);
  }


}
