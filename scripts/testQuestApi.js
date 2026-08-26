import { fetchQuests, fetchRegions, fetchChangelogs } from '../src/quest/questFetcher.js';

const inspectResponse = (name, response) => {
  console.log(`\n--- Inspecting ${name} ---`);
  console.log(`[INFO] Status: ${response.status}`);
  console.log(`[INFO] Content-Type: ${response.contentType}`);
  
  const { data } = response;
  const type = Array.isArray(data) ? 'array' : typeof data;
  console.log(`[INFO] Top-level type: ${type}`);
  
  if (type === 'object' && data !== null) {
    console.log(`[INFO] Top-level keys: ${Object.keys(data).join(', ')}`);
  }
  
  if (type === 'array') {
    console.log(`[INFO] Collection size: ${data.length}`);
    if (data.length > 0) {
      console.log(`[INFO] Sample object keys: ${Object.keys(data[0]).join(', ')}`);
      console.log(`[INFO] Sample object preview:\n${JSON.stringify(data[0], null, 2).substring(0, 1000)}...`);
    }
  } else if (type === 'object' && data !== null) {
    for (const key of Object.keys(data)) {
      if (Array.isArray(data[key])) {
        console.log(`[INFO] '${key}' array length: ${data[key].length}`);
        if (data[key].length > 0) {
           console.log(`[INFO] Sample object keys in '${key}': ${Object.keys(data[key][0]).join(', ')}`);
           console.log(`[INFO] Sample object preview in '${key}':\n${JSON.stringify(data[key][0], null, 2).substring(0, 1000)}...`);
        }
      }
    }
  }
};

const run = async () => {
  try {
    console.log('Testing /api/quests...');
    const questsResponse = await fetchQuests();
    inspectResponse('Quests', questsResponse);
  } catch (e) {
    console.error(`[ERROR] fetchQuests failed: ${e.message}`);
  }

  try {
    console.log('\nTesting /api/regions...');
    const regionsResponse = await fetchRegions();
    inspectResponse('Regions', regionsResponse);
  } catch (e) {
    console.error(`[ERROR] fetchRegions failed: ${e.message}`);
  }

  try {
    console.log('\nTesting /api/changelogs...');
    const changelogsResponse = await fetchChangelogs();
    inspectResponse('Changelogs', changelogsResponse);
  } catch (e) {
    console.error(`[ERROR] fetchChangelogs failed: ${e.message}`);
  }
};

run();
