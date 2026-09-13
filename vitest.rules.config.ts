import {defineConfig} from 'vitest/config';
export default defineConfig({test:{include:['tests/**/*.rules.test.ts'],environment:'node',fileParallelism:false,hookTimeout:30000,testTimeout:20000}});
