import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.{test,spec,property}.{js,mjs}'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.js'],
    },
  },
});
