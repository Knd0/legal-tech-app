import { MercadopagoController } from './mercadopago.controller';

/**
 * `POST /mercadopago/simulate-payment` activa una suscripción sin cobrar.
 * Tiene que estar apagado salvo que se habilite a propósito.
 */
describe('MercadopagoController.simulatePayment', () => {
  const ORIGINAL = process.env.ENABLE_PAYMENT_SIMULATION;

  function makeRes() {
    const res: any = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res;
  }

  function makeController() {
    const mpService = { simulateSubscriptionPayment: jest.fn().mockResolvedValue({ success: true }) };
    const controller = new (MercadopagoController as any)(mpService);
    return { controller, mpService };
  }

  afterEach(() => {
    if (ORIGINAL === undefined) delete process.env.ENABLE_PAYMENT_SIMULATION;
    else process.env.ENABLE_PAYMENT_SIMULATION = ORIGINAL;
  });

  it('responde 404 y no toca la suscripción si la simulación no está habilitada', async () => {
    delete process.env.ENABLE_PAYMENT_SIMULATION;
    const { controller, mpService } = makeController();
    const res = makeRes();

    await controller.simulatePayment({ user: { userId: 'u1' } }, 'pro', res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(mpService.simulateSubscriptionPayment).not.toHaveBeenCalled();
  });

  it('sólo simula cuando ENABLE_PAYMENT_SIMULATION=true', async () => {
    process.env.ENABLE_PAYMENT_SIMULATION = 'true';
    const { controller, mpService } = makeController();
    const res = makeRes();

    await controller.simulatePayment({ user: { userId: 'u1' } }, 'pro', res);

    expect(mpService.simulateSubscriptionPayment).toHaveBeenCalledWith('u1', 'pro');
    expect(res.status).toHaveBeenCalledWith(200);
  });
});
