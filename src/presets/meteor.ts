import { Preset } from '../config';
import nodePreset from './node';
import { typedBoolean } from '../meta';

const preset: Preset = {
  name: 'meteor',
  isMatch: ({ packageJson }) => Boolean(packageJson.meteor?.mainModule),
  getConfig: async (options) => {
    const base = await nodePreset.getConfig(options);
    const mainModule = options.packageJson.meteor?.mainModule;
    const entry = [mainModule?.client, mainModule?.server].filter(typedBoolean);

    return {
      ...base,
      entry,
      ignorePatterns: [
        ...(base.ignorePatterns as string[]),
        'packages/**',
        'public/**',
        'private/**',
        'tests/**',
      ],
      ignoreUnused: [
        ...base.ignoreUnused,
        '@babel/runtime',
        'meteor-node-stubs',
      ],
    };
  },
};

export default preset;
