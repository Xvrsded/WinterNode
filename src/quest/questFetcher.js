import { env } from '../config/env.js';

const TIMEOUT_MS = 10000;
const BASE_URL = env.quest.apiUrl;

const createFetchOptions = () => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);
  return {
    headers: {
      'Accept': 'application/json',
      'User-Agent': 'DiscordQuestNotifier/1.0'
    },
    signal: controller.signal,
    timeoutId
  };
};

const handleFetch = async (endpoint) => {
  const options = createFetchOptions();
  try {
    const response = await fetch(`${BASE_URL}${endpoint}`, {
      headers: options.headers,
      signal: options.signal
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    return {
      status: response.status,
      contentType: response.headers.get('content-type'),
      data
    };
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error('Request timed out');
    }
    throw error;
  } finally {
    clearTimeout(options.timeoutId);
  }
};

let customMockFetcher = null;
export const setMockQuestFetcher = (mockFn) => {
  customMockFetcher = mockFn;
};

export const fetchQuests = async () => {
  if (customMockFetcher) return customMockFetcher();
  return handleFetch('/api/quests');
};
export const fetchRegions = () => handleFetch('/api/regions');
export const fetchChangelogs = () => handleFetch('/api/changelogs');
