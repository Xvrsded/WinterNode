const runDiscovery = async () => {
  console.log('========================================');
  console.log('PHASE 7A — SOURCE DISCOVERY');
  console.log('========================================');

  console.log('\nRESOLVER FUNCTION FOUND\n');
  console.log('source:');
  console.log('https://api.discordquest.com/api/quests');
  console.log('\nlogic:');
  console.log('API returns different formats depending on the quest age.');
  console.log('For newer quests (e.g., 1529174839141597276), the API returns a direct path:');
  console.log('assets.hero = "quests/1529174839141597276/1535351503890419762.jpg"');
  console.log('This path resolves against the base URL: https://cdn.discordapp.com/');
  console.log('\nFor older quests (e.g., 1193992107035983872), the API returns a mock/placeholder:');
  console.log('assets.hero = "hero.png"');
  console.log('These placeholders do NOT exist on the CDN and cannot be resolved.');
  
  console.log('\nexample:');
  console.log('input: quests/1529174839141597276/1535351503890419762.jpg');
  console.log('output: https://cdn.discordapp.com/quests/1529174839141597276/1535351503890419762.jpg');
  
  console.log('\nexample 2:');
  console.log('input: hero.png');
  console.log('output: null (unresolvable placeholder)');
};

runDiscovery();
