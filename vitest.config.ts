import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
    oxc: {
        jsx: {
            runtime: 'automatic',
        },
    },
    test: {
        environment: 'node',
        include: ['src/**/*.test.{ts,tsx}'],
    },
    resolve: {
        alias: {
            '@': path.resolve(__dirname, 'src'),
        },
    },
});
