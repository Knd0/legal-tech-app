import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, OneToMany, OneToOne, UpdateDateColumn } from 'typeorm';
import { Client } from '../../clients/client.entity';
import { Expediente } from '../../expedientes/expediente.entity';
import { Subscription } from './subscription.entity';
import { encryptedColumn } from '../../common/crypto/field-encryption';

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

  @Column({ default: false })
  isPhoneVerified: boolean;

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

  @Column({ type: 'text', nullable: true, transformer: encryptedColumn })
  afipKey: string;

  @Column({ default: false })
  afipProduction: boolean;

  @Column({ default: 1 })
  daysBeforeAlert: number;

  @Column({ default: 3 })
  daysBeforeAlertSecondary: number;

  @Column({ default: true })
  alertWhatsapp: boolean;

  @Column({ default: true })
  alertPush: boolean;

  @Column({ default: true })
  alertOnDueDate: boolean;

  @Column({ default: true })
  alertTypeAudiencias: boolean;

  @Column({ default: true })
  alertTypeVencimientos: boolean;

  @Column({ default: true })
  alertTypeEscritos: boolean;

  @Column({ nullable: true })
  pjnUser: string;

  // Sin `type` explícito a propósito: cambiar varchar→text con synchronize:true
  // puede hacer que TypeORM recree la columna y pierda los datos.
  @Column({ nullable: true, transformer: encryptedColumn })
  pjnPassword: string;

  @Column({ nullable: true })
  mevUser: string;

  // Sin `type` explícito a propósito: cambiar varchar→text con synchronize:true
  // puede hacer que TypeORM recree la columna y pierda los datos.
  @Column({ nullable: true, transformer: encryptedColumn })
  mevPassword: string;

  @CreateDateColumn()
  createdAt: Date;

  // @Column({ nullable: true })
  // googleRefreshToken: string;

  @OneToOne(() => Subscription, (sub) => sub.user, { eager: true, nullable: true } as any)
  subscription: Subscription | null;

  @UpdateDateColumn()
  updatedAt: Date;
}
