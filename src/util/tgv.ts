import { inflate } from 'pako';

import fixFirefoxSvg from './fixFirefoxSvg';
import { IS_FIREFOX } from './windowEnvironment';

export const decompressTGV = (bytes: Uint8Array) => {
  const buffer = bytes.slice().buffer;
  const data = inflate(buffer);

  if (IS_FIREFOX) {
    const fixedSVG = fixFirefoxSvg(new TextDecoder().decode(data));
    return new TextEncoder().encode(fixedSVG);
  }

  return data;
};
