import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Client } from '../../clients/client.entity';

@Entity()
export class Factura {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  puntoVenta: number;

  @Column()
  tipoCbte: number; // 11 = Factura C, etc.

  @Column()
  nroCbte: number;

  @Column({ type: 'date' })
  fechaCbte: string; // YYYYMMDD

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  impTotal: number;

  @Column({ nullable: true })
  cae: string;

  @Column({ nullable: true, type: 'date' })
  vtoCae: string; // YYYYMMDD

  @Column({ type: 'bigint' })
  docNro: number; // DNI/CUIT Cliente (bigint to support 11-digit CUITs)

  @ManyToOne(() => Client)
  @JoinColumn({ name: 'clientId' })
  client: Client;

  @Column()
  clientId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column()
  userId: string;

  @CreateDateColumn()
  createdAt: Date;
}
