export interface Familiar {
    nombre: string;
    apellido: string;
    dni?: string;
    vinculo: string; // Ej: "Padre", "Hijo", "Conviviente"
    fechaNacimiento?: Date; // O edad si no se tiene la fecha exacta
    edad?: number; // Alternativo si solo se tiene "5 AÑOS"
    domicilio?: string;
    telefono?: string;
    ocupacion?: string;
    escuela?: string; // Para hijos en edad escolar
    actividades?: string; // "Empieza futbol"
    salud?: string; // "Es asmatico"
    observaciones?: string;
}

export interface Cliente {
    id: string; // UUID
    nombre: string;
    apellido: string;
    dni: string; // DNI N° 38.772.252
    cuit?: string; // Opcional si aplica
    
    fechaNacimiento?: Date; // 23/04/1995
    domicilio?: string; // DR. FLORENZA 665
    localidad?: string; // Concordia (implícito en el domicilio anterior)
    
    telefono: string; // 3454161792
    telefonoAlternativo?: string;
    email?: string; // CAROTECHEIRA62@GMAIL.COM
    
    ocupacion?: string; // EMPLEADA DOMESTICA 2 VECES X SEMANA
    
    // Datos de la Consulta
    objetoConsulta?: string; // CUOTA ALIMENTARIA. GASTOS EXTRAORDINARIOS. SALARIO.
    origenConsulta?: string; // COMO LLEGÓ AL ESTUDIO: POR UNA CONOCIDA.
    tieneExpedientesPrevios?: boolean; // HAY EXPEDIENTES EN TRÁMITE: NO.
    
    // Datos Adicionales / Observaciones generales
    observaciones?: string; // TIENE OBRA SOCIAL POR EL PAPA
    
    // Grupo Familiar / Contraparte (Hugo, Felipe)
    grupoFamiliar?: Familiar[]; 

    // Pretensión económica o legal
    pretension?: string; // 35.000 MENSUALES + GASTOS EXTRAORDINARIOS
    
    fechaAlta: Date;
}
