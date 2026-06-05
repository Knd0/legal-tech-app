import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { User } from '../users/entities/user.entity';

@Entity()
export class CalendarEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column()
  titulo: string;

  @Column({ nullable: true })
  descripcion: string;

  @Column({ type: 'timestamptz' })
  fecha: Date;

  @Column({ type: 'timestamptz', nullable: true })
  fechaFin: Date;

  @Column({ default: 'REUNION' })
  tipo: string; // REUNION | LLAMADA | RECORDATORIO | OTRO

  @Column({ default: '#3b82f6' })
  color: string;

  @CreateDateColumn()
  createdAt: Date;
}
