import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Client } from '../../clients/client.entity';

@Entity()
export class Movimiento {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  tipo: string; // 'HONORARIO' | 'GASTO' | 'PAGO' | 'REGULADO' | 'CONVENIO'

  @Column({ default: 'PESOS' })
  unidad: string; // 'PESOS' | 'JUS' | 'UMA'

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  cantidad: number; // Cantidad de JUS/UMA

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  monto: number; // Monto FINAL en PESOS (si es JUS, es la conversión al momento)

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  montoPesoOriginal: number; // Snapshot del valor en pesos al momento de carga (para históricos)

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  porcentaje: number; // Para cuota litis

  @Column({ default: 'PENDIENTE' })
  estado: string; // 'PENDIENTE' | 'PAGADO' | 'PARCIAL'

  @Column({ type: 'date' })
  fecha: Date;

  @Column()
  descripcion: string;

  @ManyToOne(() => Client, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'clientId' })
  client: Client;

  @Column()
  clientId: string;

  @Column({ nullable: true })
  expedienteId: string; // Optional relation to Expediente
  
  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column()
  userId: string;

  @CreateDateColumn()
  createdAt: Date;
}
