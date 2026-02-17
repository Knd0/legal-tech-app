import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

@Entity()
export class SystemSetting {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ default: 3 })
  daysBeforeAlert: number;

  @Column({ default: 24 })
  checkFrequencyHours: number;

  @Column({ default: false })
  enableWhatsapp: boolean;

  @Column({ nullable: true })
  whatsappNumber: string;

  // Singleton enforcer (we only need one row)
  @Column({ default: true })
  isDefault: boolean;
}
