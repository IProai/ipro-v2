const { Client } = require('pg');

const config = {
    host: '/cloudsql/iprocore:us-central1:ipro-staging-db',
    user: 'ipro-admin',
    password: 'ipro-admin-pass-123456',
    database: 'iprocore',
};

async function test() {
    const client = new Client(config);
    try {
        await client.connect();
        console.log('✅ Connection successful');
        const res = await client.query('SELECT 1 as result');
        console.log('Query result:', res.rows[0]);
        await client.end();
    } catch (err) {
        console.error('❌ Connection failed:', err);
        process.exit(1);
    }
}

test();
