import https from 'https';

const cache = new Map();

let customMockResolver = null;
export const setMockQuestHeroResolver = (mockFn) => {
  customMockResolver = mockFn;
};

export const resolveQuestHero = async (assetValue) => {
  if (customMockResolver) return customMockResolver(assetValue);
  
  if (!assetValue) return { valid: false, reason: 'missing_hero' };

  let resolvedUrl = assetValue;
  if (!assetValue.startsWith('http://') && !assetValue.startsWith('https://')) {
    if (assetValue === 'hero.png' || assetValue === 'game_tile.png' || assetValue === 'game_logotype.png' || assetValue === 'PLACEHOLDER') {
      return { valid: false, reason: 'missing_hero' };
    }
    
    if (assetValue.startsWith('quests/')) {
      resolvedUrl = `https://cdn.discordapp.com/${assetValue}`;
    } else if (!assetValue.includes('/')) {
      // Unresolvable filename
      return { valid: false, reason: 'missing_hero' };
    } else {
      resolvedUrl = `https://cdn.discordapp.com/${assetValue}`;
    }
  }

  if (cache.has(resolvedUrl)) {
    const cached = cache.get(resolvedUrl);
    if (cached.valid) return { valid: true, url: resolvedUrl };
    return { valid: false, reason: cached.reason };
  }

  try {
    const result = await new Promise((resolve) => {
      const req = https.request(resolvedUrl, { method: 'HEAD', timeout: 5000 }, (res) => {
        if (res.statusCode >= 200 && res.statusCode < 400) {
          const contentType = res.headers['content-type'];
          if (contentType && (contentType === 'image/png' || contentType === 'image/jpeg' || contentType === 'image/webp' || contentType === 'image/gif')) {
            resolve({ valid: true, url: resolvedUrl });
          } else {
            resolve({ valid: false, reason: 'invalid_hero' });
          }
        } else if (res.statusCode === 404 || res.statusCode === 403) {
          resolve({ valid: false, reason: 'missing_hero' });
        } else if (res.statusCode >= 500 || res.statusCode === 429) {
          resolve({ valid: false, reason: 'network_error' });
        } else {
          resolve({ valid: false, reason: 'invalid_hero' });
        }
      });

      req.on('error', () => resolve({ valid: false, reason: 'network_error' }));
      req.on('timeout', () => {
        req.destroy();
        resolve({ valid: false, reason: 'network_error' });
      });
      req.end();
    });

    if (result.valid || result.reason === 'missing_hero' || result.reason === 'invalid_hero') {
      cache.set(resolvedUrl, result);
    }
    return result;
  } catch (error) {
    return { valid: false, reason: 'network_error' };
  }
};

export const resolveRewardAsset = async (assetValue) => {
  if (!assetValue) return null;

  if (assetValue.startsWith('http://') || assetValue.startsWith('https://')) {
    return assetValue;
  }

  // Common placeholders
  if (assetValue === 'reward.png' || assetValue === 'PLACEHOLDER') {
    return null;
  }

  // Similar logic as hero, since they're in CDN too
  let resolvedUrl = assetValue;
  if (assetValue.startsWith('quests/')) {
    resolvedUrl = `https://cdn.discordapp.com/${assetValue}`;
  } else if (!assetValue.includes('/')) {
    return null;
  } else {
    resolvedUrl = `https://cdn.discordapp.com/${assetValue}`;
  }

  if (cache.has(resolvedUrl)) {
    return cache.get(resolvedUrl) ? resolvedUrl : null;
  }

  try {
    const isValid = await new Promise((resolve) => {
      const req = https.request(resolvedUrl, { method: 'HEAD', timeout: 5000 }, (res) => {
        if (res.statusCode >= 200 && res.statusCode < 400) {
          const contentType = res.headers['content-type'];
          if (contentType && contentType.startsWith('image/')) {
            resolve(true);
          } else {
            resolve(false);
          }
        } else {
          resolve(false);
        }
      });

      req.on('error', () => resolve(false));
      req.on('timeout', () => {
        req.destroy();
        resolve(false);
      });
      req.end();
    });

    cache.set(resolvedUrl, isValid);
    return isValid ? resolvedUrl : null;
  } catch (error) {
    cache.set(resolvedUrl, false);
    return null;
  }
};
