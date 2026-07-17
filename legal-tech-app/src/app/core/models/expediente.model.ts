import { Cliente } from './cliente.model';

export type EstadoExpediente = 'INICIADO' | 'PRUEBA' | 'ALEGATOS' | 'SENTENCIA' | 'ARCHIVADO';

export interface Expediente {
    id: string; // UUID
    nroExpediente: string; // Ej: 1234/2023
    caratula: string; // "Gomez c/ Perez s/ Daños y Perjuicios"
    fuero: string; // Ej: Civil y Comercial, Laboral, Familia
    juzgado: string; // Ej: Juzgado Civil N° 5
    secretaria?: string; // Ej: Secretaría 2
    
    fechaInicio: Date;
    estado: EstadoExpediente;
    
    clienteId?: string;
    cliente?: Cliente; // Relación opcional para display
    
    contraparte?: string; // Nombre de la contraparte
    abogadoContraparte?: string; // Datos del abogado contrario
    
    descripcion?: string;
    portalJudicial?: string;
    portalId?: string;
    autoSync?: boolean;
}
