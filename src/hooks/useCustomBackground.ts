import { useEffect, useState } from '../lib/teact/teact';
import { getActions } from '../global';

import type { ApiWallpaper } from '../api/types';
import type { ThemeKey } from '../types';

import {
  CUSTOM_BG_CACHE_NAME, CUSTOM_WALLPAPER_CACHE_NAME, DARK_THEME_PATTERN_COLOR, DEFAULT_PATTERN_COLOR,
} from '../config';
import * as cacheApi from '../util/cacheApi';
import { preloadImage } from '../util/files';
import { decompressTGV } from '../util/tgv';

const useCustomBackground = (theme: ThemeKey, settingValue?: string) => {
  const { setThemeSettings } = getActions();
  const [value, setValue] = useState<{
    background: string | undefined;
    wallpaper: string | undefined | ApiWallpaper;
    default?: boolean;
    theme: ThemeKey;
  }>({
    background: settingValue,
    wallpaper: undefined,
    theme,
  });

  useEffect(() => {
    if (!settingValue) {
      setValue({
        background: undefined,
        wallpaper: undefined,
        default: true,
        theme,
      });
      return;
    }

    if (settingValue.startsWith('#')) {
      setValue({
        wallpaper: undefined,
        background: settingValue,
        theme,
      });
    } else {
      cacheApi.fetch(CUSTOM_WALLPAPER_CACHE_NAME, theme, cacheApi.Type.Json)
        .then((json) => {
          cacheApi.fetch(CUSTOM_BG_CACHE_NAME, theme, cacheApi.Type.Blob)
            .then(async (blob: Blob) => {
              let url = URL.createObjectURL(blob);

              if (blob.type === 'application/x-tgwallpattern') {
                url = URL.createObjectURL(new Blob([decompressTGV(new Uint8Array(await blob.arrayBuffer()))], {
                  type: 'image/svg+xml',
                }));
              }

              preloadImage(url)
                .then(() => {
                  setValue({
                    wallpaper: json,
                    background: `url(${url})`,
                    theme,
                  });
                });
            })
            .catch(() => {
              setThemeSettings({
                theme,
                background: undefined,
                backgroundColor: undefined,
                isBlurred: true,
                patternColor: theme === 'dark' ? DARK_THEME_PATTERN_COLOR : DEFAULT_PATTERN_COLOR,
              });

              setValue({
                background: undefined,
                wallpaper: json,
                theme,
              });
            });
        });
    }
  }, [settingValue, theme]);

  return value;
};

export default useCustomBackground;
