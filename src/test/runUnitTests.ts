import * as cp from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

const sourceTestRoot = path.resolve(__dirname, '..', '..', 'src', 'test');
const compiledTestRoot = __dirname;

const testFiles = fs
  .readdirSync(sourceTestRoot)
  .filter(file => file.endsWith('.test.ts'))
  .map(file => path.join(compiledTestRoot, file.replace(/\.ts$/, '.js')));

const result = cp.spawnSync(process.execPath, ['--test', ...testFiles], {
  stdio: 'inherit'
});

process.exit(result.status ?? 1);
