import { Preset } from '../config';
import nodePreset from './node';
import { list, resolveFilesSync } from '../fs';
import { typedBoolean } from '../meta';

function getEntry(target: string, rootExtensions: string[]) {
  const extensions = [
    ...rootExtensions.map((e) => `.${target}${e}`),
    ...rootExtensions.map((e) => `.native${e}`),
    ...rootExtensions,
  ];

  const [file] = resolveFilesSync(['./index'], extensions);

  if (!file) {
    return;
  }

  return {
    file,
    label: target,
    extend: {
      extensions: extensions,
    },
  };
}
const preset: Preset = {
  name: 'react-native',
  isMatch: ({ hasPackage }) => hasPackage('react-native'),
  getConfig: async (options) => {
    const base = await nodePreset.getConfig(options);
    const extensions = base.extensions as string[];

    const entry = [
      getEntry('android', extensions),
      getEntry('ios', extensions),
    ].filter(typedBoolean);

    return {
      ...base,
      entry,
      ignoreUnused: [
        ...base.ignoreUnused,
        'react',
        'react-dom',
        'react-native',
      ],
    };
  },
};

export default preset;
