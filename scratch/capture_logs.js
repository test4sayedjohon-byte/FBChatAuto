const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

async function main() {
  const logPath = path.join(__dirname, 'tail.log');
  fs.writeFileSync(logPath, ''); // Clear existing log
  const logStream = fs.createWriteStream(logPath);

  console.log('Spawning wrangler tail...');
  const child = spawn('npx', ['wrangler', 'tail', '--format', 'json'], {
    cwd: path.join(__dirname, '..', 'worker')
  });

  child.stdout.pipe(logStream);
  child.stderr.pipe(logStream);

  setTimeout(() => {
    console.log('Stopping wrangler tail after 8 seconds...');
    child.kill('SIGINT');
    process.exit(0);
  }, 8000);
}

main();
