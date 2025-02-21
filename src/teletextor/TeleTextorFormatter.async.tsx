import type { FC } from '../../../../lib/teact/teact';
import React from '../../../../lib/teact/teact';

import type { OwnProps } from './TeleTextorFormatter';

import { Bundles } from '../../../../util/moduleLoader';

import useModuleLoader from '../../../../hooks/useModuleLoader';

const TeleTextorFormatterAsync: FC<OwnProps> = (props) => {
  const TeleTextorFormatter = useModuleLoader(Bundles.Extra, 'TeleTextorFormatter');

  // eslint-disable-next-line react/jsx-props-no-spreading
  return TeleTextorFormatter ? <TeleTextorFormatter {...props} /> : undefined;
};

export default TeleTextorFormatterAsync;
