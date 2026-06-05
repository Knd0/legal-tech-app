import { Entity, Column, PrimaryColumn, UpdateDateColumn } from 'typeorm';

@Entity('whatsapp_sessions')
export class WhatsappSession {
  @PrimaryColumn()
  id: string;

  @Column({ type: 'bytea' })
  sessionData: Buffer;

  @UpdateDateColumn()
  updatedAt: Date;
}
