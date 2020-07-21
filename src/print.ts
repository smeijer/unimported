import termSize from 'term-size';
import chalk from 'chalk';
import { Context } from './index';
import { ProcessedResult } from './process';

const { columns } = termSize();

export function formatList(caption: string, records: string[]): string {
  const gutterWidth = Math.max(4, `${records.length + 1}`.length + 1);
  const colWidth = columns - gutterWidth - 2;

  const lines = [
    chalk.grey('─'.repeat(gutterWidth + 1) + '┬' + '─'.repeat(colWidth)),
    chalk.grey(' '.repeat(gutterWidth + 1) + '│ ') + chalk.whiteBright(caption),
    chalk.grey('─'.repeat(gutterWidth + 1) + '┼' + '─'.repeat(colWidth)),
    ...records.map(
      (file, idx) =>
        chalk.grey(`${idx + 1}`.padStart(gutterWidth, ' ') + ' │ ') +
        chalk.white(file),
    ),
    chalk.grey('─'.repeat(gutterWidth + 1) + '┴' + '─'.repeat(colWidth)),
  ];

  return `\n${lines.join('\n')}\n`;
}

export function formatMetaTable(
  caption: string,
  data: { unresolved: string[]; unimported: string[]; unused: string[] },
  context: Context,
): string {
  const records = [
    ...context.entry.map<[string, string]>((x, idx) => [
      `entry file ${context.entry.length > 1 ? idx + 1 : ''}`,
      x.substr(context.cwd.length + 1),
    ]),
    ['', ''],
    ['unresolved imports', data.unresolved.length],
    ['unused dependencies', data.unused.length],
    ['unimported files', data.unimported.length],
  ] as [string, string][];

  const space = ' '.repeat(6);
  const width = records.reduce((max, next) => Math.max(max, next[0].length), 0);

  const divider = chalk.grey('─'.repeat(columns));

  const lines = [
    `${space} ${caption}               ${chalk.grey(
      'unimported v' + context.version,
    )}`,
    divider,
    ...records.reduce<string[]>((acc, [label, value]) => {
      acc.push(label ? `${space} ${label.padEnd(width, ' ')} : ${value}` : '');
      return acc;
    }, []),
  ];

  return `\n${lines.join('\n')}\n`;
}

export function printResults(result: ProcessedResult, context: Context): void {
  if (result.clean) {
    console.log(
      chalk.greenBright(`✓`) +
        chalk.white(" There don't seem to be any unimported files."),
    );
    return;
  }

  const { unresolved, unused, unimported } = result;

  // render
  console.log(
    formatMetaTable(
      chalk.greenBright(`summary`),
      { unresolved, unused, unimported },
      context,
    ),
  );

  if (unresolved.length > 0) {
    console.log(
      formatList(
        chalk.redBright(`${unresolved.length} unresolved imports`),
        unresolved,
      ),
    );
  }

  if (unused.length > 0) {
    console.log(
      formatList(
        chalk.blueBright(`${unused.length} unused dependencies`),
        unused,
      ),
    );
  }

  if (unimported.length > 0) {
    console.log(
      formatList(
        chalk.cyanBright(`${unimported.length} unimported files`),
        unimported,
      ),
    );
  }
}
