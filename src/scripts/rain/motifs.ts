/*
  Motifs are authored directly as glyph grids rather than sampled from images.

  That was the better call for three reasons: the picture ends up made of the
  same characters as the rain, so there are no two layers fighting; contrast is
  controlled by construction, so nothing ever reduces to mush the way flat key
  art would; and the whole library costs nothing to download.

  The rain scans them in — a motif is never drawn directly. It writes into the
  reveal grid, and falling heads that pass through a filled cell draw that
  character instead of noise. So the image is painted by the rain sweeping over
  it, like a CRT beam, and fades with the trails.

  Every motif must be padded to a rectangle: the engine indexes rows[y][x]
  directly and a ragged row would silently drop cells.
*/

export interface Motif {
  name: string;
  rows: string[];
  /** Sprites read better large; diagrams read better at their authored size. */
  scale?: number;
}

const M = (name: string, rows: string[], scale = 1): Motif => {
  const w = Math.max(...rows.map((r) => r.length));
  return { name, rows: rows.map((r) => r.padEnd(w, ' ')), scale };
};

export const MOTIFS: Motif[] = [
  M('invader', [
    '  █     █  ',
    '   █   █   ',
    '  ███████  ',
    ' ██ ███ ██ ',
    '███████████',
    '█ ███████ █',
    '█ █     █ █',
    '   ██ ██   ',
  ], 2),

  M('controller', [
    ' ╭─────────────╮ ',
    '╭╯   ▲      ● ●╰╮',
    '│  ◀ ┼ ▶      ● │',
    '╰╮   ▼      ●  ╭╯',
    ' ╰─────────────╯ ',
  ]),

  M('pipeline', [
    '┌─────┐   ┌───┐   ┌─────┐',
    '│ SNS ├──▶│ Q ├──▶│  λ  │',
    '└─────┘   └───┘   └──┬──┘',
    '                     ▼   ',
    '                 ╔═══════╗',
    '                 ║  DDB  ║',
    '                 ╚═══════╝',
  ]),

  M('topology', [
    '   ○───────────○   ',
    '   │╲         ╱│   ',
    '   │ ╲       ╱ │   ',
    '   │  ╲     ╱  │   ',
    '   │   ╲   ╱   │   ',
    '   │    ╲ ╱    │   ',
    '   ○─────●─────○   ',
  ]),

  M('dungeon', [
    '┌──┬─────┬──┐',
    '│░░│░░░░░│░░│',
    '├──┘░┌───┘░░│',
    '│░░░░│░░░░░░│',
    '│░┌──┴──┐░┌─┤',
    '│░│░░░░░│░│░│',
    '└─┴─────┴─┴─┘',
  ]),

  M('heart', [
    ' ██   ██ ',
    '████ ████',
    '█████████',
    ' ███████ ',
    '  █████  ',
    '   ███   ',
    '    █    ',
  ], 2),

  M('state-machine', [
    '┌──────┐      ┌───────┐',
    '│ IDLE ├─────▶│ SEEK  │',
    '└───▲──┘      └───┬───┘',
    '    │             ▼    ',
    '┌───┴──┐      ┌───────┐',
    '│ DEAD │◀─────┤ATTACK │',
    '└──────┘      └───────┘',
  ]),

  M('load-balancer', [
    '      ┌─────┐      ',
    '      │ NLB │      ',
    '      └──┬──┘      ',
    '   ┌─────┼─────┐   ',
    '   ▼     ▼     ▼   ',
    ' ┌───┐ ┌───┐ ┌───┐ ',
    ' │ ▪ │ │ ▪ │ │ ▪ │ ',
    ' └───┘ └───┘ └───┘ ',
  ]),

  M('iso-block', [
    '    ▄▄▄▄▄▄▄    ',
    '  ▄█████████▄  ',
    '▄█████████████▄',
    '███████████████',
    '▀█████████████▀',
    '  ▀█████████▀  ',
    '    ▀▀▀▀▀▀▀    ',
  ]),

  M('ghost', [
    '   ▄▄▄▄▄▄   ',
    ' ▄████████▄ ',
    '██▄▄██▄▄████',
    '██  ██  ████',
    '████████████',
    '████████████',
    '█▀▀██▀▀██▀▀█',
  ], 2),

  M('mushroom', [
    '   ▄▄▄▄▄▄   ',
    ' ▄████████▄ ',
    '██ ██████ ██',
    '████████████',
    '▀██▄▄▄▄▄▄██▀',
    '  ██ ██ ██  ',
    '  ▀▀▀▀▀▀▀▀  ',
  ], 2),

  M('coin', [
    '  ▄▄▄▄  ',
    ' ██▀▀██ ',
    '██ ██ ██',
    '██ ██ ██',
    ' ██▄▄██ ',
    '  ▀▀▀▀  ',
  ], 2),

  M('tetromino', [
    '████████████',
    '████████████',
    '████████████',
    '    ████    ',
    '    ████    ',
    '    ████    ',
  ], 2),

  M('health-bar', [
    '┌──────────────────┐',
    '│████████████░░░░░░│',
    '└──────────────────┘',
    '   HP   75 / 100    ',
  ]),

  M('cabinet', [
    ' ▄▄▄▄▄▄▄▄▄▄ ',
    '█▀▀▀▀▀▀▀▀▀▀█',
    '█ ▄▄▄▄▄▄▄▄ █',
    '█ █▓▓▓▓▓▓█ █',
    '█ ▀▀▀▀▀▀▀▀ █',
    '█  ●  ● ●  █',
    '█▄▄▄▄▄▄▄▄▄▄█',
    '█▓▓▓▓▓▓▓▓▓▓█',
  ]),

  M('d-pad', [
    '     ▄▄▄▄     ',
    '     █▲ █     ',
    ' ▄▄▄▄█  █▄▄▄▄ ',
    ' █ ◀      ▶ █ ',
    ' ▀▀▀▀█  █▀▀▀▀ ',
    '     █ ▼█     ',
    '     ▀▀▀▀     ',
  ], 2),
];
