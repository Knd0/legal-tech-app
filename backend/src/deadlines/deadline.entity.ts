import { Entity, Column, PrimaryGeneratedColumn, ManyToOne } from 'typeorm';
import { Expediente } from '../expedientes/expediente.entity'; // Assuming relative path

@Entity()
export class Deadline {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ nullable: true })
  userId: string;

  @Column({ nullable: true })
  expedienteId: string;

  @ManyToOne(() => Expediente, { nullable: true, onDelete: 'SET NULL' })
  expediente: Expediente;

  @Column({ type: 'timestamp' })
  fechaVencimiento: Date;

  @Column({ nullable: true })
  horaVencimiento: string;

  @Column()
  titulo: string;

  @Column({ type: 'text', nullable: true })
  descripcion: string;

  @Column()
  tipo: string; // 'AUDIENCIA' | 'PRESENTACION_ESCRITO' | 'VENCIMIENTO_PLAZO' | 'OTRO'

  @Column({ default: false })
  esPerentorio: boolean;

  @Column({ default: 'PENDIENTE' })
  estado: string; // 'PENDIENTE' | 'CUMPLIDO' | 'CANCELADO' | 'EXPIRADO'

  @Column({ type: 'timestamp', nullable: true })
  fechaAviso: Date;
}
