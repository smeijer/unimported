module.exports = {
  // not possible to run tests that use child_process.exec() inside husky,
  // error: "Opening `/dev/tty` failed (6): Device not configured"
  '**/*.ts': (files) => [`npm run lint`, `npm run test`],
  '**/*.md': (files) => [`prettier --write ${files.join(' ')}`],
};
