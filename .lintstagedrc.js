// .lintstagedrc.js
module.exports = {
  '**/*.ts': (files) => [`tsc --noEmit`, `eslint --quiet --fix ${files.join(' ')}`],
  '**/*.md': (files) => [`prettier --write ${files.join(' ')}`],
}
