require('dotenv').config();
const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4']);
dns.setDefaultResultOrder('ipv4first');

const { MongoClient } = require('mongodb');

const uri = process.env.MONGO_URI;
console.log('Connecting to:', uri);

const client = new MongoClient(uri);

async function run() {
  try {
    await client.connect();
    console.log('✅ Connected successfully!');
    await client.close();
  } catch (err) {
    console.log('❌ Failed:', err.message);
  }
}

run();