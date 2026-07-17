import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn } from 'typeorm';

@Entity('whatsapp_queue')
export class WhatsappQueue {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  number: string;

  @Column({ type: 'text' })
  message: string;

  @Column({ default: 'pending' }) // 'pending', 'processing', 'sent', 'failed'
  status: string;

  @Column({ nullable: true, type: 'text' })
  error: string;

  @CreateDateColumn()
  createdAt: Date;

  @Column({ nullable: true })
  processedAt: Date;
}
