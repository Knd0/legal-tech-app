import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, OneToMany, UpdateDateColumn } from 'typeorm';
import { Client } from '../../clients/client.entity';
import { Expediente } from '../../expedientes/expediente.entity';

@Entity()
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  email: string;

  @Column()
  passwordHash: string;

  @Column()
  fullName: string;

  @Column({ nullable: true })
  phoneNumber: string;

  @Column({ default: true })
  isActive: boolean;

  @OneToMany(() => Client, (client) => client.user)
  clients: Client[];

  @OneToMany(() => Expediente, (expediente) => expediente.user)
  expedientes: Expediente[];

  @Column({ default: 'USER' }) // 'ADMIN' | 'USER'
  role: string;

  @Column({ nullable: true })
  cuit: string;

  @Column({ nullable: true })
  address: string;

  @Column({ nullable: true })
  iibb: string;

  @Column({ nullable: true })
  initActivityUser: Date;

  @Column({ nullable: true })
  puntoVenta: number;

  @Column({ nullable: true, default: 'Resp. Monotributo' })
  condicionIva: string;

  @CreateDateColumn()
  createdAt: Date;

  @Column({ nullable: true })
  googleRefreshToken: string;

  @UpdateDateColumn()
  updatedAt: Date;
}
