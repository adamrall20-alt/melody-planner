import { spawn } from 'node:child_process';
import path from 'node:path';
import electronPath from 'electron';

const child = spawn(String(electronPath), [path.resolve(process.cwd(), 'electron/main.cjs')], {
  stdio: 'inherit',
  env: { ...process.env, NODE_ENV: 'development' },
});

child.on('close', (code) => {
  process.exit(code ?? 0);
});
