import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne } from 'typeorm';
import { Client } from '../../clients/client.entity';
import { Expediente } from '../../expedientes/expediente.entity';

@Entity('documents')
export class Documento {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  filename: string; // Stored filename (uuid + ext)

  @Column()
  originalName: string; // Original user filename

  @Column()
  mimeType: string;

  @Column()
  size: number;

  @Column({ nullable: true })
  path: string;

  @CreateDateColumn()
  createdAt: Date;

  @Column({ nullable: true })
  userId: string;

  @Column({ nullable: true })
  clientId: string;

  @ManyToOne(() => Client, { onDelete: 'CASCADE', nullable: true })
  client: Client;

  @Column({ nullable: true })
  expedienteId: string;

  @ManyToOne(() => Expediente, { onDelete: 'CASCADE', nullable: true })
  expediente: Expediente;
}
