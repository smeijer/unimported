import { expandGlob, Preset } from '../config';
import nodePreset from './node';
import { exists } from '../fs';

const preset: Preset = {
  name: 'next',
  isMatch: ({ hasPackage }) => hasPackage('next'),
  getConfig: async (options) => {
    const base = await nodePreset.getConfig(options);

    const entry = [
      './pages/**/*.{js,jsx,ts,tsx}',
      './src/pages/**/*.{js,jsx,ts,tsx}',
    ];

    return {
      ...base,
      entry,
      ignoreUnused: [
        ...(base.ignoreUnused as string[]),
        'next',
        'react',
        'react-dom',
      ],
    };
  },
};

export default preset;
