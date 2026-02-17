import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, OneToMany, ManyToOne } from 'typeorm';
import { Expediente } from '../expedientes/expediente.entity';
import { User } from '../users/entities/user.entity';

@Entity()
export class Client {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  nombre: string;

  @Column()
  apellido: string;

  @Column()
  dni: string;

  @Column({ nullable: true })
  cuit: string;

  @Column({ type: 'date', nullable: true })
  fechaNacimiento: Date;

  @Column({ nullable: true })
  domicilio: string;

  @Column({ nullable: true })
  localidad: string;

  @Column()
  telefono: string;

  @Column({ nullable: true })
  telefonoAlternativo: string;

  @Column({ nullable: true })
  email: string;

  @Column({ nullable: true })
  ocupacion: string;

  @Column({ nullable: true })
  objetoConsulta: string;

  @Column({ nullable: true })
  origenConsulta: string;

  @Column({ default: false })
  tieneExpedientesPrevios: boolean;

  @Column({ type: 'text', nullable: true })
  observaciones: string;

  @Column({ type: 'text', nullable: true })
  pretension: string;

  @Column({ type: 'simple-json', nullable: true })
  grupoFamiliar: any[];

  @CreateDateColumn()
  fechaAlta: Date;

  @ManyToOne(() => User, (user) => user.clients, { onDelete: 'CASCADE' })
  user: User;

  @Column({ nullable: true }) // Nullable for existing records, should be migrated
  userId: string;

  @OneToMany(() => Expediente, (expediente) => expediente.cliente)
  expedientes: Expediente[];
}
