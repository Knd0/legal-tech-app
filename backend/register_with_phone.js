const http = require('http');

const data = JSON.stringify({
    phoneNumber: '5491112345678' // Test number
});

// We need an endpoint to update user, or I can just use raw SQL/TypeORM if I had access, 
// but since I don't have a direct "update user" endpoint exposed for public, 
// I will create a temporary script in NestJS context OR just add a temporary endpoint.
// Actually, I can't easily update the user without an endpoint.
// Strategy: I'll use the existing 'register' endpoint to create a NEW user with phone, 
// OR I will assume the user will register with phone.
// Let's create a NEW user "whatsapp@estudio.com" with a phone number for testing.

const postData = JSON.stringify({
    email: 'whatsapp@estudio.com',
    password: 'password123',
    fullName: 'WhatsApp User',
    role: 'USER',
    phoneNumber: '5493454044738' // User's likely number based on context or a placeholder
});

const options = {
    hostname: 'localhost',
    port: 3000,
    path: '/auth/register',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Content-Length': postData.length
    }
};

const req = http.request(options, (res) => {
    res.on('data', (d) => {
        process.stdout.write(d);
    });
});

req.on('error', (error) => {
    console.error(error);
});

req.write(postData);
req.end();
