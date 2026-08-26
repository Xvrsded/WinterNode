import https from 'https';

const API_URL = process.env.QUEST_API_URL || 'https://api.discordquest.com';

const fetchJson = (endpoint) => {
  return new Promise((resolve, reject) => {
    https.get(`${API_URL}${endpoint}`, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(JSON.parse(data));
          } else {
            resolve(null);
          }
        } catch (e) {
          resolve(null);
        }
      });
    }).on('error', reject);
  });
};

const searchKeys = ['application_id', 'applicationid', 'app_id', 'appid', 'client_id', 'store_application_id', 'shop_application_id'];

const findAppId = (obj, path = '') => {
  let results = [];
  if (!obj || typeof obj !== 'object') return results;
  
  if (Array.isArray(obj)) {
    obj.forEach((item, idx) => {
      results.push(...findAppId(item, `${path}[${idx}]`));
    });
  } else {
    for (const [key, value] of Object.entries(obj)) {
      if (searchKeys.includes(key.toLowerCase()) || key.toLowerCase().includes('application')) {
        results.push({ path: `${path}.${key}`, value });
      }
      results.push(...findAppId(value, `${path}.${key}`));
    }
  }
  return results;
};

const run = async () => {
  const endpoints = ['/api/collectibles', '/api/csp', '/api/profile-effects', '/api/frames', '/api/quests'];
  
  for (const endpoint of endpoints) {
    console.log(`Fetching ${endpoint}...`);
    try {
      const data = await fetchJson(endpoint);
      if (data) {
        const found = findAppId(data);
        if (found.length > 0) {
          console.log(`Found app ids in ${endpoint}:`);
          const uniqueValues = new Set();
          found.forEach(f => {
            if (typeof f.value !== 'object') {
                uniqueValues.add(`${f.path} = ${f.value}`);
            }
          });
          Array.from(uniqueValues).slice(0, 20).forEach(v => console.log('  ', v));
        } else {
          console.log(`No application id fields found in ${endpoint}`);
        }
      } else {
         console.log(`Failed or empty response for ${endpoint}`);
      }
    } catch (e) {
      console.log(`Error on ${endpoint}: ${e.message}`);
    }
  }
};

run();
