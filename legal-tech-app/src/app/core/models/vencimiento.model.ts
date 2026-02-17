import { Expediente } from './expediente.model';

export type TipoVencimiento = 'AUDIENCIA' | 'PRESENTACION_ESCRITO' | 'VENCIMIENTO_PLAZO' | 'OTRO';
export type EstadoVencimiento = 'PENDIENTE' | 'CUMPLIDO' | 'CANCELADO' | 'EXPIRADO';

export interface Vencimiento {
    id: string; // UUID
    expedienteId: string;
    expediente?: Expediente; // Relación para mostrar info del caso en el calendario
    
    fechaVencimiento: Date;
    horaVencimiento?: string; // Ej: "10:30"
    
    titulo: string;
    descripcion?: string;
    tipo: TipoVencimiento;
    
    esPerentorio: boolean; // Si es un plazo fatal/perentorio (importante para alertas)
    estado: EstadoVencimiento;
    
    fechaAviso?: Date; // Cuándo avisar al usuario
}
