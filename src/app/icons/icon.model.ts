export type SvgStrokeLinecap = 'round' | 'butt' | 'square';
export type SvgStrokeLinejoin = 'round' | 'miter' | 'bevel';

export interface SvgIconDefinition {
  viewBox: string;
  fill?: string;
  stroke?: string;
  strokeWidth?: number | string;
  strokeLinecap?: SvgStrokeLinecap;
  strokeLinejoin?: SvgStrokeLinejoin;
  fillRule?: 'evenodd' | 'nonzero';
  clipRule?: 'evenodd' | 'nonzero';
  elements: SvgIconElement[];
}

export type SvgIconElement =
  | {
      tag: 'path';
      d: string;
      fill?: string;
      stroke?: string;
      fillRule?: string;
      clipRule?: string;
    }
  | { tag: 'line'; x1: number | string; y1: number | string; x2: number | string; y2: number | string }
  | {
      tag: 'rect';
      x: number | string;
      y: number | string;
      width: number | string;
      height: number | string;
      rx?: number | string;
    }
  | { tag: 'circle'; cx: number | string; cy: number | string; r: number | string }
  | { tag: 'polyline'; points: string };

export type IconName = keyof typeof import('./icon.definitions').icons;
