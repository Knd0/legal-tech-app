import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, ManyToOne } from 'typeorm';
import { Client } from '../clients/client.entity';
import { User } from '../users/entities/user.entity';

@Entity()
export class Expediente {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  nroExpediente: string;

  @Column()
  caratula: string;

  @Column()
  fuero: string;

  @Column()
  juzgado: string;

  @Column({ nullable: true })
  secretaria: string;

  @Column({ type: 'date' })
  fechaInicio: Date;

  @Column()
  estado: string; // 'INICIADO' | 'PRUEBA' | 'ALEGATOS' | 'SENTENCIA' | 'ARCHIVADO'

  @ManyToOne(() => Client, (client) => client.expedientes, { nullable: true, onDelete: 'SET NULL' })
  cliente: Client;

  @Column({ nullable: true })
  clienteId: string; // Foreign key

  @Column({ nullable: true })
  contraparte: string;

  @Column({ nullable: true })
  abogadoContraparte: string;

  @Column({ type: 'text', nullable: true })
  descripcion: string;

  @Column({ nullable: true, default: 'NINGUNO' })
  portalJudicial: string; // 'NINGUNO' | 'PJN' | 'MEV_PBA'

  @Column({ nullable: true })
  portalId: string; // ID de causa en el portal

  @Column({ default: true })
  autoSync: boolean;

  @ManyToOne(() => User, (user) => user.expedientes, { onDelete: 'CASCADE' })
  user: User;

  @Column({ nullable: true })
  userId: string;
}
