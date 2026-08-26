import { env } from '../config/env.js';
import { formatDateTime } from './time.js';

const log = (level, message) => {
  const timestamp = formatDateTime(new Date());
  console.log(`[${timestamp}] [${level}] ${message}`);
};

const errorLog = (level, message) => {
  const timestamp = formatDateTime(new Date());
  console.error(`[${timestamp}] [${level}] ${message}`);
};

export const logger = {
  info: (message) => log('INFO', message),
  warn: (message) => log('WARN', message),
  error: (message) => errorLog('ERROR', message),
  debug: (message) => {
    if (env.app.logLevel === 'debug') {
      log('DEBUG', message);
    }
  }
};
