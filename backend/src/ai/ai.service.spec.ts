import { Test, TestingModule } from '@nestjs/testing';
import { AiService } from './ai.service';
import { ConfigService } from '@nestjs/config';
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
      ],
    }).compile();

    service = module.get<AiService>(AiService);
  };

  it('should return mock info message when AI_ENABLED is false', async () => {
    await createService({ AI_ENABLED: 'false', OPENAI_API_KEY: 'mock-key' });
    const result = await service.analyze('Texto de prueba', 'Análisis');

    expect(result.analysis).toContain('[MÓDULO IA DESACTIVADO]');
    expect(result.analysis).toContain('El Copiloto Legal de Inteligencia Artificial no está configurado');
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
});
