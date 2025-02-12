/* This file has been initially implemented to draw everything on canvas.
 * Commented codes are used to draw pattern, background image on canvas with blur support.
 * It was all good until I realized that CSS based solution was slightly faster than playing around with 2d non-webgl canvases.
 * So that's why the entire file is commented
 */

import type { FC } from '../../lib/teact/teact';
import React, {
  memo, useEffect, useMemo, useRef,
} from '../../lib/teact/teact';

import type { ApiWallpaper } from '../../api/types';
import type useCustomBackground from '../../hooks/useCustomBackground';

import { requestMutation } from '../../lib/fasterdom/fasterdom';
import buildClassName from '../../util/buildClassName';
import buildStyle from '../../util/buildStyle';
import ChatBackgroundGradientRenderer,
{
  getColorsFromWallPaper, HEIGHT as gradientCanvasHeight, WIDTH as gradientCanvasWidth,
} from '../../util/gradientRenderer';

// import windowSize from '../../util/windowSize';
// import useDebouncedCallback from '../../hooks/useDebouncedCallback';
// import useEffectOnce from '../../hooks/useEffectOnce';
// import useResizeObserver from '../../hooks/useResizeObserver';
import './ChatBackground.scss';

type OwnProps = {
  className?: string;
  customBackgroundValue?: ReturnType<typeof useCustomBackground>;
  isBackgroundBlurred?: boolean;
  backgroundColorValue?: string;
  patternColorValue?: string;
};

type StateProps = {};

let gradientRenderer: ReturnType<typeof ChatBackgroundGradientRenderer.create> | undefined;
export const getWallpaperGradientRenderer = () => gradientRenderer?.gradientRenderer;

const ChatBackground: FC<OwnProps & StateProps> = ({
  className,
  customBackgroundValue,
  backgroundColorValue,
  // isBackgroundBlurred,
}) => {
  // eslint-disable-next-line no-null/no-null
  const bgContainerRef = useRef<HTMLDivElement | null>(null);

  // eslint-disable-next-line no-null/no-null
  // const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // eslint-disable-next-line no-null/no-null
  const gradientCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // eslint-disable-next-line no-null/no-null
  // const imageRef = useRef<HTMLImageElement | null>(null);

  const isDarkTheme = useMemo(() => customBackgroundValue?.theme === 'dark', [customBackgroundValue?.theme]);

  const isDefault = useMemo(() => customBackgroundValue?.default, [customBackgroundValue?.default]);

  const customBackground = useMemo(() => {
    if (customBackgroundValue?.wallpaper || customBackgroundValue?.background) return customBackgroundValue;

    if (customBackgroundValue?.default) {
      if (isDarkTheme) {
        return {
          background: undefined,
          theme: customBackgroundValue.theme,
          default: true,
          wallpaper: {
            document: undefined,
            slug: 'default',
            pattern: true,
            settings: {
              intensity: -50,
              backgroundColor: 0xfec496,
              secondBackgroundColor: 0xdd6cb9,
              thirdBackgroundColor: 0x962fbf,
              fourthBackgroundColor: 0x4f5bd5,
            },
          },
        };
      } else {
        return {
          background: undefined,
          theme: customBackgroundValue.theme,
          default: true,
          wallpaper: {
            document: undefined,
            slug: 'default',
            pattern: true,
            settings: {
              intensity: 50,
              backgroundColor: 0xdbddbb,
              secondBackgroundColor: 0x6ba587,
              thirdBackgroundColor: 0xd5d88d,
              fourthBackgroundColor: 0x88b884,
            },
          },
        };
      }
    }

    return undefined;
  }, [customBackgroundValue, isDarkTheme]);

  const isPlainColor = useMemo(() => backgroundColorValue, [backgroundColorValue]);

  const isWallpaper = useMemo(() => {
    return (
      !isPlainColor
      && customBackground?.wallpaper
      && typeof customBackground.wallpaper === 'object'
    );
  }, [isPlainColor, customBackground?.wallpaper]);

  const isPattern = useMemo(() => {
    return (
      isWallpaper
      && (customBackground?.wallpaper as ApiWallpaper).pattern
    );
  }, [customBackground, isWallpaper]);

  const intensity = useMemo(() => {
    return isWallpaper ? (customBackground?.wallpaper as ApiWallpaper).settings?.intensity
    && (customBackground?.wallpaper as ApiWallpaper).settings!.intensity! / 100 : undefined;
  }, [customBackground?.wallpaper, isWallpaper]);

  const isDarkPattern = useMemo(() => {
    if (!isPattern) return false;
    if (isDarkTheme) return true;
    return (!!intensity && intensity < 0);
  }, [intensity, isDarkTheme, isPattern]);

  const opacity = useMemo(() => {
    if (!isWallpaper) return 1;

    let opacityMax = 1;
    if (intensity && (isDarkTheme || isPattern)) {
      opacityMax = Math.abs(intensity) * (isDarkPattern ? 0.5 : 1);

      if (!isPattern) {
        opacityMax = Math.max(0.3, 1 - intensity);
      } else if (isDarkPattern) {
        opacityMax = Math.max(0.3, opacityMax);
      } else if (isDarkTheme) {
        opacityMax = 1;
      }
    }
    return opacityMax;
  }, [intensity, isDarkPattern, isDarkTheme, isPattern, isWallpaper]);

  const opacityTarget = useMemo<'gradient' | 'image'>(() => {
    if (intensity && (isDarkTheme || isPattern)) {
      return isDarkPattern ? 'gradient' : 'image';
    }
    return 'image';
  }, [intensity, isDarkPattern, isDarkTheme, isPattern]);

  const background = useMemo(() => {
    const expression = /url\((.*)\)/;

    if (
      !customBackground?.background
      || !expression.test(customBackground.background ?? '')
    ) return undefined;

    const match = customBackground.background.match(expression);
    if (match) return match[1];
    return undefined;
  }, [customBackground?.background]);

  useEffect(() => {
    if (isPattern && gradientCanvasRef.current) {
      requestMutation(() => {
        const colors = getColorsFromWallPaper(customBackground?.wallpaper as ApiWallpaper);
        gradientCanvasRef.current?.setAttribute('data-colors', colors);
        gradientCanvasRef.current!.width = gradientCanvasWidth;
        gradientCanvasRef.current!.height = gradientCanvasHeight;
        const renderer = ChatBackgroundGradientRenderer.create(colors, gradientCanvasRef.current!);
        gradientRenderer = renderer;
      });
    }

    return () => {
      gradientRenderer = undefined;
    };
  }, [isPattern, gradientCanvasRef, customBackground?.wallpaper]);

  // const patternDrawCallback = useCallback(() => {
  //   if (canvasRef.current && imageRef.current && isPattern && !isDefault) {
  //     const {
  //       width: canvasWidth,
  //       height: canvasHeight,
  //     } = canvasRef.current;

  //     const {
  //       width: imageWidth,
  //       height: imageHeight,
  //     } = imageRef.current;

  //     const dpr = Math.min(2, window.devicePixelRatio);

  //     const patternHeight = (500 + (windowSize.get().height / 2.5)) * dpr;
  //     const ratio = patternHeight / imageHeight;
  //     const patternImageWidth = imageWidth * ratio;
  //     const patternImageHeight = patternHeight;

  //     const ctx = canvasRef.current.getContext('2d');
  //     if (!ctx) return;
  //     ctx.globalCompositeOperation = 'source-over';

  //     if (isDarkPattern) {
  //       ctx.fillStyle = '#000';
  //       ctx.fillRect(0, 0, canvasWidth, canvasHeight);
  //       ctx.globalCompositeOperation = 'destination-out';
  //     } else {
  //       ctx.clearRect(0, 0, canvasWidth, canvasHeight);
  //     }

  //     const d = (y: number) => {
  //       if (!imageRef.current) return;
  //       for (let x = 0; x < canvasWidth; x += patternImageWidth) {
  //         ctx.drawImage(imageRef.current, x, y, patternImageWidth, patternImageHeight);
  //       }
  //     };

  //     const centerY = (canvasHeight - patternImageHeight) / 2;
  //     d(centerY);

  //     if (centerY > 0) {
  //       let topY = centerY;
  //       do {
  //         d(topY -= patternImageHeight);
  //       } while (topY >= 0);
  //     }

  //     const endY = canvasHeight - 1;
  //     for (let bottomY = centerY + patternImageHeight; bottomY < endY; bottomY += patternImageHeight) {
  //       d(bottomY);
  //     }
  //   }
  // }, [isDarkPattern, isDefault, isPattern]);

  // const imageDrawCallback = useCallback(() => {
  //   if (!isWallpaper) return;

  //   if (isPattern) {
  //     patternDrawCallback();
  //     return;
  //   }

  //   if (canvasRef.current && imageRef.current) {
  //     const {
  //       width: canvasWidth,
  //       height: canvasHeight,
  //     } = canvasRef.current;

  //     const {
  //       width: imageWidth,
  //       height: imageHeight,
  //     } = imageRef.current;

  //     const scale = Math.max(canvasWidth / imageWidth, canvasHeight / imageHeight);

  //     const newWidth = imageWidth * scale;
  //     const newHeight = imageHeight * scale;

  //     const offsetX = (canvasWidth - newWidth) / 2;
  //     const offsetY = (canvasHeight - newHeight) / 2;

  //     const ctx = canvasRef.current.getContext('2d');
  //     if (!ctx) return;
  //     ctx.globalCompositeOperation = 'source-over';
  //     ctx.drawImage(imageRef.current, offsetX, offsetY, newWidth, newHeight);
  //   }
  // }, [isWallpaper, isPattern, patternDrawCallback]);

  // const canvasResizeCallback = useCallback((measureOnly?: boolean) => {
  //   const { width, height } = bgContainerRef.current!.getBoundingClientRect();

  //   requestMutation(() => {
  //     if (canvasRef.current && bgContainerRef.current) {
  //       canvasRef.current.width = width;
  //       canvasRef.current.height = height;
  //       if (!measureOnly) {
  //         imageDrawCallback();
  //       }
  //     }
  //   });
  // }, [imageDrawCallback]);

  // const canvasResizeCallbackDebounced = useDebouncedCallback(
  //   () => canvasResizeCallback(),
  //   [canvasResizeCallback],
  //   1e2,
  //   true,
  // );

  // useResizeObserver(bgContainerRef, canvasResizeCallbackDebounced);

  // useEffect(() => {
  //   if (
  //     !background
  //     || !canvasRef.current
  //   ) return;

  //   imageRef.current = new Image();
  //   imageRef.current.addEventListener('load', imageDrawCallback);
  //   imageRef.current.src = background;
  // }, [background, imageDrawCallback]);

  // const imageCanvasClasses = buildClassName(
  //   isPattern && 'pattern',
  //   isDarkPattern && 'dark-pattern',
  //   isWallpaper && 'wallpaper',
  //   isWallpaper && !isPattern && isBackgroundBlurred && 'blurred',
  // );

  // useEffectOnce(() => canvasResizeCallback(true));

  const styles = buildStyle(
    background && `--wallpaper-pattern-image: url(${background})`,
    !isPattern && customBackground?.background && `--custom-background: ${customBackground.background}`,
    isPlainColor && `--theme-background-color: ${backgroundColorValue}`,
  );

  return (
    <div
      id="ChatBackgroundContainer"
      ref={bgContainerRef}
      className={buildClassName(
        className,
        isPattern && 'pattern',
        isDarkPattern && 'dark-pattern',
        isDefault && 'default',
        isPlainColor && 'plain',
      )}
      style={styles}
    >
      {
        (isPattern)
        && (
          <canvas
            ref={gradientCanvasRef}
            style={`opacity: ${(opacityTarget === 'gradient' ? opacity : (isDarkPattern ? 0.3 : 1)).toString()}`}
          />
        )
      }
      {/* {!isDefault && (
        <canvas
          ref={canvasRef}
          className={imageCanvasClasses}
          style={`opacity: ${(opacityTarget === 'image' ? opacity : 1).toString()}`}
        />
      )} */}
      {/* {
        (isBackgroundBlurred && !isPattern) && <div className="blurred" />
      } */}
    </div>
  );
};

export default memo(ChatBackground);
