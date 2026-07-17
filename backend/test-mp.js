import { MercadoPagoConfig, PreApproval } from 'mercadopago';

async function test() {
  const accessToken = 'APP_USR-3175613659266918-031202-2a4bf4b1b48522f75dd81023ac9b0f66-383952449';
  const client = new MercadoPagoConfig({ accessToken, options: { timeout: 5000 } });
  const preApproval = new PreApproval(client);

  try {
      const result = await preApproval.create({
          body: {
             reason: 'LexSaaS Pro',
             external_reference: 'test-user-id',
             payer_email: 'test_user_123@testuser.com',
             auto_recurring: {
                 frequency: 1,
                 frequency_type: 'months',
                 transaction_amount: 15000,
                 currency_id: 'ARS',
             },
             back_url: 'http://localhost:4200/subscription/success',
             status: 'pending'
          }
      });
      console.log('Success:', result);
  } catch (error) {
      console.error('Error Details:', error.message);
      if (error.cause) console.error('Cause:', error.cause);
      if (error.response) console.error('Response:', JSON.stringify(error.response, null, 2));
  }
}

test();
