import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SystemSetting } from './entities/system-setting.entity';

@Injectable()
export class SettingsService implements OnModuleInit {
  constructor(
    @InjectRepository(SystemSetting)
    private settingsRepository: Repository<SystemSetting>,
  ) {}

  async onModuleInit() {
    await this.seedSettings();
  }

  async getSettings() {
    const whatsapp = await this.getValue('ENABLE_WHATSAPP');
    const days = await this.getValue('DAYS_BEFORE_ALERT');
    
    return {
        enableWhatsapp: whatsapp === 1, // Store as '1' or '0'
        daysBeforeAlert: days || 3
    };
  }

  async seedSettings() {
    const defaults = [
      { key: 'VALOR_JUS_ENTRE_RIOS', value: '37677', description: 'Valor del JUS en Provincia de Entre Ríos' },
      { key: 'VALOR_UMA_NACION', value: '87342', description: 'Valor de la Unidad de Medida Arancelaria (Nación)' },
      { key: 'ENABLE_WHATSAPP', value: '1', description: 'Habilitar notificaciones de WhatsApp (1=Sí, 0=No)' },
      { key: 'DAYS_BEFORE_ALERT', value: '3', description: 'Días de anticipación para alertas de vencimiento' }
    ];

    for (const setting of defaults) {
      const exists = await this.settingsRepository.findOneBy({ key: setting.key });
      if (!exists) {
        await this.settingsRepository.save(setting);
      }
    }
  }

  async findAll() {
    return this.settingsRepository.find();
  }

  async update(key: string, value: string) {
    await this.settingsRepository.update({ key }, { value });
    return this.settingsRepository.findOneBy({ key });
  }

  async getValue(key: string): Promise<number> {
    const setting = await this.settingsRepository.findOneBy({ key });
    return setting ? Number(setting.value) : 0;
  }
}
