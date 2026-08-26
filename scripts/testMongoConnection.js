import { connectDatabase, disconnectDatabase } from '../src/database/mongodb.js';
import mongoose from 'mongoose';

const run = async () => {
  try {
    console.log('========================================');
    console.log('MONGODB CONNECTION TEST');
    console.log('========================================');
    
    await connectDatabase();
    
    if (mongoose.connection && mongoose.connection.db) {
      const dbName = mongoose.connection.db.databaseName;
      console.log('Connection: SUCCESS');
      console.log(`Database: ${dbName}`);
    } else {
      console.log('Connection: FAILED');
      console.log('Reason: Database connection object not ready');
    }
    
  } catch (error) {
    console.log('Connection: FAILED');
    console.log(`Error type: ${error.name}`);
    console.log(`Reason: ${error.message}`);
  } finally {
    await disconnectDatabase();
    console.log('========================================');
  }
};

run();
