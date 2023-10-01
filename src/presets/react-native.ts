import { Preset } from '../config';
import nodePreset from './node';
import { resolveFilesSync } from '../fs';
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

function getExpo(options, rootExtensions: string[]) {
  const expoEntry = options.packageJson.main;

  if (!expoEntry) {
    return;
  }

  const [file] = resolveFilesSync([expoEntry], rootExtensions);

  if (!file) {
    return;
  }
  return {
    file,
    label: 'expo',
    extend: {
      extensions: rootExtensions,
    },
  };
}
const preset: Preset = {
  name: 'react-native',
  isMatch: ({ hasPackage }) => hasPackage('react-native'),
  getConfig: async (options) => {
    const base = await nodePreset.getConfig(options);
    const extensions = base.extensions as string[];

    const hasExpo = options.hasPackage('expo');

    const entry = [
      getEntry('android', extensions),
      getEntry('ios', extensions),
      hasExpo ? getExpo(options, extensions) : undefined,
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
