# unimported

**Find unused source files in javascript / typescript projects.**

![screenshot of unimported results](./docs/unimported.png)

While adding new code to our projects, we might forget to remove the old code. Linters warn us for unused code in a module, but they fail to report unused files.

`unimported` analyzes your code by following the require/import statements starting from your entry file.

The result is a report showing which files are unimported, which dependencies are missing from your `package.json`, and which dependencies can be removed from your `package.json`.

## Usage

Run the following command in the root of your project (next to `package.json`). The result will be as shown under [example](#example)

```shell
npx unimported
```

When running unimported from a directory that doesn't contain a `package.json`, it will run from the first parent directory that does. To override this behavior, and run from an alternative work directory, use the `[cwd]` positional argument:

```
npx unimported ~/dev/leaflet-geosearch
```

By providing the path as argument, unimported will start looking for the project root, starting at that location.

## Options

Output all options in your terminal:

```shell
npx unimported --help
```

### Init

This option will write the default ignore patterns to the `.unimportedrc.json` settings files. This will enable you to easily adjust them to your needs.

```shell
npx unimported --init
```

### Update

Update, will write the current results to the ignore lists in `.unimportedrc.json`. You want to use this option **after running and verifying** a full scan. Ignore lists are used to ignore certain false positives that could not be resolved properly. This is especially useful when running `unimported` on a regular basis, or for example as part of a CI pipeline.

```shell
npx unimported --update
```

### Fix

Running with the `--fix` argument will automatically remove unimported files from your project. This is a destructive action, so make sure that any changes you find important, are committed to your repo.

```shell
npx unimported --fix
```

### Flow Type

By default, flow types are stripped from files containing the `@flow` pragma. When the `--flow` argument is provided, types will be stripped from all files, regardless of the pragma. This flag defaults to false, but when `flow-bin` is detected in one of the dependency lists in `package.json`.

```shell
npx unimported --flow
```

## CI Usage

You can drop in `npx unimported` into your CI. It will fail if it finds any unimported files that are not explicitly set up in the `unimported` config file.

### Cache

Unimported uses a caching system to speed up recurring checks. This cache can be disabled using `--no-cache`. Note that the cache should only be disabled if you are experiencing caching related problems.

```shell
npx unimported --no-cache
```

If you need to clear the cache, use `--clear-cache`.

### Clear Cache

Delete the cache file and then exits without running. Note that clearing the cache will reduce performance.

```shell
npx unimported --clear-cache
```

### Show Config

Show the runtime config and then exists without running. The config displayed is a working copy created by merging arguments, your config file, and the applied preset.

```shell
npx unimported --show-config
```

### Show Preset

Show the preset being used and then exists without running. Note that presets are dynamic and based on your project structure. The same preset can show a different setup for different projects based on the installed packages and available files.

```shell
npx unimported --show-preset react
```

Omit the preset name to get a list of available presets.

```shell
npx unimported --show-preset
```

### Example Config File

Save the file as `.unimportedrc.json` in the root of your project (next to `package.json`)

```json
{
  "entry": ["src/main.ts", "src/pages/**/*.{js,ts}"],
  "extensions": [".ts", ".js"],
  "ignorePatterns": ["**/node_modules/**", "private/**"],
  "ignoreUnresolved": ["some-npm-dependency"],
  "ignoreUnimported": ["src/i18n/locales/en.ts", "src/i18n/locales/nl.ts"],
  "ignoreUnused": ["bcrypt", "create-emotion"],
  "respectGitignore": true,
  "scannedDirs": ["./modules"]
}
```

**Custom module directory**
You can also add an optional `moduleDirectory` option to your configuration file to resolve dependencies from other directories than `node_modules`. This setting defaults to `node_modules`.

```json
{
  "moduleDirectory": ["node_modules", "src/app"]
}
```

**Custom aliases**
If you wish to use aliases to import your modules & these can't be imported
directly (e.g. `tsconfig.json` in the case of Typescript or `jsconfig.json` if you have one), there is an option `aliases` to provide the correct path mapping:

```json
{
  "aliases": {
    "@components/*": ["./components", "./components/*"]
  }
}
```

_Note:_ you may wish to also add the `rootDir` option to specify the base path to
start looking for the aliases from:

```json
{
  "rootDir": "./src"
}
```

**Path transformations**
If you wish to transform paths before module resolution, there is an option `pathTransforms` to specify regex search patterns and corresponding replacement values. Search patterns will be applied with the global flag and should **_not_** be enclosed by `/` characters. Replacement values support all special replacement patterns supported by [String.prototype.replaceAll()](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/replaceAll#specifying_a_string_as_a_parameter).

Here is an example for transforming the extension for relative imports from ".js" to ".ts" (this is useful for TypeScript projects configured to output pure ESM).

```json
{
  "pathTransforms": {
    "(\\..+)\\.js$": "$1.ts"
  }
}
```

**Scanned dirs**
By default the unimported files are only scanned from dir `./src`. If you also wish to scan files outside `./src`, add other dirs in the option `scannedDirs`:

```json
{
  "scannedDirs": ["./modules", "./lib"]
}
```

## Report

The report will look something like [below](#example). When a particular check didn't have any positive results, it's section will be excluded from the output.

### summary

Summary displays a quick overview of the results, showing the entry points that were used, and some statistics about the outcome.

### unresolved imports

These import statements could not be resolved. This can either be a reference to a local file. Or to a `node_module`. In case of a node module, it can be that nothing is wrong. Maybe you're importing only types from a `DefinitelyTyped` package. But as `unimported` only compares against `dependencies`, it can also be that you've added your module to the `devDependencies`, and that's a problem.

To ignore specific results, add them to `.unimportedrc.json#ignoreUnresolved`.

### unused dependencies

Some dependencies that are declared in your package.json, were not imported by your code. It should be possible to remove those packages from your project.

But, please double check. Maybe you need to move some dependencies to `devDependencies`, or maybe it's a peer-dependency from another package. These are hints that something might be wrong. It's no guarantee.

To ignore specific results, add them to `.unimportedrc.json#ignoreUnused`.

### unimported files

The files listed under `unimported files`, are the files that exist in your code base, but are not part of your final bundle. It should be safe to delete those files.

For your convenience, some files are not shown, as we treat those as 'dev only' files which you might need. More about that [below](#how).

To ignore specific results, add them to `.unimportedrc.json#ignoreUnimported`.

### example

```shell
       summary
────────────────────────────────────────────────
       entry file 1        : src/client/main.js
       entry file 2        : src/server/main.js

       unresolved imports  : 2
       unused dependencies : 29
       unimported files    : 86


─────┬──────────────────────────────────────────
     │ 2 unresolved imports
─────┼──────────────────────────────────────────
   1 │ geojson
   2 │ csstype
─────┴──────────────────────────────────────────


─────┬──────────────────────────────────────────
     │ 29 unused dependencies
─────┼──────────────────────────────────────────
   1 │ @babel/polyfill
   2 │ @babel/runtime
  .. │ ...
─────┴──────────────────────────────────────────


─────┬──────────────────────────────────────────
     │ 7 unimported files
─────┼──────────────────────────────────────────
   1 │ src/common/components/Button/messages.ts
   2 │ src/common/configs/sentry/graphql.js
  .. │ ...
─────┴──────────────────────────────────────────
```

## How

`Unimported` follows your import statements starting from one or more entry files. For nextjs projects, the entry files default to `pages/**`. For Meteor projects, the entry files are read from the `package.json#meteor.mainModule` key. Meteors eager loading is not supported, as that mode will load all files within your directory, regardless of import statements.

For all other project types, the entry point is looked up in the following order:

1. `./package.json#source`
1. `./src/index`
1. `./src/main`
1. `./index`
1. `./main`
1. `./package.json#main`

The last option is most likely never what you want, as the main field often points to a `dist` folder. Analyzing a bundled asset is likely to result in false positives.

To specify custom entry points, add them to `.unimportedrc.json#entry`.

**extensions**

The resolver scans for files with the following extensions, in this specific order:

1. `.js`
1. `.jsx`
1. `.ts`
1. `.tsx`

All other files are ignored.

To specify custom extensions, add your own list to .unimportedrc.json#extensions`. Note that`unimported` won't merge settings! The custom list needs to be the full list of extension that you want to support.

**ignored**

Also ignored are files with paths matching the following patterns:

```
**/node_modules/**
**/*.tests.{js,jsx,ts,tsx}
**/*.spec.{js,jsx,ts,tsx}
```

In case `unimported` is running in a `Meteor` project, the following paths are being ignored as well:

```
packages/**
public/**
private/**
tests/**
```

To specify custom ignore paths, add your own patterns to `.unimportedrc.json#ignorePatterns`. Note that `unimported` won't merge settings! The custom list needs to be the full list of patterns that you want to ignore.

In addition `unimported` will also ignore files that match your `.gitignore` patterns. To disable this behavior, set `respectGitignore` to `false` in your `.unimportedrc.json` file.

```json
{
  "respectGitignore": false
}
```

## Troubleshooting

Common issues or known limitations of unimported.

### Export default

At this moment, we don't support the `export default from './x'` export syntax. Parsing files that contain those exports, will result in an error with a message like `'\';\' expected`. If you make use of that part of the [export default from proposal](https://github.com/tc39/proposal-export-default-from#exporting-a-default-as-default), you can consider a find/replace before running `unimported`.

Please search for:

```shell
export default from
```

and replace it with

```shell
export { default } from
```

### Unexpected results / stale cache

Please try [clearing the cache](#cache) if you have unexpected results, or keep getting the same results after changing the config file.

```shell
npx unimported --clear-cache
```

### TypeScript declaration files

If you import declaration (`.d.ts`) files in a TypeScript project you will need to add it as an extension to `.unimportedrc.json`. Otherwise you will get "unresolved imports" warnings for imported declaration files.

```json
{
  "extensions": [".ts", ".d.ts"]
}
```

## See Also

- [depcheck](https://www.npmjs.com/depcheck)
- [unrequired](https://npmjs.com/unrequired)
- [trucker](https://npmjs.com/trucker)
- [ts-unused-exports](https://www.npmjs.com/ts-unused-exports)
- [no-unused-export](https://www.npmjs.com/no-unused-export)
- [ts-prune](https://www.npmjs.com/ts-prune)

## License

[![MIT License](https://img.shields.io/apm/l/atomic-design-ui.svg?)](https://github.com/smeijer/unimported/blob/main/LICENSE)

## Contributors ✨

Thanks goes to these wonderful people ([emoji key](https://allcontributors.org/docs/en/emoji-key)):

<!-- ALL-CONTRIBUTORS-LIST:START - Do not remove or modify this section -->
<!-- prettier-ignore-start -->
<!-- markdownlint-disable -->
<table>
  <tbody>
    <tr>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/smeijer"><img src="https://avatars1.githubusercontent.com/u/1196524?v=4?s=100" width="100px;" alt="Stephan Meijer"/><br /><sub><b>Stephan Meijer</b></sub></a><br /><a href="#ideas-smeijer" title="Ideas, Planning, & Feedback">🤔</a> <a href="https://github.com/smeijer/unimported/commits?author=smeijer" title="Code">💻</a> <a href="#infra-smeijer" title="Infrastructure (Hosting, Build-Tools, etc)">🚇</a> <a href="#maintenance-smeijer" title="Maintenance">🚧</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://in.linkedin.com/in/punit-makwana/"><img src="https://avatars1.githubusercontent.com/u/16760252?v=4?s=100" width="100px;" alt="Punit Makwana"/><br /><sub><b>Punit Makwana</b></sub></a><br /><a href="https://github.com/smeijer/unimported/commits?author=punit2502" title="Documentation">📖</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/danew"><img src="https://avatars1.githubusercontent.com/u/5265684?v=4?s=100" width="100px;" alt="Dane Wilson"/><br /><sub><b>Dane Wilson</b></sub></a><br /><a href="https://github.com/smeijer/unimported/commits?author=danew" title="Code">💻</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/mpeyper"><img src="https://avatars.githubusercontent.com/u/23029903?v=4?s=100" width="100px;" alt="Michael Peyper"/><br /><sub><b>Michael Peyper</b></sub></a><br /><a href="https://github.com/smeijer/unimported/commits?author=mpeyper" title="Tests">⚠️</a> <a href="https://github.com/smeijer/unimported/commits?author=mpeyper" title="Code">💻</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/marcosvega91"><img src="https://avatars.githubusercontent.com/u/5365582?v=4?s=100" width="100px;" alt="Marco Moretti"/><br /><sub><b>Marco Moretti</b></sub></a><br /><a href="https://github.com/smeijer/unimported/commits?author=marcosvega91" title="Tests">⚠️</a></td>
      <td align="center" valign="top" width="14.28%"><a href="http://peter.hozak.info/"><img src="https://avatars.githubusercontent.com/u/1087670?v=4?s=100" width="100px;" alt="Peter Hozák"/><br /><sub><b>Peter Hozák</b></sub></a><br /><a href="https://github.com/smeijer/unimported/commits?author=Aprillion" title="Tests">⚠️</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://dev.to/jacobmgevans"><img src="https://avatars.githubusercontent.com/u/27247160?v=4?s=100" width="100px;" alt="Jacob M-G Evans"/><br /><sub><b>Jacob M-G Evans</b></sub></a><br /><a href="https://github.com/smeijer/unimported/commits?author=JacobMGEvans" title="Tests">⚠️</a></td>
    </tr>
    <tr>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/datner"><img src="https://avatars.githubusercontent.com/u/22598347?v=4?s=100" width="100px;" alt="Datner"/><br /><sub><b>Datner</b></sub></a><br /><a href="https://github.com/smeijer/unimported/commits?author=datner" title="Tests">⚠️</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/codyarose"><img src="https://avatars.githubusercontent.com/u/35306025?v=4?s=100" width="100px;" alt="Cody Rose"/><br /><sub><b>Cody Rose</b></sub></a><br /><a href="https://github.com/smeijer/unimported/commits?author=codyarose" title="Tests">⚠️</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://ahmedeldessouki-a7488.firebaseapp.com/"><img src="https://avatars.githubusercontent.com/u/44158955?v=4?s=100" width="100px;" alt="Ahmed ElDessouki"/><br /><sub><b>Ahmed ElDessouki</b></sub></a><br /><a href="https://github.com/smeijer/unimported/commits?author=AhmedEldessouki" title="Tests">⚠️</a> <a href="https://github.com/smeijer/unimported/commits?author=AhmedEldessouki" title="Code">💻</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://www.linkedin.com/in/ypazevedo/"><img src="https://avatars.githubusercontent.com/u/56167866?v=4?s=100" width="100px;" alt="Yago Pereira Azevedo"/><br /><sub><b>Yago Pereira Azevedo</b></sub></a><br /><a href="https://github.com/smeijer/unimported/commits?author=YPAzevedo" title="Tests">⚠️</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/juhanakristian"><img src="https://avatars.githubusercontent.com/u/544386?v=4?s=100" width="100px;" alt="Juhana Jauhiainen"/><br /><sub><b>Juhana Jauhiainen</b></sub></a><br /><a href="https://github.com/smeijer/unimported/commits?author=juhanakristian" title="Tests">⚠️</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/nobrayner"><img src="https://avatars.githubusercontent.com/u/40751395?v=4?s=100" width="100px;" alt="Braydon Hall"/><br /><sub><b>Braydon Hall</b></sub></a><br /><a href="https://github.com/smeijer/unimported/commits?author=nobrayner" title="Tests">⚠️</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/abeprincec"><img src="https://avatars.githubusercontent.com/u/16880975?v=4?s=100" width="100px;" alt="abeprincec"/><br /><sub><b>abeprincec</b></sub></a><br /><a href="https://github.com/smeijer/unimported/commits?author=abeprincec" title="Tests">⚠️</a></td>
    </tr>
    <tr>
      <td align="center" valign="top" width="14.28%"><a href="http://www.code-root.com/"><img src="https://avatars.githubusercontent.com/u/57859?v=4?s=100" width="100px;" alt="Lucas Westermann"/><br /><sub><b>Lucas Westermann</b></sub></a><br /><a href="https://github.com/smeijer/unimported/commits?author=lswest" title="Code">💻</a> <a href="https://github.com/smeijer/unimported/commits?author=lswest" title="Tests">⚠️</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/simonwinter"><img src="https://avatars.githubusercontent.com/u/1104537?v=4?s=100" width="100px;" alt="Simon Winter"/><br /><sub><b>Simon Winter</b></sub></a><br /><a href="https://github.com/smeijer/unimported/commits?author=simonwinter" title="Code">💻</a> <a href="https://github.com/smeijer/unimported/commits?author=simonwinter" title="Tests">⚠️</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/stovmascript"><img src="https://avatars.githubusercontent.com/u/14262802?v=4?s=100" width="100px;" alt="Martin Šťovíček"/><br /><sub><b>Martin Šťovíček</b></sub></a><br /><a href="https://github.com/smeijer/unimported/commits?author=stovmascript" title="Documentation">📖</a></td>
      <td align="center" valign="top" width="14.28%"><a href="http://www.incaseofstairs.com/"><img src="https://avatars.githubusercontent.com/u/196390?v=4?s=100" width="100px;" alt="Kevin Decker"/><br /><sub><b>Kevin Decker</b></sub></a><br /><a href="https://github.com/smeijer/unimported/commits?author=kpdecker" title="Code">💻</a> <a href="https://github.com/smeijer/unimported/commits?author=kpdecker" title="Tests">⚠️</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/olidacombe"><img src="https://avatars.githubusercontent.com/u/1752435?v=4?s=100" width="100px;" alt="olidacombe"/><br /><sub><b>olidacombe</b></sub></a><br /><a href="https://github.com/smeijer/unimported/commits?author=olidacombe" title="Code">💻</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://in.linkedin.com/in/punit-makwana/"><img src="https://avatars.githubusercontent.com/u/16760252?v=4?s=100" width="100px;" alt="Punit Makwana"/><br /><sub><b>Punit Makwana</b></sub></a><br /><a href="https://github.com/smeijer/unimported/commits?author=punitcodes" title="Documentation">📖</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/kkpalanisamy"><img src="https://avatars.githubusercontent.com/u/8186979?v=4?s=100" width="100px;" alt="Palanisamy KK"/><br /><sub><b>Palanisamy KK</b></sub></a><br /><a href="https://github.com/smeijer/unimported/commits?author=kkpalanisamy" title="Documentation">📖</a></td>
    </tr>
    <tr>
      <td align="center" valign="top" width="14.28%"><a href="https://startup-cto.net/"><img src="https://avatars.githubusercontent.com/u/3396992?v=4?s=100" width="100px;" alt="Daniel Bartholomae"/><br /><sub><b>Daniel Bartholomae</b></sub></a><br /><a href="https://github.com/smeijer/unimported/commits?author=dbartholomae" title="Documentation">📖</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://t.me/gontovnik"><img src="https://avatars.githubusercontent.com/u/3436659?v=4?s=100" width="100px;" alt="Danil Gontovnik"/><br /><sub><b>Danil Gontovnik</b></sub></a><br /><a href="https://github.com/smeijer/unimported/commits?author=gontovnik" title="Code">💻</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/jarjee"><img src="https://avatars.githubusercontent.com/u/3888305?v=4?s=100" width="100px;" alt="Nathan Smyth"/><br /><sub><b>Nathan Smyth</b></sub></a><br /><a href="https://github.com/smeijer/unimported/commits?author=jarjee" title="Code">💻</a></td>
      <td align="center" valign="top" width="14.28%"><a href="http://petersieg.me/"><img src="https://avatars.githubusercontent.com/u/3128659?v=4?s=100" width="100px;" alt="Peter Sieg"/><br /><sub><b>Peter Sieg</b></sub></a><br /><a href="https://github.com/smeijer/unimported/commits?author=chasingmaxwell" title="Code">💻</a> <a href="https://github.com/smeijer/unimported/commits?author=chasingmaxwell" title="Tests">⚠️</a></td>
      <td align="center" valign="top" width="14.28%"><a href="http://notjosh.com/"><img src="https://avatars.githubusercontent.com/u/33126?v=4?s=100" width="100px;" alt="Joshua May"/><br /><sub><b>Joshua May</b></sub></a><br /><a href="https://github.com/smeijer/unimported/commits?author=notjosh" title="Code">💻</a> <a href="https://github.com/smeijer/unimported/commits?author=notjosh" title="Tests">⚠️</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/nweber-gh"><img src="https://avatars.githubusercontent.com/u/52676728?v=4?s=100" width="100px;" alt="Nathan Weber"/><br /><sub><b>Nathan Weber</b></sub></a><br /><a href="https://github.com/smeijer/unimported/commits?author=nweber-gh" title="Code">💻</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://eatingdots.com"><img src="https://avatars.githubusercontent.com/u/1843792?v=4?s=100" width="100px;" alt="Wlad Paiva"/><br /><sub><b>Wlad Paiva</b></sub></a><br /><a href="https://github.com/smeijer/unimported/commits?author=wladiston" title="Code">💻</a></td>
    </tr>
    <tr>
      <td align="center" valign="top" width="14.28%"><a href="https://medium.com/@tbhesswebber"><img src="https://avatars.githubusercontent.com/u/28069638?v=4?s=100" width="100px;" alt="Tanner B. Hess Webber"/><br /><sub><b>Tanner B. Hess Webber</b></sub></a><br /><a href="https://github.com/smeijer/unimported/commits?author=Tbhesswebber" title="Code">💻</a></td>
      <td align="center" valign="top" width="14.28%"><a href="http://webutvikling.org/"><img src="https://avatars.githubusercontent.com/u/1502702?v=4?s=100" width="100px;" alt="Tomas Fagerbekk"/><br /><sub><b>Tomas Fagerbekk</b></sub></a><br /><a href="https://github.com/smeijer/unimported/commits?author=tomfa" title="Code">💻</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/valeriobelli"><img src="https://avatars.githubusercontent.com/u/56547421?v=4?s=100" width="100px;" alt="Valerio Belli"/><br /><sub><b>Valerio Belli</b></sub></a><br /><a href="https://github.com/smeijer/unimported/commits?author=valeriobelli" title="Code">💻</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://uloco.github.io/"><img src="https://avatars.githubusercontent.com/u/8818340?v=4?s=100" width="100px;" alt="Umut Topuzoğlu"/><br /><sub><b>Umut Topuzoğlu</b></sub></a><br /><a href="https://github.com/smeijer/unimported/commits?author=uloco" title="Code">💻</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://recollectr.io/"><img src="https://avatars.githubusercontent.com/u/6835891?v=4?s=100" width="100px;" alt="slapbox"/><br /><sub><b>slapbox</b></sub></a><br /><a href="https://github.com/smeijer/unimported/commits?author=Slapbox" title="Documentation">📖</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/Michael-372"><img src="https://avatars.githubusercontent.com/u/5233503?v=4?s=100" width="100px;" alt="Michael"/><br /><sub><b>Michael</b></sub></a><br /><a href="https://github.com/smeijer/unimported/commits?author=Michael-372" title="Code">💻</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/karlhorky"><img src="https://avatars.githubusercontent.com/u/1935696?v=4?s=100" width="100px;" alt="Karl Horky"/><br /><sub><b>Karl Horky</b></sub></a><br /><a href="https://github.com/smeijer/unimported/commits?author=karlhorky" title="Documentation">📖</a></td>
    </tr>
    <tr>
      <td align="center" valign="top" width="14.28%"><a href="https://adityavandan.github.io/"><img src="https://avatars.githubusercontent.com/u/35309453?v=4?s=100" width="100px;" alt="Aditya Vandan Sharma"/><br /><sub><b>Aditya Vandan Sharma</b></sub></a><br /><a href="https://github.com/smeijer/unimported/commits?author=AdityaVandan" title="Code">💻</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/Dogdriip"><img src="https://avatars.githubusercontent.com/u/6940439?v=4?s=100" width="100px;" alt="Aru Hyunseung Jeon"/><br /><sub><b>Aru Hyunseung Jeon</b></sub></a><br /><a href="https://github.com/smeijer/unimported/commits?author=Dogdriip" title="Code">💻</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://www.ericcornelissen.dev/"><img src="https://avatars.githubusercontent.com/u/3742559?v=4?s=100" width="100px;" alt="Eric Cornelissen"/><br /><sub><b>Eric Cornelissen</b></sub></a><br /><a href="https://github.com/smeijer/unimported/commits?author=ericcornelissen" title="Documentation">📖</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/xibman"><img src="https://avatars.githubusercontent.com/u/623141?v=4?s=100" width="100px;" alt="Georget Julien"/><br /><sub><b>Georget Julien</b></sub></a><br /><a href="https://github.com/smeijer/unimported/commits?author=xibman" title="Code">💻</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/yyamanoi1222"><img src="https://avatars.githubusercontent.com/u/17104096?v=4?s=100" width="100px;" alt="yu-yamanoi"/><br /><sub><b>yu-yamanoi</b></sub></a><br /><a href="https://github.com/smeijer/unimported/commits?author=yyamanoi1222" title="Code">💻</a> <a href="https://github.com/smeijer/unimported/commits?author=yyamanoi1222" title="Tests">⚠️</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/vimutti77"><img src="https://avatars.githubusercontent.com/u/27840664?v=4?s=100" width="100px;" alt="Vantroy"/><br /><sub><b>Vantroy</b></sub></a><br /><a href="https://github.com/smeijer/unimported/commits?author=vimutti77" title="Code">💻</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/LukaszGrela"><img src="https://avatars.githubusercontent.com/u/7643591?v=4?s=100" width="100px;" alt="Lukasz Grela"/><br /><sub><b>Lukasz Grela</b></sub></a><br /><a href="https://github.com/smeijer/unimported/commits?author=LukaszGrela" title="Code">💻</a></td>
    </tr>
    <tr>
      <td align="center" valign="top" width="14.28%"><a href="https://ryanwilsonperkin.com"><img src="https://avatars.githubusercontent.com/u/3004111?v=4?s=100" width="100px;" alt="Ryan Wilson-Perkin"/><br /><sub><b>Ryan Wilson-Perkin</b></sub></a><br /><a href="https://github.com/smeijer/unimported/commits?author=ryanwilsonperkin" title="Code">💻</a> <a href="https://github.com/smeijer/unimported/commits?author=ryanwilsonperkin" title="Tests">⚠️</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/ritingliudd01"><img src="https://avatars.githubusercontent.com/u/47513914?v=4?s=100" width="100px;" alt="Riting LIU"/><br /><sub><b>Riting LIU</b></sub></a><br /><a href="https://github.com/smeijer/unimported/commits?author=ritingliudd01" title="Code">💻</a> <a href="https://github.com/smeijer/unimported/commits?author=ritingliudd01" title="Tests">⚠️</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://fritsch.tech/"><img src="https://avatars.githubusercontent.com/u/111692684?v=4?s=100" width="100px;" alt="Lukas Fritsch"/><br /><sub><b>Lukas Fritsch</b></sub></a><br /><a href="https://github.com/smeijer/unimported/commits?author=Fritsch-Tech" title="Code">💻</a> <a href="https://github.com/smeijer/unimported/commits?author=Fritsch-Tech" title="Tests">⚠️</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/MathiasVandePol"><img src="https://avatars.githubusercontent.com/u/606681?v=4?s=100" width="100px;" alt="Mathias Van de Pol"/><br /><sub><b>Mathias Van de Pol</b></sub></a><br /><a href="https://github.com/smeijer/unimported/commits?author=MathiasVandePol" title="Code">💻</a></td>
    </tr>
  </tbody>
</table>

<!-- markdownlint-restore -->
<!-- prettier-ignore-end -->

<!-- ALL-CONTRIBUTORS-LIST:END -->

This project follows the [all-contributors](https://github.com/all-contributors/all-contributors) specification. Contributions of any kind welcome!
