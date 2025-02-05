import type { RefObject } from 'react';
import type { FC } from '../../../lib/teact/teact';
import React, {
  memo, useCallback, useEffect, useRef,
} from '../../../lib/teact/teact';

import type { IconName } from '../../../types/icons';

import { FILTER_EMOTICON_ICONS } from '../../../config';

import useFlag from '../../../hooks/useFlag';

import Icon from '../../common/icons/Icon';
import Menu from '../../ui/Menu';
import Portal from '../../ui/Portal';

import styles from './FolderIconPickerMenu.module.scss';

export type OwnProps = {
  isOpen: boolean;
  iconButtonRef: RefObject<HTMLButtonElement>;
  onIconSelect: (icon: IconName) => void;
  onClose: () => void;
};

interface StateProps {
  areFeaturedStickersLoaded?: boolean;
  isTranslucent?: boolean;
}

const FolderIconPickerMenu: FC<OwnProps & StateProps> = ({
  isOpen,
  iconButtonRef,
  onIconSelect,
  onClose,
}) => {
  const transformOriginX = useRef<number>();
  const [isContextMenuShown] = useFlag();
  useEffect(() => {
    transformOriginX.current = iconButtonRef.current!.getBoundingClientRect().right;
  }, [isOpen, iconButtonRef]);

  const handleIconSelect = useCallback((icon: IconName) => {
    onIconSelect(icon);
    onClose();
  }, [onClose, onIconSelect]);

  return (
    <Portal>
      <Menu
        isOpen={isOpen}
        positionX="right"
        bubbleClassName={styles.menuContent}
        onClose={onClose}
        transformOriginX={transformOriginX.current}
        noCloseOnBackdrop={isContextMenuShown}
      >
        <div id="folder-icon-picker-menu">
          {Object.entries(FILTER_EMOTICON_ICONS).map(([, iconName]) => (
            // eslint-disable-next-line react/jsx-no-bind
            <Icon name={iconName} onClick={() => handleIconSelect(iconName)} />
          ))}
        </div>
      </Menu>
    </Portal>
  );
};

export default memo(FolderIconPickerMenu);
