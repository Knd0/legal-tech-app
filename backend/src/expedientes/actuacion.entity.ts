import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, ManyToOne } from 'typeorm';
import { Expediente } from './expediente.entity';

@Entity()
export class Actuacion {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  expedienteId: string;

  @ManyToOne(() => Expediente, { onDelete: 'CASCADE' })
  expediente: Expediente;

  @Column({ type: 'date' })
  fecha: Date;

  @Column()
  titulo: string;

  @Column({ type: 'text' })
  descripcion: string;

  @Column({ nullable: true })
  foja: string;

  @Column({ default: 'MANUAL' }) // 'MANUAL' | 'AUTOMATICO_PJN' | 'AUTOMATICO_MEV'
  origen: string;

  @CreateDateColumn()
  createdAt: Date;
}
