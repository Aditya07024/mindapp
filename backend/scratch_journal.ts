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
    
    // Find all journal entries
    const entries = await db.collection('journalentries').find({}).toArray();
    console.log(`Found ${entries.length} total journal entries in database:`);
    for (const e of entries) {
      console.log(`- ID: ${e._id}, userId: ${e.userId}, situation: ${e.situation}, createdAt: ${e.createdAt}`);
    }
    
    await mongoose.disconnect();
    console.log("Disconnected from MongoDB");
  })
  .catch(err => {
    console.error("Mongoose connection error:", err);
  });
