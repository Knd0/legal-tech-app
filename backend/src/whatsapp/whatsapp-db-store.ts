import { Repository } from 'typeorm';
import { WhatsappSession } from './whatsapp-session.entity';
import * as fs from 'fs';
import * as path from 'path';

export class WhatsappDbStore {
  constructor(
    private readonly sessionRepository: Repository<WhatsappSession>,
  ) {}

  async sessionExists(options: { session: string }): Promise<boolean> {
    try {
      const sessionName = path.basename(options.session);
      const count = await this.sessionRepository.count({ where: { id: sessionName } });
      return count > 0;
    } catch (error) {
      return false;
    }
  }

  async save(options: { session: string }): Promise<void> {
    const sessionName = path.basename(options.session);
    const zipPath = `${options.session}.zip`;
    
    // Read the zip file
    const fileData = await fs.promises.readFile(zipPath);
    
    // Save to DB (insert or update)
    let session = await this.sessionRepository.findOne({ where: { id: sessionName } });
    if (!session) {
      session = this.sessionRepository.create({ id: sessionName });
    }
    session.sessionData = fileData;
    session.updatedAt = new Date();
    await this.sessionRepository.save(session);
  }

  async extract(options: { session: string; path: string }): Promise<void> {
    const sessionName = path.basename(options.session);
    const session = await this.sessionRepository.findOne({ where: { id: sessionName } });
    if (!session) {
      throw new Error(`Session ${sessionName} not found in database`);
    }
    
    // Write the buffer to the path
    await fs.promises.writeFile(options.path, session.sessionData);
  }

  async delete(options: { session: string }): Promise<void> {
    const sessionName = path.basename(options.session);
    await this.sessionRepository.delete({ id: sessionName });
  }
}
