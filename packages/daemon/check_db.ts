import { MongoClient } from 'mongodb';

async function main() {
  const uri = process.env.MONGODB_URI!;
  const client = new MongoClient(uri);
  
  await client.connect();
  
  // Check openclaw_memory
  const openclawDb = client.db('openclaw_memory');
  const openclawCount = await openclawDb.collection('memories').countDocuments({ agentId: 'openclaw' });
  console.log(`openclaw_memory DB: ${openclawCount} openclaw memories`);
  
  // Check vai
  const vaiDb = client.db('vai');
  const vaiCount = await vaiDb.collection('memories').countDocuments({ agentId: 'openclaw' });
  console.log(`vai DB: ${vaiCount} openclaw memories`);
  
  await client.close();
}

main();
