/**
 * Contrato común entre cada producto y la consola central. Las otras apps
 * (gymsaas, Ticketera, los módulos nuevos) exponen exactamente esta forma.
 */
export type ConsoleTenantStatus = 'active' | 'trial' | 'grace' | 'expired' | 'suspended' | 'paused' | 'cancelled';

export interface ConsoleTenant {
  id: string;
  name: string;
  email: string | null;
  plan: string;
  status: ConsoleTenantStatus;
  /** Importe mensual que paga hoy, en ARS. 0 si no está pagando. */
  monthlyAmount: number;
  expiresAt: string | null;
  createdAt: string | null;
  /** Métricas de uso propias de cada producto (clientes, socios, eventos…). */
  usage: Record<string, number>;
}

export interface ConsoleSummary {
  product: string;
  displayName: string;
  sector: string;
  currency: 'ARS';
  generatedAt: string;
  tenants: ConsoleTenant[];
}
