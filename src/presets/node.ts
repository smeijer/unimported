import { Preset, UnimportedConfig } from '../config';
import path from 'path';
import resolve from 'resolve';
import { typedBoolean } from '../meta';
import { resolveFilesSync } from '../fs';

const preset: Preset = {
  name: 'node',
  isMatch: ({ packageJson }) => Boolean(packageJson),
  getConfig: ({ packageJson, hasPackage }) => {
    const hasFlow = hasPackage('flow-bin');
    const extensions = ['.js', '.jsx', '.ts', '.tsx'];

    const entry = Array.from(
      new Set(
        resolveFilesSync(
          [
            packageJson.source,
            './src/index',
            './src/main',
            './index',
            './main',
            packageJson.main,
          ],
          extensions,
        ),
      ),
    ).filter(typedBoolean);

    return {
      entry,
      extensions,
      flow: hasFlow,
      ignorePatterns: [
        '**/node_modules/**',
        `**/*.tests.{js,jsx,ts,tsx}`,
        `**/*.test.{js,jsx,ts,tsx}`,
        `**/*.spec.{js,jsx,ts,tsx}`,
        `**/tests/**`,
        `**/__tests__/**`,
        `**/*.d.ts`,
      ].filter(typedBoolean),
      ignoreUnimported: [],
      ignoreUnresolved: [],
      ignoreUnused: [],
    };
  },
};

export default preset;
