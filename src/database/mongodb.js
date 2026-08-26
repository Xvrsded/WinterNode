import mongoose from 'mongoose';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

export const connectDatabase = async () => {
  try {
    logger.info('Connecting to MongoDB...');
    await mongoose.connect(env.mongodb.uri);
    logger.info('MongoDB connected');
  } catch (error) {
    logger.error('Failed to connect to MongoDB');
    process.exit(1);
  }
};

export const disconnectDatabase = async () => {
  try {
    await mongoose.disconnect();
    logger.info('MongoDB disconnected');
  } catch (error) {
    logger.error('Error disconnecting from MongoDB');
  }
};
