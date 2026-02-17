import { Entity, Column, PrimaryColumn } from 'typeorm';

@Entity('app_system_settings')
export class SystemSetting {
  @PrimaryColumn()
  key: string; // e.g., 'VALOR_JUS_PBA', 'VALOR_UMA_NACION'

  @Column()
  value: string; // Stored as string to be flexible, cast to number when needed

  @Column({ nullable: true })
  description: string;
}
