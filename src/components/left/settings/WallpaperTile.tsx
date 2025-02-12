import type { FC } from '../../../lib/teact/teact';
import React, {
  memo, useCallback, useEffect, useMemo, useRef,
  useState,
} from '../../../lib/teact/teact';

import type { ApiWallpaper } from '../../../api/types';
import type { ThemeKey } from '../../../types';
import { UPLOADING_WALLPAPER_SLUG } from '../../../types';

import { CUSTOM_BG_CACHE_NAME, CUSTOM_WALLPAPER_CACHE_NAME } from '../../../config';
import buildClassName from '../../../util/buildClassName';
import buildStyle from '../../../util/buildStyle';
import * as cacheApi from '../../../util/cacheApi';
import { fetchBlob } from '../../../util/files';
import ChatBackgroundGradientRenderer, { getColorsFromWallPaper } from '../../../util/gradientRenderer';

import useCanvasBlur from '../../../hooks/useCanvasBlur';
import useMedia from '../../../hooks/useMedia';
import useMediaWithLoadProgress from '../../../hooks/useMediaWithLoadProgress';
import usePreviousDeprecated from '../../../hooks/usePreviousDeprecated';
import useShowTransitionDeprecated from '../../../hooks/useShowTransitionDeprecated';

import ProgressSpinner from '../../ui/ProgressSpinner';

import './WallpaperTile.scss';

type OwnProps = {
  wallpaper: ApiWallpaper;
  theme: ThemeKey;
  isSelected: boolean;
  onClick: (slug: string) => void;
};

const WallpaperTile: FC<OwnProps> = ({
  wallpaper,
  theme,
  isSelected,
  onClick,
}) => {
  const { slug, document } = wallpaper;
  const localMediaHash = `wallpaper${document.id!}`;
  const localBlobUrl = document.previewBlobUrl;
  const previewBlobUrl = useMedia(`${localMediaHash}?size=m`);
  const thumbRef = useCanvasBlur(document.thumbnail?.dataUri, Boolean(previewBlobUrl), true);
  // eslint-disable-next-line no-null/no-null
  const gradientRef = useRef<HTMLDivElement | HTMLCanvasElement | null | undefined>(null);
  const { transitionClassNames } = useShowTransitionDeprecated(
    Boolean(previewBlobUrl || localBlobUrl),
    undefined,
    undefined,
    'slow',
  );
  const isLoadingRef = useRef(false);
  const [isLoadAllowed, setIsLoadAllowed] = useState(false);
  const {
    mediaData: fullMedia, loadProgress,
  } = useMediaWithLoadProgress(localMediaHash, !isLoadAllowed);
  const wasLoadDisabled = usePreviousDeprecated(isLoadAllowed) === false;
  const { shouldRender: shouldRenderSpinner, transitionClassNames: spinnerClassNames } = useShowTransitionDeprecated(
    (isLoadAllowed && !fullMedia) || slug === UPLOADING_WALLPAPER_SLUG,
    undefined,
    wasLoadDisabled,
    'slow',
  );
  // To prevent triggering of the effect for useCallback
  const cacheKeyRef = useRef<string>();
  cacheKeyRef.current = theme;

  const handleSelect = useCallback(() => {
    (async () => {
      const blob = await fetchBlob(fullMedia!);
      await cacheApi.save(CUSTOM_BG_CACHE_NAME, cacheKeyRef.current!, blob);
      await cacheApi.save(CUSTOM_WALLPAPER_CACHE_NAME, cacheKeyRef.current!, JSON.stringify(wallpaper));
      onClick(slug);
    })();
  }, [fullMedia, onClick, slug, wallpaper]);

  useEffect(() => {
    // If we've clicked on a wallpaper, select it when full media is loaded
    if (fullMedia && isLoadingRef.current) {
      handleSelect();
      isLoadingRef.current = false;
    }
  }, [fullMedia, handleSelect]);

  const handleClick = useCallback(() => {
    if (fullMedia) {
      handleSelect();
    } else {
      isLoadingRef.current = true;
      setIsLoadAllowed((isAllowed) => !isAllowed);
    }
  }, [fullMedia, handleSelect]);

  const className = buildClassName(
    'WallpaperTile',
    isSelected && 'selected',
  );

  useEffect(() => {
    if (!wallpaper.pattern || !wallpaper.settings) return;
    const colors = getColorsFromWallPaper(wallpaper);
    const gradientRenderer = ChatBackgroundGradientRenderer.create(colors);
    if (gradientRenderer.canvas) {
      gradientRef.current = gradientRenderer.canvas;
    }
  }, [wallpaper]);

  const intensity = useMemo(() => {
    return wallpaper.settings?.intensity ? (wallpaper.settings!.intensity / 100) : undefined;
  }, [wallpaper]);

  const isDarkPattern = useMemo(() => {
    if (!wallpaper.pattern) return false;
    // if (isDarkTheme) return true;
    return (!!intensity && intensity < 0);
  }, [intensity, wallpaper.pattern]);

  return (
    <div
      className={buildClassName(
        className, wallpaper.pattern && 'pattern', isDarkPattern && 'dark-pattern',
      )}
      onClick={handleClick}
    >
      <div className="media-inner">
        <canvas
          ref={thumbRef}
          className="thumbnail"
        />
        {wallpaper.pattern && (
          <div
            ref={(el) => el && gradientRef.current && el.appendChild(gradientRef.current)}
            className="gradient"
            style={buildStyle(isDarkPattern && `--pattern-image: url(${previewBlobUrl || localBlobUrl})`)}
          />
        )}
        <img
          src={previewBlobUrl || localBlobUrl}
          className={buildClassName('full-media', transitionClassNames)}
          alt=""
          draggable={false}
        />
        {shouldRenderSpinner && (
          <div className={buildClassName('spinner-container', spinnerClassNames)}>
            <ProgressSpinner progress={loadProgress} onClick={handleClick} />
          </div>
        )}
      </div>
    </div>
  );
};

export default memo(WallpaperTile);
