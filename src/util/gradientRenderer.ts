/*
 * https://github.com/morethanwords/tweb/blob/b1b5be6aad26ed539d36035536c770f477a91f5e/src/components/chat/gradientRenderer.ts
 * Thanks Eduard for not using CSS solution like this guy did
 * Of course refactored to make it compatible with the codebase & linter
 */

import type { ApiWallpaper } from '../api/types';

import { animateSingle } from './animation';
import { hexToRgb } from './switchTheme';

export const WIDTH = 50;
export const HEIGHT = WIDTH;

type Point = { x: number; y: number };

export function easeOutQuadApply(v: number, c: number) {
  return -c * v * (v - 2);
}

export function getColorsFromWallPaper(wallPaper: ApiWallpaper) {
  return wallPaper.settings ? [
    wallPaper.settings.backgroundColor,
    wallPaper.settings.secondBackgroundColor,
    wallPaper.settings.thirdBackgroundColor,
    wallPaper.settings.fourthBackgroundColor,
  ].filter(Boolean).map(getHexColorFromTelegramColor).join(',') : '';
}

export function getHexColorFromTelegramColor(color: number) {
  const hex = (color < 0 ? 0xFFFFFF + color : color).toString(16);
  return `#${hex.length >= 6 ? hex : '0'.repeat(6 - hex.length) + hex}`;
}

export default class ChatBackgroundGradientRenderer {
  private readonly width = WIDTH;

  private readonly height = HEIGHT;

  private phase: number | undefined;

  private tail: number | undefined;

  private readonly tails = 90;

  private frames: ImageData[] | undefined;

  private colors: { r: number; g: number; b: number }[] | undefined;

  private readonly curve = [
    0, 0.25, 0.50, 0.75, 1, 1.5, 2, 2.5, 3, 3.5, 4, 5, 6, 7, 8, 9, 10, 11, 12,
    13, 14, 15, 16, 17, 18, 18.3, 18.6, 18.9, 19.2, 19.5, 19.8, 20.1, 20.4, 20.7,
    21.0, 21.3, 21.6, 21.9, 22.2, 22.5, 22.8, 23.1, 23.4, 23.7, 24.0, 24.3, 24.6,
    24.9, 25.2, 25.5, 25.8, 26.1, 26.3, 26.4, 26.5, 26.6, 26.7, 26.8, 26.9, 27,
  ];

  private readonly incrementalCurve: number[];

  private readonly positions: Point[] = [
    { x: 0.80, y: 0.10 },
    { x: 0.60, y: 0.20 },
    { x: 0.35, y: 0.25 },
    { x: 0.25, y: 0.60 },
    { x: 0.20, y: 0.90 },
    { x: 0.40, y: 0.80 },
    { x: 0.65, y: 0.75 },
    { x: 0.75, y: 0.40 },
  ];

  private readonly phases = this.positions.length;

  private canvas: HTMLCanvasElement | undefined;

  private ctx: CanvasRenderingContext2D | undefined;

  private hc: HTMLCanvasElement | undefined;

  private hctx: CanvasRenderingContext2D | undefined;

  private animatingToNextPosition: boolean | undefined;

  private nextPositionTail: number | undefined;

  private nextPositionTails: number | undefined;

  private nextPositionLeft: number | undefined;

  constructor() {
    const diff = this.tails / this.curve[this.curve.length - 1];

    for (let i = 0, length = this.curve.length; i < length; ++i) {
      this.curve[i] *= diff;
    }

    this.incrementalCurve = this.curve.map((v, i, arr) => {
      return v - (arr[i - 1] ?? 0);
    });
  }

  private getPositions(shift: number) {
    const positions = this.positions.slice();
    positions.push(...positions.splice(0, shift));

    const result: typeof positions = [];
    for (let i = 0; i < positions.length; i += 2) {
      result.push(positions[i]);
    }
    return result;
  }

  private getNextPositions(phase: number, curveMax: number, curve: number[]) {
    const pos = this.getPositions(phase);
    if (!curve[0] && curve.length === 1) {
      return [pos];
    }

    const nextPosition = this.getPositions(++phase % this.phases);
    const distances = nextPosition.map((np, idx) => {
      return {
        x: (np.x - pos[idx].x) / curveMax,
        y: (np.y - pos[idx].y) / curveMax,
      };
    });

    const positions = curve.map((value) => {
      return distances.map((distance, idx) => {
        return {
          x: pos[idx].x + distance.x * value,
          y: pos[idx].y + distance.y * value,
        };
      });
    });

    return positions;
  }

  private curPosition(phase: number, tail: number) {
    const positions = this.getNextPositions(phase, this.tails, [tail]);
    return positions[0];
  }

  private changeTail(diff: number) {
    this.tail! += diff;

    while (this.tail! >= this.tails) {
      this.tail! -= this.tails;
      if (++this.phase! >= this.phases) {
        this.phase! -= this.phases;
      }
    }

    while (this.tail! < 0) {
      this.tail! += this.tails;
      if (--this.phase! < 0) {
        this.phase! += this.phases;
      }
    }
  }

  private changeTailAndDraw(diff: number) {
    this.changeTail(diff);
    const curPos = this.curPosition(this.phase!, this.tail!);
    this.drawGradient(curPos);
  }

  private drawNextPositionAnimated = (getProgress?: () => number) => {
    let done: boolean; let
      id: ImageData;
    if (getProgress) {
      const value = getProgress();
      done = value >= 1;
      const transitionValue = easeOutQuadApply(value, 1);
      const nextPositionTail = this.nextPositionTail ?? 0;
      const tail = this.nextPositionTails! * transitionValue;
      this.nextPositionTail = tail;
      const diff = tail - nextPositionTail;
      if (diff) {
        this.nextPositionLeft! -= diff;
        this.changeTailAndDraw(-diff);
      }
    } else {
      const frames = this.frames;
      id = frames!.shift()!;
      done = !frames!.length;
    }

    if (id!) {
      this.drawImageData(id);
    }

    if (done) {
      this.nextPositionLeft = undefined;
      this.nextPositionTails = undefined;
      this.nextPositionTail = undefined;
      this.animatingToNextPosition = undefined;
    }

    return !done;
  };

  private getGradientImageData(positions: Point[], phase = this.phase, progress = 1 - this.tail! / this.tails) {
    const id = this.hctx!.createImageData(this.width, this.height);
    const pixels = id.data;
    const colorsLength = this.colors!.length;

    const positionsForPhase = (positionPhase: number) => {
      const result: typeof positions = [];
      for (let i = 0; i !== 4; ++i) {
        result[i] = { ...this.positions[(positionPhase + i * 2) % this.positions.length] };
        result[i].y = 1.0 - result[i].y;
      }
      return result;
    };

    const previousPhase = (phase! + 1) % this.positions.length;
    const previous = positionsForPhase(previousPhase);
    const current = positionsForPhase(phase!);

    let offset = 0;
    for (let y = 0; y < this.height; ++y) {
      const directPixelY = y / this.height;
      const centerDistanceY = directPixelY - 0.5;
      const centerDistanceY2 = centerDistanceY * centerDistanceY;
      for (let x = 0; x < this.width; ++x) {
        const directPixelX = x / this.width;
        const centerDistanceX = directPixelX - 0.5;
        const centerDistance = Math.sqrt(centerDistanceX * centerDistanceX + centerDistanceY2);

        const swirlFactor = 0.35 * centerDistance;
        const theta = swirlFactor * swirlFactor * 0.8 * 8.0;
        const sinTheta = Math.sin(theta);
        const cosTheta = Math.cos(theta);

        const pixelX = Math.max(0.0, Math.min(1.0, 0.5 + centerDistanceX * cosTheta - centerDistanceY * sinTheta));
        const pixelY = Math.max(0.0, Math.min(1.0, 0.5 + centerDistanceX * sinTheta + centerDistanceY * cosTheta));

        let distanceSum = 0.0;
        let r = 0.0;
        let g = 0.0;
        let b = 0.0;
        for (let i = 0; i < colorsLength; ++i) {
          const colorX = previous[i].x + (current[i].x - previous[i].x) * progress;
          const colorY = previous[i].y + (current[i].y - previous[i].y) * progress;

          const distanceX = pixelX - colorX;
          const distanceY = pixelY - colorY;

          let distance = Math.max(0.0, 0.9 - Math.sqrt(distanceX * distanceX + distanceY * distanceY));
          distance *= distance * distance * distance;
          distanceSum += distance;

          r += distance * this.colors![i].r;
          g += distance * this.colors![i].g;
          b += distance * this.colors![i].b;
        }

        pixels[offset++] = r / distanceSum;
        pixels[offset++] = g / distanceSum;
        pixels[offset++] = b / distanceSum;
        pixels[offset++] = 0xFF;
      }
    }
    return id;
  }

  private drawImageData(id: ImageData) {
    this.hctx!.putImageData(id, 0, 0);
    this.ctx!.drawImage(this.hc!, 0, 0, this.width, this.height);
  }

  private drawGradient(positions: Point[]) {
    this.drawImageData(this.getGradientImageData(positions));
  }

  public init(el: HTMLCanvasElement) {
    this.frames = [];
    this.phase = 0;
    this.tail = 0;

    const colors = el.getAttribute('data-colors')!.split(',');
    this.colors = colors.map((color) => {
      return hexToRgb(color);
    });

    if (!this.hc) {
      this.hc = document.createElement('canvas');
      this.hc.width = this.width;
      this.hc.height = this.height;
      this.hctx = this.hc.getContext('2d', { alpha: false })!;
    }

    this.canvas = el;
    this.ctx = this.canvas.getContext('2d', { alpha: false })!;
    this.update();
  }

  private update() {
    if (this.colors!.length < 2) {
      const color = this.colors![0];
      this.ctx!.fillStyle = `rgb(${color.r}, ${color.g}, ${color.b})`;
      this.ctx!.fillRect(0, 0, this.width, this.height);
      return;
    }

    const position = this.curPosition(this.phase!, this.tail!);
    this.drawGradient(position);
  }

  public toNextPosition(getProgress?: () => number) {
    if (this.colors!.length < 2) {
      return;
    }

    if (getProgress) {
      this.nextPositionLeft = this.tails + (this.nextPositionLeft ?? 0);
      this.nextPositionTails = this.nextPositionLeft;
      this.nextPositionTail = undefined;
      this.animatingToNextPosition = true;
      animateSingle(this.drawNextPositionAnimated.bind(this, getProgress), requestAnimationFrame);
      return;
    }

    const tail = this.tail;
    const tails = this.tails;

    let nextPhaseOnIdx: number;

    const curve: number[] = [];
    for (let i = 0, length = this.incrementalCurve.length; i < length; ++i) {
      const inc = this.incrementalCurve[i];
      let value = (curve[i - 1] ?? tail) + inc;

      if (Number(value.toFixed(2)) > tails && nextPhaseOnIdx! === undefined) {
        nextPhaseOnIdx = i;
        value %= tails;
      }

      curve.push(value);
    }

    const currentPhaseCurve = curve.slice(0, nextPhaseOnIdx!);
    const nextPhaseCurve = nextPhaseOnIdx! !== undefined ? curve.slice(nextPhaseOnIdx) : [];

    [currentPhaseCurve, nextPhaseCurve].forEach((crv, idx, curves) => {
      const last = crv[crv.length - 1];
      if (last !== undefined && last > tails) {
        crv[crv.length - 1] = Number(last.toFixed(2));
      }

      this.tail = last ?? 0;

      if (!crv.length) {
        return;
      }

      const positions = this.getNextPositions(this.phase!, tails, crv);
      if (idx !== (curves.length - 1)) {
        if (++this.phase! >= this.phases) {
          this.phase! -= this.phases;
        }
      }

      const ids = positions.map((pos) => {
        return this.getGradientImageData(pos);
      });

      this.frames!.push(...ids);
    });

    this.animatingToNextPosition = true;
    animateSingle(this.drawNextPositionAnimated, requestAnimationFrame);
  }

  public static createCanvas(colors?: string) {
    const canvas = document.createElement('canvas');
    canvas.width = WIDTH;
    canvas.height = HEIGHT;
    if (colors !== undefined) {
      canvas.dataset.colors = colors;
    }

    return canvas;
  }

  public static create(colors?: string, canvas?: HTMLCanvasElement) {
    canvas = canvas ?? this.createCanvas(colors);
    const gradientRenderer = new ChatBackgroundGradientRenderer();
    gradientRenderer.init(canvas);

    return { gradientRenderer, canvas };
  }
}
