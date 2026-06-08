import { Injectable, OnApplicationBootstrap, Logger } from '@nestjs/common';
import { UsersService } from './users/users.service';
import { DataSource } from 'typeorm';

@Injectable()
export class SeedService implements OnApplicationBootstrap {
  private readonly logger = new Logger(SeedService.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly dataSource: DataSource
  ) {}

  async onApplicationBootstrap() {
    await this.seedAdmin();
    await this.seedMultifranco();
  }

  private async seedAdmin() {
    this.logger.log('Checking for default Admin user...');
    
    const adminEmail = 'admin@themis.com';
    const adminPassword = process.env.ADMIN_PASSWORD || 'ChangeMe123!';
    
    if (!process.env.ADMIN_PASSWORD) {
        this.logger.warn('WARNING: Using default admin password. Set ADMIN_PASSWORD environment variable in production!');
    }

    const existingUser = await this.usersService.findOneByEmail(adminEmail);

    if (!existingUser) {
      this.logger.log('Creating default Admin user...');
      await this.usersService.createUser({
        email: adminEmail,
        password: adminPassword,
        fullName: 'Administrator',
        role: 'ADMIN',
        isActive: true
      });
      this.logger.log(`Admin created: ${adminEmail} (Password: ${process.env.ADMIN_PASSWORD ? 'HIDDEN' : adminPassword})`);
    } else {
      this.logger.log('Admin user already exists.');
    }
  }

  private async seedMultifranco() {
    const email = 'multifranco0@gmail.com';
    this.logger.log(`Checking for ${email} test account...`);
    
    let user = await this.usersService.findOneByEmail(email);
    let userId: string;
    
    if (!user) {
      this.logger.log(`User ${email} not found. Creating default test account...`);
      user = await this.usersService.createUser({
        email: email,
        password: 'password123',
        fullName: 'Franco de Iriondo',
        role: 'USER',
        isActive: true,
        subscriptionStatus: 'active'
      });
      userId = user.id;
      this.logger.log(`Test user created with ID: ${userId}`);
    } else {
      userId = user.id;
      this.logger.log(`Test user already exists with ID: ${userId}`);
      
      // Ensure subscription is active so the user can test
      if (user.subscription?.subscriptionStatus !== 'active') {
        await this.usersService.updateSubscription(userId, { subscriptionStatus: 'active' });
        this.logger.log(`Updated test user subscription status to active.`);
      }
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    
    try {
      // Check if this user already has clients in the database
      const clientCountRes = await queryRunner.query('SELECT COUNT(*) FROM "client" WHERE "userId" = $1', [userId]);
      const clientCount = parseInt(clientCountRes[0].count, 10);
      
      if (clientCount > 0) {
        this.logger.log(`User ${email} already has ${clientCount} clients. Skipping mock data seeding to avoid overwriting testing progress.`);
        return;
      }
      
      this.logger.log(`Seeding mock cases, deadlines, calendar events, movements and invoices for ${email}...`);
      
      // 1. Insert Clients
      const clientInsertRes = await queryRunner.query(`
        INSERT INTO "client" (nombre, apellido, dni, cuit, telefono, email, "userId", "tieneExpedientesPrevios")
        VALUES 
          ('Juan', 'Perez', '20123456', '20-20123456-9', '1122334455', 'juan.perez@example.com', $1, true),
          ('Maria', 'Gomez', '27987654', '27-27987654-2', '1199887766', 'maria.gomez@example.com', $1, false),
          ('Carlos', 'Rodriguez', '20234567', '20-20234567-1', '1155443322', 'carlos.rodriguez@example.com', $1, true)
        RETURNING id, nombre, apellido, dni
      `, [userId]);
      
      const clients: Record<string, string> = {};
      const clientsDni: Record<string, number> = {};
      clientInsertRes.forEach((row: any) => {
        clients[row.nombre] = row.id;
        clientsDni[row.nombre + '_dni'] = parseInt(row.dni, 10);
      });

      // 2. Insert Expedientes
      const expInsertRes = await queryRunner.query(`
        INSERT INTO "expediente" ("nroExpediente", caratula, fuero, juzgado, "fechaInicio", estado, "clienteId", "userId")
        VALUES 
          ('EXP-101/2026', 'Perez Juan c/ Seguros S.A. s/ Daños', 'Civil y Comercial', 'Juzgado Nº 4', '2026-02-15', 'INICIADO', $1, $4),
          ('EXP-202/2026', 'Gomez Maria c/ Consorcio s/ Cobro de Pesos', 'Civil', 'Juzgado Nº 12', '2026-03-10', 'PRUEBA', $2, $4),
          ('EXP-303/2026', 'Rodriguez Carlos c/ Transportes Unidos s/ Accidente de Trabajo', 'Laboral', 'Tribunal de Trabajo Nº 2', '2026-04-10', 'INICIADO', $3, $4)
        RETURNING id, "nroExpediente"
      `, [clients['Juan'], clients['Maria'], clients['Carlos'], userId]);

      const exps: Record<string, string> = {};
      expInsertRes.forEach((row: any) => {
        exps[row.nroExpediente] = row.id;
      });

      // 3. Insert Deadlines
      const today = new Date('2026-06-05T12:00:00Z');
      const inTwoDays = new Date('2026-06-07T12:00:00Z');
      const inFiveDays = new Date('2026-06-10T12:00:00Z');

      await queryRunner.query(`
        INSERT INTO "deadline" (titulo, descripcion, "fechaVencimiento", "horaVencimiento", "esPerentorio", estado, "expedienteId", "userId", tipo)
        VALUES 
          ('Vencimiento de contestación de traslado', 'Presentar escrito de responde al traslado de demanda en tiempo y forma.', $1, '09:00', true, 'PENDIENTE', $4, $7, 'VENCIMIENTO_PLAZO'),
          ('Plazo para presentar pericia médica', 'El perito médico intimó a las partes a proponer puntos de pericia adicionales.', $2, '12:00', true, 'PENDIENTE', $5, $7, 'PRESENTACION_ESCRITO'),
          ('Audiencia de testigos', 'Audiencia preliminar de prueba de testigos fijada por el juez.', $3, '10:00', false, 'PENDIENTE', $6, $7, 'AUDIENCIA')
      `, [today, inTwoDays, inFiveDays, exps['EXP-101/2026'], exps['EXP-303/2026'], exps['EXP-202/2026'], userId]);

      // 4. Insert Calendar Events
      const tomorrow = new Date('2026-06-06T10:00:00Z');
      const inThreeDays = new Date('2026-06-08T09:30:00Z');

      await queryRunner.query(`
        INSERT INTO "calendar_event" (titulo, descripcion, fecha, "fechaFin", tipo, color, "userId", "createdAt")
        VALUES 
          ('Reunión de preparación de testigos', 'Preparación de la declaración del cliente y testigos para la audiencia.', $1, null, 'REUNION', '#3b82f6', $3, NOW()),
          ('Audiencia preliminar', 'Asistencia presencial al juzgado por el caso Perez c/ Seguros S.A.', $2, null, 'OTRO', '#ef4444', $3, NOW())
      `, [tomorrow, inThreeDays, userId]);

      // 5. Insert Financial Movements
      await queryRunner.query(`
        INSERT INTO "movimiento" (descripcion, monto, tipo, unidad, estado, fecha, "clientId", "expedienteId", "userId", "createdAt")
        VALUES 
          ('Gastos de inicio de demanda y tasa de justicia', 10000.00, 'GASTO', 'PESOS', 'PAGADO', '2026-05-15', $1, $3, $5, NOW()),
          ('Honorarios por redacción de demanda', 150000.00, 'HONORARIO', 'PESOS', 'PENDIENTE', '2026-05-20', $1, $3, $5, NOW()),
          ('Adelanto de gastos para perito médico', 35000.00, 'GASTO', 'PESOS', 'PAGADO', '2026-05-25', $2, $4, $5, NOW()),
          ('Adelanto de honorarios profesionales', 50000.00, 'HONORARIO', 'PESOS', 'PAGADO', '2026-05-30', $2, $4, $5, NOW())
      `, [clients['Juan'], clients['Carlos'], exps['EXP-101/2026'], exps['EXP-303/2026'], userId]);

      // 6. Insert Invoices (Facturas)
      await queryRunner.query(`
        INSERT INTO "factura" ("puntoVenta", "tipoCbte", "nroCbte", "fechaCbte", "impTotal", "docNro", "clientId", "userId", cae, "vtoCae", "createdAt")
        VALUES 
          (1, 11, 1, '2026-05-26', 10000.00, $1, $3, $5, '76281928374829', '2026-06-05', NOW()),
          (1, 11, 2, '2026-06-01', 50000.00, $2, $4, $5, '76281928374830', '2026-06-11', NOW())
      `, [clientsDni['Juan_dni'], clientsDni['Carlos_dni'], clients['Juan'], clients['Carlos'], userId]);

      this.logger.log(`Mock data successfully seeded for ${email}`);
    } catch (err) {
      this.logger.error(`Error seeding mock data for ${email}: ${err.message}`);
    } finally {
      await queryRunner.release();
    }
  }
}
