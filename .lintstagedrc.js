// .lintstagedrc.js
module.exports = {
  '**/*.ts': (files) => [
    `tsc --noEmit`,
    `eslint --quiet --fix ${files.join(' ')}`,
    'jest --passWithNoTests',
  ],
  '**/*.md': (files) => [`prettier --write ${files.join(' ')}`],
};
