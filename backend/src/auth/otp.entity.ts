import { Entity, Column, PrimaryColumn } from 'typeorm';

@Entity('otps')
export class Otp {
  @PrimaryColumn()
  key: string;

  @Column()
  code: string;

  @Column({ type: 'timestamp' })
  expiresAt: Date;

  @Column({ default: 0 })
  attempts: number;
}
