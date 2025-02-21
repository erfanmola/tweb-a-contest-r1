/* eslint-disable react/jsx-no-bind */

import React, {
  type FC, memo, useMemo, useRef,
} from '../../../../lib/teact/teact';

import buildClassName from '../../../../util/buildClassName';
import { IS_ANDROID, IS_MOBILE } from '../../../../util/windowEnvironment';

import Portal from '../../../ui/Portal';
import TeleTextorFormatter from './TeleTextorFormatter.async';
import {
  getRichValueWithCaret, mergeEntities, parseEntities, parseMarkdown,
  placeCaretAtEnd,
  processCurrentFormatting,
} from './TeleTextorUtils';

import './TeleTextor.scss';

type TeleTextorProps = {
  placeholder?: string;
  disabled?: boolean;
  chatId: string;
};

export const logger = (...args: any) => {
  // eslint-disable-next-line no-console
  console.error('erfan', ...args);
};

const TeleTextor: FC<TeleTextorProps> = ({ placeholder, disabled }) => {
  // eslint-disable-next-line no-null/no-null
  const editorRef = useRef<HTMLDivElement | null>(null);

  /* events */
  const editorOnContextMenu = () => {
    if (IS_ANDROID) {
      // TODO: something should happen
    }
  };

  const editorOnTouchCancel = () => {
    if (IS_ANDROID) {
      // TODO: something should happen
    }
  };

  const editorOnInput = () => {
    const {
      value: richValue,
      entities: markdownEntities1,
      caretPos,
    } = getRichValueWithCaret(editorRef.current!);

    const [value, markdownEntities] = parseMarkdown(richValue, markdownEntities1, true);
    const entities = mergeEntities(markdownEntities, parseEntities(value));

    logger(richValue, entities);

    const isEmpty = !richValue.trim();
    if (isEmpty) {
      // * Chrome has a bug - it will preserve the formatting if the input with monospace text is cleared
      // * so have to reset formatting
      if (document.activeElement === editorRef.current && !IS_MOBILE) {
        setTimeout(() => {
          if (document.activeElement === editorRef.current) {
            editorRef.current!.textContent = '1';
            placeCaretAtEnd(editorRef.current!);
            editorRef.current!.textContent = '';
          }
        }, 0);
      }
    }

    processCurrentFormatting(editorRef.current!);
  };

  function formatterOnClose() {
    logger('formatter closed');
  }
  /* events */

  const classNames = useMemo(
    () => ({
      container: buildClassName('teletextor', disabled && 'disabled'),
      placeholder: buildClassName('teletextor-placeholder'),
      editor: buildClassName('teletextor-editor', 'input-message-input'),
    }),
    [disabled],
  );

  return (
    <div className={classNames.container}>
      { /* eslint-disable-next-line jsx-a11y/control-has-associated-label */ }
      <div
        ref={editorRef}
        className={classNames.editor}
        onContextMenu={editorOnContextMenu}
        onTouchCancel={editorOnTouchCancel}
        onInput={editorOnInput}
        dir="auto"
        tabIndex={0}
        role="textbox"
        contentEditable
      />

      {placeholder && (
        <span className={classNames.placeholder}>{placeholder}</span>
      )}

      <Portal>
        <TeleTextorFormatter onClose={formatterOnClose} />
      </Portal>
    </div>
  );
};

export default memo(TeleTextor);
