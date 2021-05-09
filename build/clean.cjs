let rimraf = require("rimraf");
let scriptDirs = [
  "dist",
];

scriptDirs.forEach(dir => {
  rimraf(dir, [], () => {
    console.log(`${dir} removed`)
  })
});
