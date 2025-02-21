/* eslint-disable guard-for-in, no-restricted-syntax, max-len, react/jsx-no-bind, no-lone-blocks  */

import type { FC } from '../../../../lib/teact/teact';
import React, {
  memo,
  useCallback,
  useEffect,
  useRef,
  useState,
} from '../../../../lib/teact/teact';

import type { MarkdownType } from './TeleTextorTypes';

import { requestMeasure, requestMutation } from '../../../../lib/fasterdom/fasterdom';
import buildClassName from '../../../../util/buildClassName';
import { clamp } from '../../../../util/math';
import { IS_MOBILE } from '../../../../util/windowEnvironment';
import RichInputHandler from './richInputHandler';

import useOldLang from '../../../../hooks/useOldLang';

import Icon from '../../../common/icons/Icon';
import Button from '../../../ui/Button';
import { logger } from './TeleTextor';
import {
  cancelEvent,
  findUpClassName,
  getCharAfterRange,
  getMarkupInSelection, getVisibleRect, indexOfAndSplice, IS_APPLE, IS_TOUCH_SUPPORTED, isSelectionEmpty,
  processCurrentFormatting,
  resetCurrentFontFormatting,
  resetCurrentFormatting,
  simulateEvent,
} from './TeleTextorUtils';

import './TeleTextorFormatter.scss';

export type OwnProps = {
  onClose: () => void;
};

let activeInputElement: HTMLElement;
let mouseUpCounter = 0;
let savedRange: Range | undefined;
let waitingForMouseUp = false;
let hideTimeout: number | undefined;

// eslint-disable-next-line max-len
export type MarkupTooltipTypes = Extract<MarkdownType, 'bold' | 'italic' | 'underline' | 'strikethrough' | 'monospace' | 'spoiler' | 'quote' | 'link'>;

const TeleTextorFormatter: FC<OwnProps> = () => {
  // eslint-disable-next-line no-null/no-null
  const containerRef = useRef<HTMLDivElement>(null);
  const className = buildClassName('markup-tooltip');

  // eslint-disable-next-line no-null/no-null
  const wrapperRef = useRef<HTMLDivElement>(null);

  // eslint-disable-next-line no-null/no-null
  const linkInputRef = useRef<HTMLInputElement>(null);

  const [buttons, setButtons] = useState<{ [type in MarkupTooltipTypes]: { active: boolean } }>({} as any);

  const getActiveMarkupButton = useCallback(() => {
    const currentMarkups: Set<MarkupTooltipTypes> = new Set();

    const types = Object.keys({ ...buttons }) as MarkupTooltipTypes[];
    const markup = getMarkupInSelection(types);
    types.forEach((type) => {
      if (markup[type].active) {
        currentMarkups.add(type);
      }
    });

    return [...currentMarkups];
  }, [buttons]);

  const setActiveMarkupButton = useCallback(() => {
    const activeButtons = getActiveMarkupButton();

    const updateButtons = { ...buttons } as typeof buttons;

    for (const i in updateButtons) {
      // @ts-ignore
      updateButtons[i].active = activeButtons.includes(i);
    }

    setButtons(updateButtons);
  }, [buttons, getActiveMarkupButton]);

  const setTooltipPosition = useCallback((isLinkToggle = false) => {
    requestMeasure(() => {
      const selection = document.getSelection();
      const range = selection!.getRangeAt(0);

      const rowsWrapper = findUpClassName(activeInputElement, 'message-input-wrapper')
        || findUpClassName(activeInputElement, 'input-message-container')
        || findUpClassName(activeInputElement, 'input-field');

      const currentTools = containerRef.current!.classList.contains('is-link') ? wrapperRef.current!.lastElementChild : wrapperRef.current!.firstElementChild;
      const bodyRect = document.body.getBoundingClientRect();
      const selectionRect = range.getBoundingClientRect();
      const inputRect = rowsWrapper.getBoundingClientRect();
      const sizesRect = currentTools!.getBoundingClientRect();

      requestMutation(() => {
        containerRef.current!.style.maxWidth = `${inputRect.width}px`;
      });

      const visibleRect = getVisibleRect(
        undefined!,
        activeInputElement,
        false,
        selectionRect,
      );

      const { newHeight = 0, oldHeight = newHeight } = activeInputElement as any;

      if (!visibleRect) { // can be when modifying quote that's not in visible area
        return;
      }

      const selectionTop = (visibleRect ? visibleRect.rect.top : inputRect.top) /* selectionRect.top */ + (bodyRect.top * -1);

      // eslint-disable-next-line no-constant-condition
      const top = selectionTop - sizesRect.height - 8 + (true ? oldHeight - newHeight : 0);

      const minX = inputRect.left;
      const maxX = (inputRect.left + inputRect.width) - Math.min(inputRect.width, sizesRect.width);
      let left: number;
      if (isLinkToggle) {
        const containerRect = containerRef.current!.getBoundingClientRect();
        left = clamp(containerRect.left, minX, maxX);
      } else {
        const x = selectionRect.left + (selectionRect.width - sizesRect.width) / 2;
        left = clamp(x, minX, maxX);
      }

      /* const isClamped = x !== minX && x !== maxX && (left === minX || left === maxX || containerRef.current!.getBoundingClientRect().left >= maxX);

      if(isLinkToggle && containerRef.current!.classList.contains('is-link') && !isClamped) return; */

      requestMutation(() => {
        containerRef.current!.style.transform = `translate3d(${left}px, ${top}px, 0)`;
      });
    });
  }, []);

  const show = useCallback(() => {
    if (isSelectionEmpty()) {
      hide();
      return;
    }

    if (hideTimeout !== undefined) {
      clearTimeout(hideTimeout);
    }

    if (containerRef.current!.classList.contains('is-visible')) {
      return;
    }

    setActiveMarkupButton();

    requestMutation(() => {
      containerRef.current!.classList.remove('is-link');
      const isFirstShow = containerRef.current!.classList.contains('hide');
      if (isFirstShow) {
        containerRef.current!.classList.remove('hide');
        containerRef.current!.classList.add('no-transition');
      }

      setTooltipPosition();

      if (isFirstShow) {
        void containerRef.current!.offsetLeft; // reflow
        containerRef.current!.classList.remove('no-transition');
      }

      containerRef.current!.classList.add('is-visible');

      if (!IS_MOBILE) {
        // TODO: add to app navigation to close by escape
      }
    });
  }, [hide, setActiveMarkupButton, setTooltipPosition]);

  const resetSelection = useCallback((range: Range = savedRange!) => {
    const selection = window.getSelection();
    selection!.removeAllRanges();
    selection!.addRange(range);
    activeInputElement!.focus();
  }, []);

  const onMouseUpSingle = useCallback((e?: Event) => {
    // this.log('onMouseUpSingle');
    waitingForMouseUp = false;

    if (IS_TOUCH_SUPPORTED) {
      // eslint-disable-next-line @typescript-eslint/no-unused-expressions
      e && cancelEvent(e);
      if (mouseUpCounter++ === 0) {
        resetSelection(savedRange);
      } else {
        hide();
        return;
      }
    }

    show();

    /* !isTouchSupported && document.addEventListener('mouseup', this.onMouseUp); */
  }, [hide, resetSelection, show]);

  const setMouseUpEvent = useCallback(() => {
    if (waitingForMouseUp) return;
    waitingForMouseUp = true;

    document.addEventListener('mouseup', onMouseUpSingle, { once: true });
  }, [onMouseUpSingle]);

  const onSelectionChange = useCallback(() => {
    if (document.activeElement === linkInputRef.current) {
      return;
    }

    const activeElement = document.activeElement as HTMLElement;
    if (activeInputElement
      ? activeElement !== activeInputElement
      : !(activeElement.classList.contains('input-message-input') || activeElement.getAttribute('can-format'))) {
      hide();
      return;
    }

    const selection = document.getSelection();
    if (isSelectionEmpty(selection)) {
      hide();
      return;
    }

    activeInputElement = activeElement;

    if (IS_TOUCH_SUPPORTED) {
      if (IS_APPLE) {
        show();
        setTooltipPosition(); // * because can skip this in .show();
      } else {
        if (mouseUpCounter === 2) {
          mouseUpCounter = 0;
          return;
        }

        savedRange = selection!.getRangeAt(0);
        setMouseUpEvent();
        /* document.addEventListener('touchend', (e) => {
          cancelEvent(e);
          this.resetSelection(range);
          this.show();
        }, {once: true, passive: false}); */
      }
    } else if (containerRef.current && containerRef.current.classList.contains('is-visible')) {
      setActiveMarkupButton();
      setTooltipPosition();
    } else if (activeInputElement.matches(':active')) {
      setMouseUpEvent();
    } else {
      show();
    }
  }, [hide, setActiveMarkupButton, setMouseUpEvent, setTooltipPosition, show]);

  const onBeforeInput = useCallback((e: InputEvent) => {
    if (e.inputType === 'historyRedo' || e.inputType === 'historyUndo') {
      e.target!.addEventListener('input', () => setActiveMarkupButton(), { once: true });
    }
  }, [setActiveMarkupButton]);

  // eslint-disable-next-line react-hooks-static-deps/exhaustive-deps
  function hide() {
    requestMutation(() => {
      activeInputElement = undefined!;
      containerRef.current!.classList.remove('is-visible');
      // document.removeEventListener('mouseup', this.onMouseUp);
      document.removeEventListener('mouseup', onMouseUpSingle);
      waitingForMouseUp = false;

      // TODO: remove markup from app navigation controller

      if (hideTimeout) clearTimeout(hideTimeout);
      hideTimeout = window.setTimeout(() => {
        hideTimeout = undefined;
        containerRef.current!.classList.add('hide');
        containerRef.current!.classList.remove('is-link');
      }, 200);
    });
  }

  function applyMarkdown(input: HTMLElement, type: MarkdownType, href?: string) {
    // const MONOSPACE_FONT = 'var(--font-monospace)';
    // const SPOILER_FONT = 'spoiler';
    const commandsMap: Partial<{ [key in typeof type]: string | (() => void) }> = {
      // bold: 'Bold',
      // italic: 'Italic',
      // underline: 'Underline',
      // strikethrough: 'Strikethrough',
      // monospace: () => document.execCommand('fontName', false, MONOSPACE_FONT),
      link: href ? () => document.execCommand('createLink', false, href) : () => document.execCommand('unlink', false, undefined),
      // quote: () => document.execCommand('formatBlock', false, 'blockquote')
      // spoiler: () => document.execCommand('fontName', false, SPOILER_FONT)
    };

    const canCombine: (typeof type)[] = ['bold', 'italic', 'underline', 'strikethrough', 'spoiler', 'quote'];

    // eslint-disable-next-line @typescript-eslint/no-shadow
    const c = (type: MarkdownType) => {
      commandsMap[type] = () => {
        // eslint-disable-next-line @typescript-eslint/no-shadow, @typescript-eslint/no-use-before-define
        const k = (canCombine.includes(type) ? canCombine : [type]).filter((type) => hasMarkup[type]?.active);
        if (!indexOfAndSplice(k, type)) {
          k.push(type);
        }

        if (type === 'quote'/*  && k.includes(type) */) {
          const selection = document.getSelection();
          if (selection!.rangeCount && getCharAfterRange(selection!.getRangeAt(0)) === '\n') {
            const toLeft = false;
            selection!.modify(selection!.isCollapsed ? 'move' : 'extend', toLeft ? 'backward' : 'forward', 'character');
          }
        }

        let ret: boolean;
        if (!k.length) {
          ret = resetCurrentFontFormatting();
        } else {
          ret = document.execCommand('fontName', false, `markup-${k.join('-')}`);
        }

        processCurrentFormatting(input);

        return ret;
      };
    };

    // eslint-disable-next-line @typescript-eslint/no-shadow
    canCombine.forEach((type) => {
      c(type);
    });

    c('monospace');

    if (!commandsMap[type]) {
      return false;
    }

    const command = commandsMap[type];

    // type = 'monospace';

    // const saveExecuted = this.prepareDocumentExecute();
    const executed: any[] = [];
    /**
     * * clear previous formatting, due to Telegram's inability to handle several entities
     */
    /* const checkForSingle = () => {
      const nodes = getSelectedNodes();
      //console.log('Using formatting:', commandsMap[type], nodes, this.executedHistory);

      const parents = [...new Set(nodes.map((node) => node.parentNode))];
      //const differentParents = !!nodes.find((node) => node.parentNode !== firstParent);
      const differentParents = parents.length > 1;

      let notSingle = false;
      if(differentParents) {
        notSingle = true;
      } else {
        const node = nodes[0];
        if(node && (node.parentNode as HTMLElement) !== this.messageInput && (node.parentNode.parentNode as HTMLElement) !== this.messageInput) {
          notSingle = true;
        }
      }

      if(notSingle) {
        //if(type === 'monospace') {
          executed.push(document.execCommand('styleWithCSS', false, 'true'));
        //}

        executed.push(document.execCommand('unlink', false, null));
        executed.push(document.execCommand('removeFormat', false, null));
        executed.push(typeof(command) === 'function' ? command() : document.execCommand(command, false, null));

        //if(type === 'monospace') {
          executed.push(document.execCommand('styleWithCSS', false, 'false'));
        //}
      }
    }; */

    // fix applying markdown when range starts from contenteditable="false"
    // let textNode: Text;
    // do {
    //   // const {node, offset, selection} = getCaretPosNew(this.messageInput, true);
    //   const selection = document.getSelection();
    //   const range = selection.getRangeAt(0);
    //   const {node, offset} = getCaretPosF(this.messageInput, range.startContainer, range.startOffset);
    //   // const node = range.startContainer as ChildNode;
    //   if(node?.textContent === BOM || (node as HTMLElement)?.isContentEditable === false) {
    //     // selection.modify('extend', 'backward', 'character');
    //     textNode = document.createTextNode(BOM);
    //     (node.nodeType === node.ELEMENT_NODE ? node : node.parentElement).before(textNode);
    //     range.setStart(textNode, 0);
    //   }/*  else {
    //     break;
    //   } */

    //   break;
    // } while(true);

    const richInputHandler = RichInputHandler.getInstance();
    const restore = richInputHandler.prepareApplyingMarkdown();

    const listenerOptions: AddEventListenerOptions = { capture: true, passive: false };
    input.addEventListener('input', cancelEvent, listenerOptions);

    executed.push(document.execCommand('styleWithCSS', false, 'true'));

    const hasMarkup = getMarkupInSelection(Object.keys(commandsMap) as (typeof type)[]);

    // * monospace can't be combined with different types
    /* if(type === 'monospace' || type === 'spoiler') {
      // executed.push(document.execCommand('styleWithCSS', false, 'true'));

      const haveThisType = hasMarkup[type];
      // executed.push(document.execCommand('removeFormat', false, null));

      if(haveThisType) {
        executed.push(this.resetCurrentFontFormatting());
      } else {
        // if(type === 'monospace' || hasMarkup['monospace']) {
        //   executed.push(this.resetCurrentFormatting());
        // }

        executed.push(typeof(command) === 'function' ? command() : document.execCommand(command, false, null));
      }
    } else  */{
      if (hasMarkup.monospace?.active && type === 'link') {
        executed.push(resetCurrentFormatting());
      }

      executed.push(typeof (command) === 'function' ? command() : document.execCommand(command, false, undefined));
    }

    executed.push(document.execCommand('styleWithCSS', false, 'false'));

    restore();

    // checkForSingle();
    // saveExecuted();
    setActiveMarkupButton();

    // if(textNode) {
    //   (textNode.parentElement === this.messageInput ? textNode : textNode.parentElement).remove();
    //   textNode.nodeValue = '';
    // }

    input.removeEventListener('input', cancelEvent, listenerOptions);
    simulateEvent(input, 'input');

    return true;
  }

  const onClickMarkup = (type: MarkdownType) => {
    applyMarkdown(activeInputElement, type);
  };

  useEffect(() => {
    document.addEventListener('selectionchange', onSelectionChange);
    document.addEventListener('beforeinput', onBeforeInput);

    return () => {
      document.removeEventListener('selectionchange', onSelectionChange);
      document.removeEventListener('beforeinput', onBeforeInput);
    };
  }, [onBeforeInput, onSelectionChange]);

  const lang = useOldLang();

  return (
    <div ref={containerRef} className={className}>
      <div className="markup-tooltip-wrapper" ref={wrapperRef}>
        <div className="markup-tooltip-tools markup-tooltip-tools-regular">
          <Button
            color="translucent"
            ariaLabel="Spoiler text"
            onClick={() => onClickMarkup('spoiler')}
          >
            <Icon name="eye-closed" />
          </Button>
          <Button
            color="translucent"
            ariaLabel="Bold text"
            onClick={() => onClickMarkup('bold')}
          >
            <Icon name="bold" />
          </Button>
          <Button
            color="translucent"
            ariaLabel="Italic text"
            onClick={() => onClickMarkup('italic')}
          >
            <Icon name="italic" />
          </Button>
          <Button
            color="translucent"
            ariaLabel="Underlined text"
            onClick={() => onClickMarkup('underline')}
          >
            <Icon name="underlined" />
          </Button>
          <Button
            color="translucent"
            ariaLabel="Strikethrough text"
            onClick={() => onClickMarkup('strikethrough')}
          >
            <Icon name="strikethrough" />
          </Button>
          <Button
            color="translucent"
            ariaLabel="Monospace text"
            onClick={() => onClickMarkup('monospace')}
          >
            <Icon name="monospace" />
          </Button>
          <span className="markup-tooltip-delimiter" />
          <Button color="translucent" ariaLabel={lang('TextFormat.AddLinkTitle')}>
            <Icon name="link" />
          </Button>
        </div>
        <div className="markup-tooltip-tools markup-tooltip-tools-link">
          <button className="btn-icon"><span className="tgico button-icon"></span></button>
          <span className="markup-tooltip-delimiter" />
          <input className="i18n input-clear" placeholder="Enter URL..." ref={linkInputRef} />
          <div className="markup-tooltip-link-apply-container">
            <span className="markup-tooltip-delimiter" />
            <button className="btn-icon markup-tooltip-link-apply">
              <span className="tgico button-icon"></span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default memo(TeleTextorFormatter);
