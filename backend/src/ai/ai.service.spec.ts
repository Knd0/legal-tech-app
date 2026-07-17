import { Test, TestingModule } from '@nestjs/testing';
import { AiService } from './ai.service';
import { ConfigService } from '@nestjs/config';
import { ExpedientesService } from '../expedientes/expedientes.service';
import { LegalModelsService } from '../legal-models/legal-models.service';
import { DocumentsService } from '../documents/documents.service';
import { of } from 'rxjs';
import OpenAI from 'openai';

jest.mock('openai', () => {
  return jest.fn().mockImplementation(() => {
    return {
      chat: {
        completions: {
          create: jest.fn().mockResolvedValue({
            choices: [
              {
                message: {
                  content: 'Análisis legal de prueba simulado.',
                },
              },
            ],
          }),
        },
      },
    };
  });
});

describe('AiService', () => {
  let service: AiService;
  let configServiceMock: any;

  const createService = async (env: { [key: string]: string }) => {
    configServiceMock = {
      get: jest.fn((key: string) => env[key]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AiService,
        {
          provide: ConfigService,
          useValue: configServiceMock,
        },
        {
          provide: ExpedientesService,
          useValue: {
            findOne: jest.fn().mockResolvedValue({
              id: 'exp-1',
              caratula: 'Perez c/ Gomez',
              nroExpediente: '123/2026',
              juzgado: 'Civ. 5',
              fuero: 'Civil',
              cliente: { nombre: 'Juan Perez', cuitDni: '20-12345678-9' },
              contraparte: 'Maria Gomez',
              estado: 'INICIADO',
            }),
          },
        },
        {
          provide: LegalModelsService,
          useValue: {
            findOne: jest.fn().mockResolvedValue({
              id: 'model-1',
              title: 'Modelo de Amparo',
              content: 'Contenido del modelo...',
            }),
          },
        },
        {
          provide: DocumentsService,
          useValue: {
            findOne: jest.fn().mockResolvedValue({
              id: 'doc-1',
              fileName: 'document.pdf',
              url: 'http://cloudinary/document.pdf',
            }),
          },
        },
      ],
    }).compile();

    service = module.get<AiService>(AiService);
  };

  it('should return mock info message when AI_ENABLED is false', async () => {
    await createService({ AI_ENABLED: 'false', OPENAI_API_KEY: 'mock-key' });
    const result = await service.analyze('Texto de prueba', 'Análisis');

    expect(result.analysis).toContain('[MÓDULO IA DESACTIVADO]');
    expect(result.analysis).toContain('Copilot no está configurado');
  });

  it('should return mock info message when OPENAI_API_KEY is not set', async () => {
    await createService({ AI_ENABLED: 'true', OPENAI_API_KEY: '' });
    const result = await service.analyze('Texto de prueba', 'Análisis');

    expect(result.analysis).toContain('[MÓDULO IA DESACTIVADO]');
  });

  it('should call OpenAI API when AI_ENABLED is true and API key is set', async () => {
    await createService({ AI_ENABLED: 'true', OPENAI_API_KEY: 'sk-1234567890' });
    const result = await service.analyze('Revisar cláusula de indemnización', 'Cláusula');

    expect(result.analysis).toBe('Análisis legal de prueba simulado.');
  });

  it('should call generateAIResponse and return cost analysis', async () => {
    await createService({ AI_ENABLED: 'true', OPENAI_API_KEY: 'sk-1234567890' });
    const result = await service.analyzeCosts({
      montoReclamo: 1000000,
      jurisdiccion: 'pba',
      tipoProceso: 'civil',
      requiereMediacion: true,
      requierePerito: false,
      cantidadNotificaciones: 3,
      valorJus: 37000,
      valorUma: 80000,
      extraDetails: 'Instrucciones extra'
    });

    expect(result.analysis).toBe('Análisis legal de prueba simulado.');
  });
});
