import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, OneToMany, OneToOne, UpdateDateColumn } from 'typeorm';
import { Client } from '../../clients/client.entity';
import { Expediente } from '../../expedientes/expediente.entity';
import { Subscription } from './subscription.entity';

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

  @Column({ type: 'text', nullable: true })
  afipCert: string;

  @Column({ type: 'text', nullable: true })
  afipKey: string;

  @Column({ default: false })
  afipProduction: boolean;

  @CreateDateColumn()
  createdAt: Date;

  // @Column({ nullable: true })
  // googleRefreshToken: string;

  @OneToOne(() => Subscription, (sub) => sub.user, { eager: true, nullable: true } as any)
  subscription: Subscription | null;

  @UpdateDateColumn()
  updatedAt: Date;
}
