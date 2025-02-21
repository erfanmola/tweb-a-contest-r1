/* eslint-disable @typescript-eslint/indent */
/* eslint-disable max-len */

export type MessageEntityUnknown = {
  _: 'messageEntityUnknown';
  offset: number;
  length: number;
};

export type MessageEntityMention = {
  _: 'messageEntityMention';
  offset: number;
  length: number;
};

export type MessageEntityHashtag = {
  _: 'messageEntityHashtag';
  offset: number;
  length: number;
};

export type MessageEntityBotCommand = {
  _: 'messageEntityBotCommand';
  offset: number;
  length: number;
  unsafe?: boolean;
};

export type MessageEntityUrl = {
  _: 'messageEntityUrl';
  offset: number;
  length: number;
};

export type MessageEntityEmail = {
  _: 'messageEntityEmail';
  offset: number;
  length: number;
};

export type MessageEntityBold = {
  _: 'messageEntityBold';
  offset: number;
  length: number;
};

export type MessageEntityItalic = {
  _: 'messageEntityItalic';
  offset: number;
  length: number;
};

export type MessageEntityCode = {
  _: 'messageEntityCode';
  offset: number;
  length: number;
};

export type MessageEntityPre = {
  _: 'messageEntityPre';
  offset: number;
  length: number;
  language: string;
};

export type MessageEntityTextUrl = {
  _: 'messageEntityTextUrl';
  offset: number;
  length: number;
  url: string;
};

export type MessageEntityMentionName = {
  _: 'messageEntityMentionName';
  offset: number;
  length: number;
  user_id: string | number;
};

export type InputMessageEntityMentionName = {
  _: 'inputMessageEntityMentionName';
  offset: number;
  length: number;
  user_id: InputUser;
};

export type MessageEntityPhone = {
  _: 'messageEntityPhone';
  offset: number;
  length: number;
};

export type MessageEntityCashtag = {
  _: 'messageEntityCashtag';
  offset: number;
  length: number;
};

export type MessageEntityUnderline = {
  _: 'messageEntityUnderline';
  offset: number;
  length: number;
};

export type MessageEntityStrike = {
  _: 'messageEntityStrike';
  offset: number;
  length: number;
};

export type MessageEntityBankCard = {
  _: 'messageEntityBankCard';
  offset: number;
  length: number;
};

export type MessageEntitySpoiler = {
  _: 'messageEntitySpoiler';
  offset: number;
  length: number;
};

export type MessageEntityCustomEmoji = {
  _: 'messageEntityCustomEmoji';
  offset: number;
  length: number;
  document_id: string | number;
};

export type MessageEntityBlockquote = {
  _: 'messageEntityBlockquote';
  flags?: number;
  pFlags: Partial<{
    collapsed?: true;
  }>;
  offset: number;
  length: number;
};

export type MessageEntityEmoji = {
  _: 'messageEntityEmoji';
  offset?: number;
  length?: number;
  unicode?: string;
};

export type MessageEntityHighlight = {
  _: 'messageEntityHighlight';
  offset?: number;
  length?: number;
};

export type MessageEntityLinebreak = {
  _: 'messageEntityLinebreak';
  offset?: number;
  length?: number;
};

export type MessageEntityCaret = {
  _: 'messageEntityCaret';
  offset?: number;
  length?: number;
};

export type MessageEntityTimestamp = {
  _: 'messageEntityTimestamp';
  offset?: number;
  length?: number;
  time?: number;
  raw?: string;
};

export type MessageEntity =
  | MessageEntityUnknown
  | MessageEntityMention
  | MessageEntityHashtag
  | MessageEntityBotCommand
  | MessageEntityUrl
  | MessageEntityEmail
  | MessageEntityBold
  | MessageEntityItalic
  | MessageEntityCode
  | MessageEntityPre
  | MessageEntityTextUrl
  | MessageEntityMentionName
  | inputMessageEntityMentionName
  | MessageEntityPhone
  | MessageEntityCashtag
  | MessageEntityUnderline
  | MessageEntityStrike
  | MessageEntityBankCard
  | MessageEntitySpoiler
  | MessageEntityCustomEmoji
  | MessageEntityBlockquote
  | MessageEntityEmoji
  | MessageEntityHighlight
  | MessageEntityLinebreak
  | MessageEntityCaret
  | MessageEntityTimestamp;

export type MarkdownType = 'bold' | 'italic' | 'underline' | 'strikethrough' | 'monospace' | 'link' | 'mentionName' | 'spoiler' | 'quote';

export type MarkdownTag = {
  match: string;
  entityName: Extract<
    MessageEntity['_'], 'messageEntityBold' | 'messageEntityUnderline' |
    'messageEntityItalic' | 'messageEntityCode' | 'messageEntityStrike' |
    'messageEntityTextUrl' | 'messageEntityMentionName' | 'messageEntitySpoiler' |
    'messageEntityBlockquote'
  >;
};

type DOMRectMinified = { top: number; right: number; bottom: number; left: number };
