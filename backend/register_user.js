const http = require('http');

const data = JSON.stringify({
    email: 'admin@estudio.com',
    password: 'admin123',
    fullName: 'Admin Legal',
    role: 'ADMIN'
});

const options = {
    hostname: 'localhost',
    port: 3000,
    path: '/auth/register',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length
    }
};

const req = http.request(options, (res) => {
    console.log(`StatusCode: ${res.statusCode}`);

    res.on('data', (d) => {
        process.stdout.write(d);
    });
});

req.on('error', (error) => {
    console.error(error);
});

req.write(data);
req.end();
