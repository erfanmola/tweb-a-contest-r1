/* eslint-disable no-cond-assign, max-len, no-null/no-null, no-useless-escape, no-control-regex, no-lone-blocks */

/*
 * There are lots of borrowings from WebK codebase, thanks edward.
 * Of course refactored to be compatible with WebA codebase.
 */

import type {
  DOMRectMinified,
  MarkdownTag, MarkdownType, MessageEntity, MessageEntityBold, MessageEntityCode, MessageEntityItalic, MessageEntitySpoiler,
} from './TeleTextorTypes';

import twemojiRegex from '../../../../lib/twemojiRegex';
import { clamp } from '../../../../util/math';
import windowSize from '../../../../util/windowSize';

export const BOM = '﻿';

// @ts-ignore
export const IS_TOUCH_SUPPORTED = ('ontouchstart' in window) || (window.DocumentTouch && document instanceof DocumentTouch);
export const IS_APPLE = navigator.userAgent.search(/OS X|iPhone|iPad|iOS/i) !== -1;

const markdownTags: { [type in MarkdownType]: MarkdownTag } = {
  bold: {
    match: '[style*="bold"], [style*="font-weight: 700"], [style*="font-weight: 600"], [style*="font-weight:700"], [style*="font-weight:600"], b, strong',
    entityName: 'messageEntityBold',
  },
  underline: {
    match: '[style*="underline"], u, ins',
    entityName: 'messageEntityUnderline',
  },
  italic: {
    match: '[style*="italic"], i, em',
    entityName: 'messageEntityItalic',
  },
  monospace: {
    match: '[style*="monospace"], [face*="monospace"], pre',
    entityName: 'messageEntityCode',
  },
  strikethrough: {
    match: '[style*="line-through"], [style*="strikethrough"], strike, del, s',
    entityName: 'messageEntityStrike',
  },
  link: {
    match: 'A:not(.follow)',
    entityName: 'messageEntityTextUrl',
  },
  mentionName: {
    match: 'A.follow',
    entityName: 'messageEntityMentionName',
  },
  spoiler: {
    match: '[style*="spoiler"]',
    entityName: 'messageEntitySpoiler',
  },
  quote: {
    match: '[style*="quote"], .quote',
    entityName: 'messageEntityBlockquote',
  },
};

const ALPHA_CHARS_REG_EXP = 'a-z'
  + '\\u00c0-\\u00d6\\u00d8-\\u00f6\\u00f8-\\u00ff' // Latin-1
  + '\\u0100-\\u024f' // Latin Extended A and B
  + '\\u0253\\u0254\\u0256\\u0257\\u0259\\u025b\\u0263\\u0268\\u026f\\u0272\\u0289\\u028b' // IPA Extensions
  + '\\u02bb' // Hawaiian
  + '\\u0300-\\u036f' // Combining diacritics
  + '\\u1e00-\\u1eff' // Latin Extended Additional (mostly for Vietnamese)
  + '\\u0400-\\u04ff\\u0500-\\u0527' // Cyrillic
  + '\\u2de0-\\u2dff\\ua640-\\ua69f' // Cyrillic Extended A/B
  + '\\u0591-\\u05bf\\u05c1-\\u05c2\\u05c4-\\u05c5\\u05c7'
  + '\\u05d0-\\u05ea\\u05f0-\\u05f4' // Hebrew
  + '\\ufb1d-\\ufb28\\ufb2a-\\ufb36\\ufb38-\\ufb3c\\ufb3e\\ufb40-\\ufb41'
  + '\\ufb43-\\ufb44\\ufb46-\\ufb4f' // Hebrew Pres. Forms
  + '\\u0610-\\u061a\\u0620-\\u065f\\u066e-\\u06d3\\u06d5-\\u06dc'
  + '\\u06de-\\u06e8\\u06ea-\\u06ef\\u06fa-\\u06fc\\u06ff' // Arabic
  + '\\u0750-\\u077f\\u08a0\\u08a2-\\u08ac\\u08e4-\\u08fe' // Arabic Supplement and Extended A
  + '\\ufb50-\\ufbb1\\ufbd3-\\ufd3d\\ufd50-\\ufd8f\\ufd92-\\ufdc7\\ufdf0-\\ufdfb' // Pres. Forms A
  + '\\ufe70-\\ufe74\\ufe76-\\ufefc' // Pres. Forms B
  + '\\u200c' // Zero-Width Non-Joiner
  + '\\u0e01-\\u0e3a\\u0e40-\\u0e4e' // Thai
  + '\\u1100-\\u11ff\\u3130-\\u3185\\uA960-\\uA97F\\uAC00-\\uD7AF\\uD7B0-\\uD7FF' // Hangul (Korean)
  + '\\u3003\\u3005\\u303b' // Kanji/Han iteration marks
  + '\\uff21-\\uff3a\\uff41-\\uff5a' // full width Alphabet
  + '\\uff66-\\uff9f' // half width Katakana
  + '\\uffa1-\\uffdc'; // half width Hangul (Korean)

const URL_PROTOCOL_REG_EXP_PART = '((?:https?|ftp)://|mailto:)?';
const DOMAIN_ADD_CHARS = '\u00b7';
// Based on Regular Expression for URL validation by Diego Perini
const URL_ALPHANUMERIC_REG_EXP_PART = `[${ALPHA_CHARS_REG_EXP}0-9]`;
const URL_REG_EXP = `${URL_PROTOCOL_REG_EXP_PART}(?:${URL_ALPHANUMERIC_REG_EXP_PART}{1,64}(?::${URL_ALPHANUMERIC_REG_EXP_PART}{0,64})?@)?`
  + '(?:'
  // sindresorhus/ip-regexp
  + '(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])(?:\\.(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])){3}'
  + `|${URL_ALPHANUMERIC_REG_EXP_PART}[${ALPHA_CHARS_REG_EXP}${DOMAIN_ADD_CHARS}0-9\-]{0,64}`
  // domain name
  + `(?:\\.${URL_ALPHANUMERIC_REG_EXP_PART}[${ALPHA_CHARS_REG_EXP}${DOMAIN_ADD_CHARS}0-9\-]{0,64}){0,10}`
  // TLD identifier
  + `(?:\\.(xn--[0-9a-z]{2,16}|[${ALPHA_CHARS_REG_EXP}]{2,24}))`
  + ')'
  // port number
  + '(?::\\d{2,5})?'
  // resource path
  + '(?:/(?:\\S{0,255}[^\\s.;,(\\[\\]{}<>"\'])?)?';

const TIMESTAMP_REG_EXP = '(?:\\s|^)((?:(\\d{1,2}):(?:[0-5]?[0-9])|(?:\\d{1,2}|\\d{3,})):(?:[0-5][0-9]))(?:\\s|$)';
const ALPHA_NUMERIC_REG_EXP = `0-9\_${ALPHA_CHARS_REG_EXP}`;
const MARKDOWN_REG_EXP = /(^|\s|\n)(````?)([\s\S]+?)(````?)([\s\n\.,:?!;]|$)|(^|\s|\x01)(`|~~|\*\*|__|_-_|\|\|)([^\n]+?)\7([\x01\s\.,:?!;]|$)|@(\d+)\s*\((.+?)\)|(\[(.+?)\]\((.+?)\))/m;
const USERNAME_REG_EXP = '[a-zA-Z\\d_]{5,32}';
const BOT_COMMAND_REG_EXP = `\\/([a-zA-Z\\d_]{1,32})(?:@(${USERNAME_REG_EXP}))?(\\b|$)`;
const FULL_REG_EXP = new RegExp(`(^| )(@)(${USERNAME_REG_EXP})|(${URL_REG_EXP})|(\\n)|(${twemojiRegex})|(^|[\\s\\(\\]])(#[${ALPHA_NUMERIC_REG_EXP}]{2,64})|(^|\\s)${BOT_COMMAND_REG_EXP}|${TIMESTAMP_REG_EXP}`, 'i');
const EMAIL_REG_EXP = /^(([^<>()[\]\\.,;:\s@\"]+(\.[^<>()[\]\\.,;:\s@\"]+)*)|(\".+\"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;

const FontFamilyName = 'Roboto';

const MARKDOWN_ENTITIES: { [markdown: string]: MessageEntity['_'] } = {
  '`': 'messageEntityCode',
  '``': 'messageEntityPre',
  '**': 'messageEntityBold',
  __: 'messageEntityItalic',
  '~~': 'messageEntityStrike',
  '_-_': 'messageEntityUnderline',
  '||': 'messageEntitySpoiler',
};

const SINGLE_ENTITIES: Set<MessageEntity['_']> = new Set(['messageEntityPre', 'messageEntityCode']);

const PASS_CONFLICTING_ENTITIES: Set<MessageEntity['_']> = new Set([
  'messageEntityEmoji',
  'messageEntityLinebreak',
  'messageEntityCaret',
]);

const PASS_SINGLE_CONFLICTING_ENTITIES = new Set(PASS_CONFLICTING_ENTITIES);
// eslint-disable-next-line no-restricted-syntax, guard-for-in
for (const i in MARKDOWN_ENTITIES) {
  PASS_CONFLICTING_ENTITIES.add(MARKDOWN_ENTITIES[i]);
}

const tabulationMatch = '[style*="table-cell"], th, td';

const BLOCK_TAGS = new Set([
  'DIV',
  'P',
  'BR',
  'LI',
  'SECTION',
  'H6',
  'H5',
  'H4',
  'H3',
  'H2',
  'H1',
  'TR',
  'OL',
  'UL',
  'BLOCKQUOTE',
]);

const BOM_REG_EXP = new RegExp(BOM, 'g');
const SELECTION_SEPARATOR = '\x01';

const CAN_COMBINE_ENTITIES: Set<MessageEntity['_']> = new Set([
  'messageEntityBold',
  'messageEntityItalic',
  'messageEntityCode',
  'messageEntityPre',
  'messageEntityUnderline',
  'messageEntityStrike',
  'messageEntityBlockquote',
  'messageEntitySpoiler',
]);

function getCaretPos(field: Node) {
  const sel = window.getSelection();
  let selNode: Node;
  let selOffset: number;
  if (sel?.rangeCount) {
    const range = sel.getRangeAt(0);
    const startOffset = range.startOffset;
    if (
      range.startContainer
      && range.startContainer === range.endContainer
      && startOffset === range.endOffset
    ) {
      const possibleChildrenFocusOffset = startOffset - 1;
      const childNodes = field.childNodes;
      if (range.startContainer === field && childNodes[possibleChildrenFocusOffset]) {
        selNode = childNodes[possibleChildrenFocusOffset];
        selOffset = 0;

        for (let i = 0; i < range.endOffset; ++i) {
          const node = childNodes[i];
          const value = node.nodeValue || (node as HTMLImageElement).alt;

          if (value) {
            selOffset += value.length;
          }
        }
      } else {
        selNode = range.startContainer;
        selOffset = startOffset;
      }
    }
  }

  return { node: selNode!, offset: selOffset! };
}

function checkNodeForEntity(node: Node, value: string, entities: MessageEntity[], offset: { offset: number }) {
  const parentElement = node.parentElement;

  // eslint-disable-next-line no-restricted-syntax, guard-for-in
  for (const type in markdownTags) {
    const tag = markdownTags[type as MarkdownType];
    const closest: HTMLElement = parentElement!.closest(`${tag.match}, [contenteditable="true"]`)!;
    if (closest?.getAttribute('contenteditable') !== null) {
      /* const depth = getDepth(closest, parentElement.closest('[contenteditable]'));
      if(closestDepth > depth) {
        closestDepth = depth;
        closestTag = tag;
        closestElementByTag = closest;
      } */
      continue;
    }

    let codeElement: HTMLElement;
    if (tag.entityName === 'messageEntityCode' && (codeElement = parentElement!.closest('[data-language]')!)) {
      entities.push({
        _: 'messageEntityPre',
        language: codeElement.dataset.language || '',
        offset: offset.offset,
        length: value.length,
      });
    } else if (tag.entityName === 'messageEntityTextUrl') {
      entities.push({
        _: tag.entityName,
        url: (closest as HTMLAnchorElement).href,
        offset: offset.offset,
        length: value.length,
      });
    } else if (tag.entityName === 'messageEntityMentionName') {
      // TODO: handle this
      // entities.push({
      //   _: tag.entityName,
      //   offset: offset.offset,
      //   length: value.length,
      //   user_id: (closest as HTMLElement).dataset.follow.toUserId(),
      // });
    } else if (tag.entityName === 'messageEntityBlockquote') {
      entities.push({
        _: tag.entityName,
        pFlags: {
          collapsed: /* closest.classList.contains('can-send-collapsd') &&  */!!closest.dataset.collapsed || undefined,
        },
        offset: offset.offset,
        length: value.length,
      });
    } else {
      entities.push({
        _: tag.entityName,
        offset: offset.offset,
        length: value.length,
      });
    }
  }
}

function isLineEmpty(line: string[]) {
  const { length } = line;
  if (!length) {
    return true;
  }

  if (line[length - 1] === SELECTION_SEPARATOR && length === SELECTION_SEPARATOR.length) {
    return true;
  }

  return false;
}

function getRichElementValue(
  node: HTMLElement,
  lines: string[],
  line: string[],
  selNode?: Node,
  selOffset?: number,
  entities?: MessageEntity[],
  offset: { offset: number; isInQuote?: boolean } = { offset: 0 },
) {
  if (node.nodeType === node.TEXT_NODE) { // TEXT
    let nodeValue = node.nodeValue;
    // if(nodeValue[0] === BOM) {
    nodeValue = nodeValue!.replace(BOM_REG_EXP, '');
    // }

    /* const tabulation = node.parentElement?.closest(tabulationMatch + ', [contenteditable]');
    if(tabulation?.getAttribute('contenteditable') === null) {
      nodeValue += ' ';
      // line.push('\t');
      // ++offset.offset;
    } */

    if (nodeValue) {
      // if(offset.isInQuote && nodeValue.endsWith('\n')) { // slice last linebreak from quote
      //   nodeValue = nodeValue.slice(0, -1);
      // }

      if (selNode === node) {
        line.push(nodeValue.substr(0, selOffset) + SELECTION_SEPARATOR + nodeValue.substr(selOffset!));
      } else {
        line.push(nodeValue);
      }
    } else if (selNode === node) {
      line.push(SELECTION_SEPARATOR);
    }

    if (entities && nodeValue.length && node.parentNode) {
      checkNodeForEntity(node, nodeValue, entities, offset);
    }

    offset.offset += nodeValue.length;
    return;
  }

  if (node.nodeType !== node.ELEMENT_NODE) { // NON-ELEMENT
    return;
  }

  const pushLine = () => {
    lines.push(line.join(''));
    line.length = 0;
    ++offset.offset;
  };

  const isSelected = selNode === node;
  const isQuote = node.matches(markdownTags.quote.match);
  const isBlock = BLOCK_TAGS.has(node.tagName) || isQuote;
  if (isBlock && ((line.length && line[line.length - 1].slice(-1) !== '\n') || node.tagName === 'BR'/*  || (BLOCK_TAGS.has(node.tagName) && lines.length) */)) {
    pushLine();
  } else {
    const alt = node.dataset.stickerEmoji || (node as HTMLImageElement).alt;
    const stickerEmoji = node.dataset.stickerEmoji;

    if (alt && entities) {
      checkNodeForEntity(node, alt, entities, offset);
    }

    if (stickerEmoji && entities) {
      entities.push({
        _: 'messageEntityCustomEmoji',
        document_id: node.dataset.docId,
        offset: offset.offset,
        length: alt.length,
      });
    }

    if (alt) {
      line.push(alt);
      offset.offset += alt.length;
    }
  }

  if (isSelected && !selOffset) {
    line.push(SELECTION_SEPARATOR);
  }

  const isTableCell = node.matches(tabulationMatch);
  const wasEntitiesLength = entities?.length;
  // const wasLinesLength = lines.length;
  let wasNodeEmpty = true;

  if (isQuote) {
    offset.isInQuote = true;
  }

  let curChild = node.firstChild as HTMLElement;
  while (curChild) {
    getRichElementValue(curChild, lines, line, selNode, selOffset, entities, offset);
    curChild = curChild.nextSibling as any;

    if (!isLineEmpty(line)) {
      wasNodeEmpty = false;
    }
  }

  if (isQuote) {
    const lastValue = line[line.length - 1];
    if (lastValue?.endsWith('\n')) { // slice last linebreak from quote
      line[line.length - 1] = lastValue.slice(0, -1);
      offset.offset -= 1;
    }

    offset.isInQuote = false;
  }

  // can test on text with list (https://www.who.int/initiatives/sports-and-health)
  if (wasNodeEmpty && node.textContent?.replace(/[\r\n]/g, '')) {
    wasNodeEmpty = false;
  }

  if (isSelected && selOffset) {
    line.push(SELECTION_SEPARATOR);
  }

  if (isTableCell && node.nextSibling && !isLineEmpty(line)) {
    line.push(' ');
    ++offset.offset;

    // * combine entities such as url after adding space
    if (wasEntitiesLength !== undefined) {
      for (let i = wasEntitiesLength, length = entities!.length; i < length; ++i) {
        ++entities![i].length;
      }
    }
  }

  if (isBlock && !wasNodeEmpty) {
    pushLine();
  }

  if (!wasNodeEmpty && node.tagName === 'P' && node.nextSibling) {
    lines.push('');
    ++offset.offset;
  }
}

function combineSameEntities(entities: MessageEntity[]) {
  for (let i = 0; i < entities.length; ++i) {
    const entity = entities[i];

    let nextEntityIdx = -1;
    do {
      nextEntityIdx = entities.findIndex((e, _i) => {
        return CAN_COMBINE_ENTITIES.has(e._) && _i !== i && e._ === entity._ && (e.offset - entity.length) === entity.offset;
      });

      if (nextEntityIdx !== -1) {
        const nextEntity = entities[nextEntityIdx];
        entity.length += nextEntity.length;
        entities.splice(nextEntityIdx, 1);
      }
    } while (nextEntityIdx !== -1);
  }
}

function sortEntities(entities: MessageEntity[]) {
  entities.sort((a, b) => {
    return (a.offset - b.offset) || (b.length - a.length);
  });
}

export function mergeEntities(currentEntities: MessageEntity[], newEntities: MessageEntity[]) {
  currentEntities = currentEntities.slice();
  const filtered = newEntities.filter((e) => {
    return !findConflictingEntity(currentEntities, e);
  });

  currentEntities.push(...filtered);
  sortEntities(currentEntities);
  // currentEntities.sort((a, b) => a.offset - b.offset);
  // currentEntities.sort((a, b) => (a.offset - b.offset) || (a._ === 'messageEntityCaret' && -1));

  // * fix splitted emoji. messageEntityTextUrl can split the emoji if starts before its end (e.g. on fe0f)
  // * have to fix even if emoji supported since it's being wrapped in span
  // if(!IS_EMOJI_SUPPORTED) {
  for (let i = 0; i < currentEntities.length; ++i) {
    let entity = currentEntities[i];
    if (entity._ === 'messageEntityEmoji') {
      const nextEntity = currentEntities[i + 1];
      if (nextEntity /* && nextEntity._ !== 'messageEntityCaret' */ && nextEntity.offset < (entity.offset + entity.length)) {
        // eslint-disable-next-line no-multi-assign
        entity = currentEntities[i] = { ...entity };
        entity.length = nextEntity.offset - entity.offset;
      }
    }
  }
  // }

  return currentEntities;
}

export function getRichValueWithCaret(
  field: Node | HTMLElement | DocumentFragment,
  withEntities = true,
  withCaret = true,
) {
  const lines: string[] = [];
  const line: string[] = [];

  const { node: selNode, offset: selOffset } = (
    !(field instanceof DocumentFragment) && withCaret && getCaretPos(field)
  ) as ReturnType<typeof getCaretPos>;

  const entities: MessageEntity[] | undefined = withEntities ? [] : undefined;
  const offset = { offset: 0 };
  if (field instanceof DocumentFragment) {
    let curChild = field.firstChild as HTMLElement;
    while (curChild) {
      getRichElementValue(curChild, lines, line, selNode, selOffset, entities, offset);
      curChild = curChild.nextSibling as any;
    }
  } else {
    getRichElementValue(field as HTMLElement, lines, line, selNode, selOffset, entities, offset);
  }

  if (line.length) {
    lines.push(line.join(''));
  }

  let value = lines.join('\n');
  const caretPos = value.indexOf(SELECTION_SEPARATOR);
  if (caretPos !== -1) {
    value = value.substr(0, caretPos) + value.substr(caretPos + 1);
  }
  value = value.replace(/\u00A0/g, ' ');

  if (entities?.length) {
    combineSameEntities(entities);
    sortEntities(entities);
  }

  return { value, entities, caretPos };
}

function findConflictingEntity(currentEntities: MessageEntity[], newEntity: MessageEntity) {
  let singleStart = -1; let
    singleEnd = -1;
  return currentEntities.find((currentEntity) => {
    const { offset, length } = currentEntity;
    if (SINGLE_ENTITIES.has(currentEntity._)) {
      singleStart = offset;
      singleEnd = singleStart + length;
    }

    if (singleStart !== -1) {
      if (
        newEntity.offset >= singleStart
        && newEntity.offset < singleEnd
        && !PASS_SINGLE_CONFLICTING_ENTITIES.has(newEntity._)
      ) {
        return true;
      }
    }

    const isConflictingTypes = newEntity._ === currentEntity._
      || (!PASS_CONFLICTING_ENTITIES.has(newEntity._) && !PASS_CONFLICTING_ENTITIES.has(currentEntity._));

    if (!isConflictingTypes) {
      return false;
    }

    const isConflictingOffset = newEntity.offset >= offset
      && (newEntity.length + newEntity.offset) <= (length + offset);

    return isConflictingOffset;
  });
}

export function parseMarkdown(raw: string, currentEntities: MessageEntity[] = [], noTrim?: boolean) {
  /* if(!markdownTestRegExp.test(text)) {
    return noTrim ? text : text.trim();
  } */

  const entities: MessageEntity[] = [];
  let pushedEntity = false;
  // eslint-disable-next-line no-return-assign
  const pushEntity = (entity: MessageEntity) => (!findConflictingEntity(currentEntities, entity) ? (entities.push(entity), pushedEntity = true) : pushedEntity = false);

  const newTextParts: string[] = [];
  let rawOffset = 0; let
    match;
  while (match = raw.match(MARKDOWN_REG_EXP)) {
    const matchIndex = rawOffset + match.index!;
    const possibleNextRawOffset = match.index! + match[0].length;
    const beforeMatch = match.index! > 0 && raw.slice(0, match.index);
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    beforeMatch && newTextParts.push(beforeMatch);
    const text = match[3] || match[8] || match[11] || match[13];

    let entity: MessageEntity;
    pushedEntity = false;
    if (text.match(/^`*$/)) {
      newTextParts.push(match[0]);
    } else if (match[3]) { // pre
      let languageMatch = match[3].match(/(.*?)\n/);
      if (!languageMatch?.[1]) {
        languageMatch = null;
      }

      let code = languageMatch ? match[3].slice(languageMatch[1].length) : match[3];
      const startIndex = code[0] === '\n' ? 1 : 0;
      const endIndex = code[code.length - 1] === '\n' ? -1 : undefined;
      code = code.slice(startIndex, endIndex);
      entity = {
        _: 'messageEntityPre',
        language: languageMatch?.[1] || '',
        offset: matchIndex + match[1].length,
        length: code.length,
      };

      if (pushEntity(entity)) {
        if (endIndex) {
          rawOffset -= 1;
        }

        if (languageMatch) {
          rawOffset -= languageMatch[0].length;
        }

        let whitespace = '';
        if (match[1]) {
          whitespace = match[1];
        } else {
          const previousPart = newTextParts[newTextParts.length - 1];
          if (previousPart && !/\s/.test(previousPart[previousPart.length - 1])) {
            whitespace = '\n';
          }
        }

        newTextParts.push(whitespace, code, match[5]);

        rawOffset -= match[2].length + match[4].length;
      }
    } else if (match[7]) { // code|italic|bold
      const isSOH = match[6] === '\x01';

      entity = {
        _: MARKDOWN_ENTITIES[match[7]] as (MessageEntityBold | MessageEntityCode | MessageEntityItalic | MessageEntitySpoiler)['_'],
        // offset: matchIndex + match[6].length,
        offset: matchIndex + (isSOH ? 0 : match[6].length),
        length: text.length,
      };

      if (pushEntity(entity)) {
        if (!isSOH) {
          newTextParts.push(match[6] + text + match[9]);
        } else {
          newTextParts.push(text);
        }

        rawOffset -= match[7].length * 2 + (isSOH ? 2 : 0);
      }
    } else if (match[11]) { // custom mention
      entity = {
        _: 'messageEntityMentionName',
        // TODO: fix this
        // user_id: match[10].toUserId(),
        offset: matchIndex,
        length: text.length,
      };

      if (pushEntity(entity)) {
        newTextParts.push(text);

        rawOffset -= match[0].length - text.length;
      }
    } else if (match[12]) { // text url
      entity = {
        _: 'messageEntityTextUrl',
        url: match[14],
        offset: matchIndex,
        length: text.length,
      };

      if (pushEntity(entity)) {
        newTextParts.push(text);

        rawOffset -= match[12].length - text.length;
      }
    }

    if (!pushedEntity) {
      newTextParts.push(match[0]);
    }

    raw = raw.substr(match!.index! + match[0].length);
    rawOffset += match!.index! + match[0].length;

    const rawOffsetDiff = rawOffset - possibleNextRawOffset;
    if (rawOffsetDiff) {
      currentEntities.forEach((innerEntity) => {
        if (innerEntity.offset >= matchIndex) {
          innerEntity.offset += rawOffsetDiff;
        }
      });
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-expressions
  raw && newTextParts.push(raw);
  let newText = newTextParts.join('');
  if (!newText.replace(/\s+/g, '').length) {
    newText = raw;
    entities.splice(0, entities.length);
  }

  currentEntities = mergeEntities(currentEntities, entities);
  combineSameEntities(currentEntities);

  let length = newText.length;
  if (!noTrim) {
    // trim left
    newText = newText.replace(/^\s*/, '');

    let diff = length - newText.length;
    if (diff) {
      currentEntities.forEach((entity) => {
        entity.offset = Math.max(0, entity.offset - diff);
      });
    }

    // trim right
    newText = newText.replace(/\s*$/, '');
    diff = length - newText.length;
    length = newText.length;
    if (diff) {
      currentEntities.forEach((entity) => {
        if ((entity.offset + entity.length) > length) {
          entity.length = length - entity.offset;
        }
      });
    }
  }

  return [newText, currentEntities] as const;
}

export function parseEntities(text: string) {
  let match: RegExpMatchArray;
  let raw = text;
  const entities: MessageEntity[] = [];
  let matchIndex;
  let rawOffset = 0;
  // var start = tsNow()
  FULL_REG_EXP.lastIndex = 0;
  while (match = raw.match(FULL_REG_EXP)!) {
    matchIndex = rawOffset + match.index!;

    // console.log('parseEntities match:', match);

    if (match[3]) { // mentions
      entities.push({
        _: 'messageEntityMention',
        offset: matchIndex + match[1].length,
        length: match[2].length + match[3].length,
      });
    } else if (match[4]) {
      if (EMAIL_REG_EXP.test(match[4])) { // email
        entities.push({
          _: 'messageEntityEmail',
          offset: matchIndex,
          length: match[4].length,
        });
      } else {
        let url: string;
        let protocol = match[5];
        const tld = match[6];
        // let excluded = '';
        if (tld) { // URL
          if (!protocol && (tld.substr(0, 4) === 'xn--')) {
            protocol = 'http://';
          }

          if (protocol) {
            const balanced = checkBrackets(match[4]);
            if (balanced.length !== match[4].length) {
              // excluded = match[4].substring(balanced.length);
              match[4] = balanced;
            }

            url = (match[5] ? '' : protocol) + match[4];
          }
        } else { // IP address
          url = (match[5] ? '' : 'http://') + match[4];
        }

        if (url!) {
          entities.push({
            _: 'messageEntityUrl',
            offset: matchIndex,
            length: match[4].length,
          });
        }
      }
    } else if (match[7]) { // New line
      entities.push({
        _: 'messageEntityLinebreak',
        offset: matchIndex,
        length: 1,
      });
    } else if (match[8]) { // Emoji
      const unified = getEmojiUnified(match[8]);
      if (unified) {
        entities.push({
          _: 'messageEntityEmoji',
          offset: matchIndex,
          length: match[8].length,
          unicode: unified,
        });
      }
    } else if (match[11]) { // Hashtag
      entities.push({
        _: 'messageEntityHashtag',
        offset: matchIndex + (match[10] ? match[10].length : 0),
        length: match[11].length,
      });
    } else if (match[13]) { // Bot command
      entities.push({
        _: 'messageEntityBotCommand',
        offset: matchIndex + (match[11] ? match[11].length : 0) + (match[12] ? match[12].length : 0),
        length: 1 + match[13].length + (match[14] ? 1 + match[14].length : 0),
        unsafe: true,
      });
    } else if (match[16]) { // Media timestamp
      const timestamp = match[16];
      const splitted: string[] = timestamp.split(':');
      const splittedLength = splitted.length;
      const hours = splittedLength === 3 ? Number(splitted[0]) : 0;
      const minutes = Number(splitted[splittedLength === 3 ? 1 : 0]);
      const seconds = Number(splitted[splittedLength - 1]);
      entities.push({
        _: 'messageEntityTimestamp',
        offset: matchIndex + (/\D/.test(match[0][0]) ? 1 : 0),
        length: timestamp.length,
        raw: timestamp,
        time: hours * 3600 + minutes * 60 + seconds,
      });
    }

    raw = raw.substr(match.index! + match[0].length);
    rawOffset += match.index! + match[0].length;
  }

  // if (entities.length) {
  //   console.log('parse entities', text, entities.slice())
  // }
  return entities;
}

function checkBrackets(url: string) {
  let urlLength = url.length;
  const urlOpenBrackets = url.split('(').length - 1;
  let urlCloseBrackets = url.split(')').length - 1;
  while (urlCloseBrackets > urlOpenBrackets
    && url.charAt(urlLength - 1) === ')') {
    url = url.substr(0, urlLength - 1);
    urlCloseBrackets--;
    urlLength--;
  }
  if (urlOpenBrackets > urlCloseBrackets) {
    url = url.replace(/\)+$/, '');
  }
  return url;
}

const vs16RegExp = /\uFE0F/g;
const zeroWidthJoiner = String.fromCharCode(0x200d);

const removeVS16s = (rawEmoji: string) => (rawEmoji.indexOf(zeroWidthJoiner) < 0 ? rawEmoji.replace(vs16RegExp, '') : rawEmoji);

function encodeEmoji(emojiText: string) {
  const codepoints = toCodePoints(removeVS16s(emojiText)).join('-');
  return codepoints;
}

function toCodePoints(unicodeSurrogates: string): Array<string> {
  const points = [];
  let char = 0;
  let previous = 0;
  let i = 0;
  while (i < unicodeSurrogates.length) {
    char = unicodeSurrogates.charCodeAt(i++);
    if (previous) {
      // eslint-disable-next-line no-bitwise
      points.push((0x10000 + ((previous - 0xd800) << 10) + (char - 0xdc00)).toString(16));
      previous = 0;
    } else if (char > 0xd800 && char <= 0xdbff) {
      previous = char;
    } else {
      points.push(char.toString(16));
    }
  }

  if (points.length && points[0].length === 2) {
    points[0] = `00${points[0]}`;
  }

  return points;
}

function getEmojiUnified(emojiCode: string) {
  const unified = encodeEmoji(emojiCode).replace(/-?fe0f/g, '');

  /* if(unified === '1f441-200d-1f5e8') {
    //unified = '1f441-fe0f-200d-1f5e8-fe0f';
    unified = '1f441-fe0f-200d-1f5e8';
  } */

  // if (!Emoji.hasOwnProperty(unified)
  // && !emojiData.hasOwnProperty(unified.replace(/-?fe0f$/, ''))
  // ) {
  // console.error('lol', unified);
  // return;
  // }

  return unified;
}

export function placeCaretAtEnd(el: HTMLElement, ignoreTouchCheck = false, focus = true) {
  if (IS_TOUCH_SUPPORTED && (!ignoreTouchCheck || (document.activeElement!.tagName !== 'INPUT' && !(document.activeElement as HTMLElement).isContentEditable))) {
    return;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-expressions
  focus && el.focus();
  if (el instanceof HTMLInputElement) {
    const length = el.value.length;
    el.selectionStart = length;
    el.selectionEnd = length;
  } else {
    const range = document.createRange();
    range.selectNodeContents(el);
    range.collapse(false);
    const sel = window.getSelection();
    sel!.removeAllRanges();
    sel!.addRange(range);
  }
}

export function processCurrentFormatting(input: HTMLElement) {
  // const perf = performance.now();
  (input.querySelectorAll('[style*="font-family"]') as NodeListOf<HTMLElement>).forEach((element) => {
    if (element.style.caretColor) { // cleared blockquote
      element.style.cssText = '';
      return;
    }

    const fontFamily = element.style.fontFamily;
    if (fontFamily === FontFamilyName) {
      return;
    }

    element.classList.add('is-markup');
    element.dataset.markup = fontFamily;
    element.setAttribute('dir', 'auto');

    if (fontFamily.includes('quote')) {
      element.classList.add('quote-like', 'quote-like-icon', 'quote-like-border');
    }
  });

  (input.querySelectorAll('.is-markup') as NodeListOf<HTMLElement>).forEach((element) => {
    const fontFamily = element.style.fontFamily;
    if (fontFamily && fontFamily !== FontFamilyName) {
      return;
    }

    if (!fontFamily.includes('quote')) {
      element.classList.remove('quote-like', 'quote-like-icon', 'quote-like-border');
    }

    element.classList.remove('is-markup');
    delete element.dataset.markup;
  });
  // console.log('process formatting', performance.now() - perf);
}

export function getMarkupInSelection<T extends MarkdownType>(types: T[], onlyFull?: boolean) {
  const result: Record<T, { elements: HTMLElement[]; active: boolean }> = {} as any;
  // eslint-disable-next-line no-return-assign
  types.forEach((tag) => result[tag] = { elements: [], active: false });
  const selection = window.getSelection();
  if (selection!.isCollapsed) {
    return result;
  }

  const range = selection!.getRangeAt(0);
  const commonAncestor = range.commonAncestorContainer;
  const root = commonAncestor.nodeType === commonAncestor.ELEMENT_NODE
    ? commonAncestor as HTMLElement
    : (commonAncestor as ChildNode).parentElement;
  const contentEditable = root!.closest('[contenteditable="true"]');
  if (!contentEditable) {
    return result;
  }

  const treeWalker = document.createTreeWalker(
    contentEditable,
    // eslint-disable-next-line no-bitwise
    NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT,
    { acceptNode: (node) => (range.intersectsNode(node) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT) },
  );

  let nodes = 0; let
    node: Node;
  while (node = treeWalker.nextNode()!) {
    ++nodes;
    for (const type of types) {
      const tag = markdownTags[type];
      // eslint-disable-next-line @typescript-eslint/naming-convention, no-underscore-dangle
      const _node = node.nodeType === node.ELEMENT_NODE ? node as HTMLElement : node.parentElement;
      const matches = _node!.closest(tag.match);
      if (matches) {
        result[type].elements.push(_node!);
      }
    }
  }

  for (const type of types) {
    result[type].active = result[type].elements.length >= (onlyFull ? nodes : 1);
  }

  return result;
}

export function isSelectionEmpty(selection = window.getSelection()) {
  if (!selection?.rangeCount) {
    return true;
  }

  const selectionRange = selection.getRangeAt(0);
  if (selectionRange.collapsed || !selectionRange.START_TO_END) {
    return true;
  }

  return false;
}

export function cancelEvent(event?: Event) {
  event ||= window.event;
  if (event) {
    // 'input' event will have cancelable=false, but we still need to preventDefault
    // if(!event.cancelable) {
    //   return false;
    // }

    // @ts-ignore
    event = event.originalEvent || event;

    try {
      if (event!.stopPropagation!) event!.stopPropagation();
      if (event!.preventDefault!) event!.preventDefault();
      event!.returnValue = false;
      event!.cancelBubble = true;
    } catch (err) { /* empty */ }
  }

  return false;
}

export function findUpClassName(el: EventTarget | { closest: (selector: string) => any }, className: string): HTMLElement {
  return (el as any).closest(`.${className}`);
}

export function getVisibleRect(
  element: HTMLElement,
  overflowElement: HTMLElement,
  lookForSticky?: boolean,
  rect: DOMRectMinified = element.getBoundingClientRect(),
  overflowRect: DOMRectMinified = overflowElement.getBoundingClientRect(),
) {
  let {
    // eslint-disable-next-line prefer-const
    top: overflowTop, right: overflowRight, bottom: overflowBottom, left: overflowLeft,
  } = overflowRect;

  // * respect sticky headers
  if (lookForSticky) {
    const sticky = overflowElement.querySelector('.sticky');
    if (sticky) {
      const stickyRect = sticky.getBoundingClientRect();
      overflowTop = stickyRect.bottom;
    }
  }

  if (rect.top >= overflowBottom
    || rect.bottom <= overflowTop
    || rect.right <= overflowLeft
    || rect.left >= overflowRight) {
    return null;
  }

  const overflow = {
    top: false,
    right: false,
    bottom: false,
    left: false,
    vertical: 0 as 0 | 1 | 2,
    horizontal: 0 as 0 | 1 | 2,
  };

  const { width: windowWidth, height: windowHeight } = windowSize.get();

  // eslint-disable-next-line no-return-assign
  return {
    rect: {
      top: rect.top < overflowTop && overflowTop !== 0 ? (overflow.top = true, ++overflow.vertical, overflowTop) : rect.top,
      right: rect.right > overflowRight && overflowRight !== windowWidth ? (overflow.right = true, ++overflow.horizontal, overflowRight) : rect.right,
      bottom: rect.bottom > overflowBottom && overflowBottom !== windowHeight ? (overflow.bottom = true, ++overflow.vertical, overflowBottom) : rect.bottom,
      left: rect.left < overflowLeft && overflowLeft !== 0 ? (overflow.left = true, ++overflow.horizontal, overflowLeft) : rect.left,
    },
    overflow,
  };
}

export function indexOfAndSplice<T>(array: Array<T>, item: T) {
  const idx = array.indexOf(item);
  const spliced = idx === -1 ? undefined : array.splice(idx, 1);
  return spliced?.[0];
}

export function getCharAfterRange(range: Range): string | undefined {
  const newRange = document.createRange();

  if (range.endContainer.nodeType === Node.TEXT_NODE && range.endOffset < range.endContainer.nodeValue!.length) {
    newRange.setStart(range.endContainer, range.endOffset);
    newRange.setEnd(range.endContainer, range.endOffset + 1);
    return newRange.toString();
  }
  const nextTextNode = findNextTextNode(range.endContainer);
  if (nextTextNode) {
    newRange.setStart(nextTextNode, 0);
    newRange.setEnd(nextTextNode, Math.min(nextTextNode.nodeValue!.length, 1));
    return newRange.toString();
  }

  return undefined;
}

function findNextTextNode(node: Node): Text | undefined {
  while (node && !node.nextSibling) {
    node = node.parentNode!;
  }

  if (node && node.nextSibling) {
    return findFirstTextNode(node.nextSibling);
  }

  return undefined;
}

function findFirstTextNode(node: Node): Text | undefined {
  if (node.nodeType === Node.TEXT_NODE) {
    return node as Text;
  }

  for (let i = 0; i < node.childNodes.length; i++) {
    const child = node.childNodes[i];
    const result = findFirstTextNode(child);
    if (result) {
      return result;
    }
  }

  return undefined;
}

export function resetCurrentFormatting() {
  return document.execCommand('removeFormat', false, undefined);
}

export function resetCurrentFontFormatting() {
  return document.execCommand('fontName', false, FontFamilyName);
}

export function whichChild(elem: Node, countNonElements?: boolean) {
  if (!elem?.parentNode) {
    return -1;
  }

  if (countNonElements) {
    return Array.from(elem.parentNode.childNodes).indexOf(elem as ChildNode);
  }

  let i = 0;
  // @ts-ignore
  while ((elem = elem.previousElementSibling) !== null) ++i;
  return i;
}

export function findUpAsChild<T extends { parentElement: HTMLElement }>(el: T, parent: HTMLElement): T | null {
  if (!el) return null;
  if (el.parentElement === parent) return el;

  while (el.parentElement) {
    el = el.parentElement as any;
    if (el.parentElement === parent) {
      return el;
    }
  }

  return null;
}

export function compareNodes(node1: ChildNode, node1Offset: number, node2: ChildNode, node2Offset: number) {
  let diff: number;
  if (node1 === node2) {
    diff = node1Offset - node2Offset;
  } else if (node1.parentElement === node2.parentElement) {
    diff = whichChild(node1, true) - whichChild(node2, true);
  } else {
    const parents: HTMLElement[] = [];
    let parentElement = node1.parentElement;
    do {
      parents.push(parentElement!);
    } while (parentElement = parentElement!.parentElement);

    parentElement = node2.parentElement;
    do {
      if (parents.includes(parentElement!)) {
        break;
      }
    } while (parentElement = parentElement!.parentElement);

    const commonAncestorContainer = parentElement;
    // const range = document.createRange();
    // range.setStart(node1, 0);
    // range.setEnd(node2, node2.textContent.length);
    // const {commonAncestorContainer} = range;
    node1 = findUpAsChild(node1 as any, commonAncestorContainer as HTMLElement);
    node2 = findUpAsChild(node2 as any, commonAncestorContainer as HTMLElement);
    diff = whichChild(node1, true) - whichChild(node2, true);
  }

  return clamp(diff, -1, 1);
}

export function isCustomFillerNeededBySiblingNode(node: ChildNode) {
  if (
    // !node?.textContent ||
    // node.textContent.endsWith('\n') ||
    node?.textContent !== BOM
    || (node as HTMLElement)?.getAttribute?.('contenteditable') === 'false'
  ) {
    // if(!node || (node as HTMLElement).firstElementChild || node.textContent.endsWith('\n')) {
    if (!node || node.textContent !== BOM || (node as HTMLElement).firstElementChild) {
      return 2;
    } else if (node.nodeType === node.ELEMENT_NODE) {
      return 1;
    }/*  else if(node.nodeType === node.TEXT_NODE && !node.nodeValue) {
      (node as CharacterData).insertData(0, BOM);
    } */
  }

  return 0;
}

export function getCaretPosNew(input: HTMLElement, anchor?: boolean): ReturnType<typeof getCaretPosF> & { selection: Selection } {
  const selection = document.getSelection()!;
  // let {focusNode: node, focusOffset: offset} = selection;
  const node = selection![anchor ? 'anchorNode' : 'focusNode'];
  const offset = selection![anchor ? 'anchorOffset' : 'focusOffset'];
  if (!findUpAsChild(node as any, input) && node !== input) {
    return { selection } as any;
  }

  return { ...getCaretPosF(input, node!, offset), selection };
}

export function getCaretPosF(input: HTMLElement, node: Node, offset: number) {
  if (node === input) {
    const childNodes = input.childNodes;
    const childNodesLength = childNodes.length;
    if (childNodesLength && offset >= childNodesLength) {
      node = childNodes[childNodesLength - 1];
      offset = (node.textContent || (node as HTMLImageElement).alt || '').length;
    } else {
      node = childNodes[offset];
      offset = 0;
    }
  }

  return { node: node as ChildNode, offset };
}

export function simulateEvent(elem: EventTarget, name: string) {
  const event = new Event(name, { bubbles: true, cancelable: true });
  elem.dispatchEvent(event);
}
