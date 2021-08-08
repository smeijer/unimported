import { Preset } from '../config';
import nodePreset from './node';

const preset: Preset = {
  name: 'vue',
  isMatch: ({ hasPackage }) => hasPackage('vue'),
  getConfig: async (options) => {
    const base = await nodePreset.getConfig(options);
    const extensions = base.extensions as string[];

    return {
      ...base,
      extensions: [...extensions, '.vue'],
      ignoreUnused: [...base.ignoreUnused, 'vue'],
    };
  },
};

export default preset;
