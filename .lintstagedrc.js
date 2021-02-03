module.exports = {
  // not possible to run tests that use child_process.exec() inside husky,
  // error: "Opening `/dev/tty` failed (6): Device not configured"
  '**/*.ts': (files) => [`npm run lint`],
  '**/*.md': (files) => [`prettier --write ${files.join(' ')}`],
};
