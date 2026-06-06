const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

try {
  const devVarsPath = path.join(__dirname, '.dev.vars');
  if (!fs.existsSync(devVarsPath)) {
    console.error('.dev.vars file not found!');
    process.exit(1);
  }

  const lines = fs.readFileSync(devVarsPath, 'utf8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    
    const key = trimmed.substring(0, eqIdx).trim();
    const val = trimmed.substring(eqIdx + 1).trim();
    
    console.log(`Uploading secret: ${key}...`);
    try {
      execSync(`npx wrangler secret put ${key}`, {
        input: val,
        stdio: ['pipe', 'inherit', 'inherit']
      });
      console.log(`Successfully uploaded: ${key}`);
    } catch (err) {
      console.error(`Failed to upload ${key}:`, err.message);
    }
  }
} catch (e) {
  console.error('Error:', e);
  process.exit(1);
}
