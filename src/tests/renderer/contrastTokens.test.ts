/**
 * Contrast guard for the semantic design tokens (UX-205).
 *
 * The T2 migration moved UI colors to semantic tokens (`--success`,
 * `--warning`, `--info`, `--destructive`, ...). Those tokens are rendered as
 * text on neutral surfaces and as soft `bg-{token}/10` badges, and their
 * `-foreground` pair is rendered as text on the solid token surface. All of
 * these must meet WCAG-AA (>= 4.5:1) for normal text. A future palette tweak
 * could silently break that, so this guard parses the raw `:root` / `.dark`
 * blocks in index.css and recomputes the ratios deterministically.
 *
 * The CSS path is resolved from this file's location (not process.cwd()) so it
 * keeps working regardless of the runner's working directory.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

type RGB = [number, number, number];

const TOKENS = ['destructive', 'success', 'warning', 'info'] as const;
const AA = 4.5;

const CSS = readFileSync(new URL('../../renderer/index.css', import.meta.url), 'utf8');

/** Extract `--name: <h> <s>% <l>%;` declarations from a CSS block into a Map. */
function extractTokens(blockName: string): Map<string, string> {
  const escaped = blockName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const block = new RegExp(`${escaped}\\s*\\{([^}]*)\\}`).exec(CSS);
  if (!block) throw new Error(`CSS block not found: ${blockName}`);

  const map = new Map<string, string>();
  const line = /--([a-z0-9-]+):\s*([0-9.]+)\s+([0-9.]+)%\s+([0-9.]+)%\s*;/gi;
  let match: RegExpExecArray | null;
  while ((match = line.exec(block[1])) !== null) {
    map.set(match[1], `${match[2]} ${match[3]}% ${match[4]}%`);
  }
  return map;
}

function parseHsl(raw: string): [number, number, number] {
  const match = /^([0-9.]+)\s+([0-9.]+)%\s+([0-9.]+)%$/.exec(raw);
  if (!match) throw new Error(`Cannot parse HSL value: ${raw}`);
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

function hslToRgb(h: number, s: number, l: number): RGB {
  const sN = s / 100;
  const lN = l / 100;
  const c = (1 - Math.abs(2 * lN - 1)) * sN;
  const hp = (((h % 360) + 360) % 360) / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  let r = 0;
  let g = 0;
  let b = 0;
  if (hp < 1) {
    r = c;
    g = x;
  } else if (hp < 2) {
    r = x;
    g = c;
  } else if (hp < 3) {
    g = c;
    b = x;
  } else if (hp < 4) {
    g = x;
    b = c;
  } else if (hp < 5) {
    r = x;
    b = c;
  } else {
    r = c;
    b = x;
  }
  const m = lN - c / 2;
  return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
}

function relativeLuminance([r, g, b]: RGB): number {
  const channel = (value: number): number => {
    const c = value / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function contrastRatio(a: RGB, b: RGB): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const hi = Math.max(la, lb);
  const lo = Math.min(la, lb);
  return (hi + 0.05) / (lo + 0.05);
}

/** Source-over alpha compositing with rounded channels. */
function blend(fg: RGB, bg: RGB, alpha: number): RGB {
  return [
    Math.round(fg[0] * alpha + bg[0] * (1 - alpha)),
    Math.round(fg[1] * alpha + bg[1] * (1 - alpha)),
    Math.round(fg[2] * alpha + bg[2] * (1 - alpha))
  ];
}

const LIGHT = extractTokens(':root');
const DARK = extractTokens('.dark');

function describeMode(mode: 'light' | 'dark', vars: Map<string, string>): void {
  const rgb = (name: string): RGB => {
    const raw = vars.get(name);
    if (!raw) throw new Error(`Unknown token in ${mode} mode: --${name}`);
    return hslToRgb(...parseHsl(raw));
  };
  const contrast = (fg: string, bg: RGB): number => contrastRatio(rgb(fg), bg);

  describe(`${mode} mode`, () => {
    for (const token of TOKENS) {
      it(`--${token} text on background reaches AA`, () => {
        expect(contrast(token, rgb('background'))).toBeGreaterThanOrEqual(AA);
      });
      it(`--${token} text on card reaches AA`, () => {
        expect(contrast(token, rgb('card'))).toBeGreaterThanOrEqual(AA);
      });
      it(`--${token} text on muted reaches AA`, () => {
        expect(contrast(token, rgb('muted'))).toBeGreaterThanOrEqual(AA);
      });
      it(`--${token} text on its bg-${token}/10 badge reaches AA`, () => {
        expect(contrast(token, blend(rgb(token), rgb('background'), 0.1))).toBeGreaterThanOrEqual(AA);
      });
      it(`--${token}-foreground text on solid --${token} reaches AA`, () => {
        expect(contrast(`${token}-foreground`, rgb(token))).toBeGreaterThanOrEqual(AA);
      });
    }
    it('--muted-foreground text on muted reaches AA', () => {
      expect(contrast('muted-foreground', rgb('muted'))).toBeGreaterThanOrEqual(AA);
    });
  });
}

describeMode('light', LIGHT);
describeMode('dark', DARK);
