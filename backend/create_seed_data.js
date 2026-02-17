const http = require('http');

function postRequest(path, data) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'localhost',
            port: 3000,
            path: path,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(data)
            }
        };

        const req = http.request(options, (res) => {
            let body = '';
            res.on('data', (chunk) => body += chunk);
            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    resolve(JSON.parse(body));
                } else {
                    reject(`Request to ${path} failed with status ${res.statusCode}: ${body}`);
                }
            });
        });

        req.on('error', (e) => reject(`Problem with request: ${e.message}`));
        req.write(data);
        req.end();
    });
}

async function seed() {
    try {
        console.log('Creating Client...');
        const clientData = JSON.stringify({
            nombre: 'Cliente',
            apellido: 'Prueba',
            dni: '12345678',
            email: 'test@test.com',
            telefono: '1234567890'
        });
        const client = await postRequest('/clients', clientData);
        console.log('Client Created:', client.id);

        console.log('Creating Expediente...');
        const expedienteData = JSON.stringify({
            nroExpediente: 'EXP-2026-001',
            caratula: 'Prueba vs Prueba s/ Daños',
            fuero: 'Civil',
            juzgado: 'Juzgado 1',
            fechaInicio: '2026-01-01',
            estado: 'INICIADO',
            clienteId: client.id
        });
        const expediente = await postRequest('/expedientes', expedienteData);
        console.log('Expediente Created:', expediente.id);

        console.log('>>> UUID TO USE:', expediente.id);

    } catch (error) {
        console.error('Error seeding data:', error);
    }
}

seed();
