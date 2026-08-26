import https from 'https';
import fs from 'fs';

const fetchCollectibles = () => {
  return new Promise((resolve, reject) => {
    https.get('https://api.discordquest.com/api/collectibles', (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => resolve(JSON.parse(data)));
    }).on('error', reject);
  });
};

fetchCollectibles().then(data => {
  fs.writeFileSync('collectibles_debug.json', JSON.stringify(data, null, 2));
  console.log('Saved to collectibles_debug.json');
}).catch(console.error);
