import Debug from 'debug';

const log = {
  debug: Debug('unimported:debug'),
  info: Debug('unimported'),
  enabled: () => Debug.enabled('unimported'),
};

export { log };
