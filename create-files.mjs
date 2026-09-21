const fs = require('fs');
const path = require('path');

function write(rel, content) {
  const full = path.resolve(rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content);
  console.log('OK:', rel);
}

const base = 'src/app/api/servers/[id]';
const auth = 'src/app/api/auth';

// Create directories
['actions', 'console', 'metrics', 'players', 'plugins', 'properties', 'schedules'].forEach(d => {
  fs.mkdirSync(path.resolve(base, d), { recursive: true });
});
fs.mkdirSync(path.resolve(auth, 'sessions'), { recursive: true });
fs.mkdirSync(path.resolve(auth, 'password'), { recursive: true });

console.log('Directories created, now writing files...');
