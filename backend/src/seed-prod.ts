import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { UsersService } from './users/users.service';
import { Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const logger = new Logger('SeedProdManual');
  const usersService = app.get(UsersService);
  const dataSource = app.get(DataSource);
  const queryRunner = dataSource.createQueryRunner();

  try {
    logger.log('Starting manual production seed script...');
    
    // Find or create multifranco0@gmail.com
    const email = 'multifranco0@gmail.com';
    let user = await usersService.findOneByEmail(email);
    let userId: string;
    
    if (!user) {
      logger.log(`User ${email} not found. Creating default test account...`);
      user = await usersService.createUser({
        email: email,
        password: 'password123',
        fullName: 'Franco de Iriondo',
        role: 'USER',
        isActive: true,
        subscriptionStatus: 'active'
      });
      userId = user.id;
      logger.log(`Test user created with ID: ${userId}`);
    } else {
      userId = user.id;
      logger.log(`Test user already exists with ID: ${userId}`);
      
      if (user.subscription?.subscriptionStatus !== 'active') {
        await usersService.updateSubscription(userId, { subscriptionStatus: 'active' });
        logger.log(`Updated test user subscription status to active.`);
      }
    }

    await queryRunner.connect();
    
    // Clear existing mock data for this user to make it a clean reset/seed
    logger.log("Clearing existing mock data for this user...");
    await queryRunner.query('DELETE FROM "factura" WHERE "userId" = $1', [userId]);
    await queryRunner.query('DELETE FROM "movimiento" WHERE "userId" = $1', [userId]);
    await queryRunner.query('DELETE FROM "deadline" WHERE "userId" = $1', [userId]);
    await queryRunner.query('DELETE FROM "calendar_event" WHERE "userId" = $1', [userId]);
    await queryRunner.query('DELETE FROM "expediente" WHERE "userId" = $1', [userId]);
    await queryRunner.query('DELETE FROM "client" WHERE "userId" = $1', [userId]);
    logger.log("Existing mock data cleared.");

    logger.log('Inserting mock clients...');
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

    logger.log('Inserting mock expedientes...');
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

    logger.log('Inserting mock deadlines...');
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

    logger.log('Inserting mock calendar events...');
    const tomorrow = new Date('2026-06-06T10:00:00Z');
    const inThreeDays = new Date('2026-06-08T09:30:00Z');

    await queryRunner.query(`
      INSERT INTO "calendar_event" (titulo, descripcion, fecha, "fechaFin", tipo, color, "userId", "createdAt")
      VALUES 
        ('Reunión de preparación de testigos', 'Preparación de la declaración del cliente y testigos para la audiencia.', $1, null, 'REUNION', '#3b82f6', $3, NOW()),
        ('Audiencia preliminar', 'Asistencia presencial al juzgado por el caso Perez c/ Seguros S.A.', $2, null, 'OTRO', '#ef4444', $3, NOW())
    `, [tomorrow, inThreeDays, userId]);

    logger.log('Inserting mock financial movements...');
    await queryRunner.query(`
      INSERT INTO "movimiento" (descripcion, monto, tipo, unidad, estado, fecha, "clientId", "expedienteId", "userId", "createdAt")
      VALUES 
        ('Gastos de inicio de demanda y tasa de justicia', 10000.00, 'GASTO', 'PESOS', 'PAGADO', '2026-05-15', $1, $3, $5, NOW()),
        ('Honorarios por redacción de demanda', 150000.00, 'HONORARIO', 'PESOS', 'PENDIENTE', '2026-05-20', $1, $3, $5, NOW()),
        ('Adelanto de gastos para perito médico', 35000.00, 'GASTO', 'PESOS', 'PAGADO', '2026-05-25', $2, $4, $5, NOW()),
        ('Adelanto de honorarios profesionales', 50000.00, 'HONORARIO', 'PESOS', 'PAGADO', '2026-05-30', $2, $4, $5, NOW())
    `, [clients['Juan'], clients['Carlos'], exps['EXP-101/2026'], exps['EXP-303/2026'], userId]);

    logger.log('Inserting mock invoices...');
    await queryRunner.query(`
      INSERT INTO "factura" ("puntoVenta", "tipoCbte", "nroCbte", "fechaCbte", "impTotal", "docNro", "clientId", "userId", cae, "vtoCae", "createdAt")
      VALUES 
        (1, 11, 1, '2026-05-26', 10000.00, $1, $3, $5, '76281928374829', '2026-06-05', NOW()),
        (1, 11, 2, '2026-06-01', 50000.00, $2, $4, $5, '76281928374830', '2026-06-11', NOW())
    `, [clientsDni['Juan_dni'], clientsDni['Carlos_dni'], clients['Juan'], clients['Carlos'], userId]);

    logger.log('Manual production database seeding completed successfully!');
  } catch (error) {
    logger.error('Error seeding production database', error);
  } finally {
    await queryRunner.release();
    await app.close();
  }
}

bootstrap();
