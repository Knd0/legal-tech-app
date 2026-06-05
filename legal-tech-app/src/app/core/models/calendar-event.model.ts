export type TipoEvento = 'REUNION' | 'LLAMADA' | 'RECORDATORIO' | 'OTRO';

export interface CalendarEvent {
  id: string;
  titulo: string;
  descripcion?: string;
  fecha: Date;
  fechaFin?: Date;
  tipo: TipoEvento;
  color: string;
  createdAt?: Date;
}
