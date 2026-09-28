const { spawnSync } = require('child_process');
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const testUrl = (process.env.TEST_DATABASE_URL || '').trim();
if (!testUrl) {
  console.error(
    'TEST_DATABASE_URL is missing. Point it at a practice database. This command does not use the live DATABASE_URL.',
  );
  process.exit(1);
}

const root = path.join(__dirname, '..', '..');
const env = { ...process.env, DATABASE_URL: testUrl, TEST_DATABASE_URL: testUrl };

function run(prefix, script) {
  const result = spawnSync('npm', ['--prefix', prefix, 'run', script], {
    cwd: root,
    env,
    stdio: 'inherit',
    shell: true,
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

run('backend', 'db:setup');
run('backend', 'build');
run('frontend', 'build');
run('backend', 'typecheck');
run('backend', 'test');
run('backend', 'test:ai-eval');
run('backend', 'test:db');
