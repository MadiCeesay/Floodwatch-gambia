import { defineConfig } from 'vitest/config';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
const localMongo = process.env.ProgramFiles && join(process.env.ProgramFiles, 'MongoDB', 'Server', '8.2', 'bin', 'mongod.exe');
export default defineConfig({ test: { fileParallelism: false, hookTimeout: 180000, testTimeout: 30000,
  env: { MONGOMS_DOWNLOAD_DIR: '.cache/mongodb',
    ...(process.env.MONGOMS_SYSTEM_BINARY ? {} : localMongo && existsSync(localMongo) ? { MONGOMS_SYSTEM_BINARY: localMongo } : {}),
  },
} });
