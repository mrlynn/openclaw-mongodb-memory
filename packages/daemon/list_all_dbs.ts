import { MongoClient } from 'mongodb';

async function main() {
  const uri = process.env.MONGODB_URI!;
  const client = new MongoClient(uri);
  
  await client.connect();
  
  const admin = client.db().admin();
  const dbs = await admin.listDatabases();
  
  console.log('All databases:');
  for (const db of dbs.databases) {
    const dbClient = client.db(db.name);
    let memCount = 0;
    try {
      memCount = await dbClient.collection('memories').countDocuments({});
    } catch (e) {
      // Collection might not exist
    }
    console.log(`  ${db.name}: ${memCount} total memories`);
  }
  
  await client.close();
}

main();
