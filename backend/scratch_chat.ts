import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '.env') });

const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error("MONGODB_URI not found in .env");
  process.exit(1);
}

mongoose.connect(uri)
  .then(async () => {
    console.log("Connected to MongoDB");
    const db = mongoose.connection.db;
    
    // Find all conversations
    const convs = await db.collection('conversations').find({}).toArray();
    console.log(`Found ${convs.length} total conversations in database:`);
    for (const c of convs) {
      console.log(`- ID: ${c._id}, userId: ${c.userId}, messages: ${c.messages?.length || 0}`);
      if (c.messages && c.messages.length > 0) {
        console.log(`  Last 5 messages:`);
        for (const m of c.messages.slice(-5)) {
          console.log(`    - [${m.role}] ${m.content} (${m.timestamp})`);
        }
      }
    }
    
    await mongoose.disconnect();
    console.log("Disconnected from MongoDB");
  })
  .catch(err => {
    console.error("Mongoose connection error:", err);
  });
