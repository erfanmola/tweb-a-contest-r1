import type { FC } from '../../lib/teact/teact';
import React, {
  useEffect, useMemo, useRef, useState,
} from '../../lib/teact/teact';
import { getActions, getGlobal, withGlobal } from '../../global';

import type { ApiChatFolder, ApiChatlistExportedInvite, ApiMessageEntityCustomEmoji } from '../../api/types';
import type { FolderEditDispatch } from '../../hooks/reducers/useFoldersReducer';
import type { LeftColumnContent } from '../../types';
import type { IconName } from '../../types/icons';
import type { MenuItemContextAction } from '../ui/ListItem';
import type { TabWithProperties } from '../ui/TabList';

import { ALL_FOLDER_ID, FILTER_EMOTICON_ICONS } from '../../config';
import { selectCanShareFolder } from '../../global/selectors';
import { selectCurrentLimit } from '../../global/selectors/limits';
import buildClassName from '../../util/buildClassName';
import captureEscKeyListener from '../../util/captureEscKeyListener';
import { MEMO_EMPTY_ARRAY } from '../../util/memo';
import { MouseButton } from '../../util/windowEnvironment';
import renderText from '../common/helpers/renderText';
import { renderTextWithEntities } from '../common/helpers/renderTextWithEntities';

import useAppLayout from '../../hooks/useAppLayout';
import useContextMenuHandlers from '../../hooks/useContextMenuHandlers';
import { useFastClick } from '../../hooks/useFastClick';
import { useFolderManagerForUnreadCounters } from '../../hooks/useFolderManager';
import useHistoryBack from '../../hooks/useHistoryBack';
import useLang from '../../hooks/useLang';
import useLastCallback from '../../hooks/useLastCallback';

import CustomEmoji from '../common/CustomEmoji';
import Icon from '../common/icons/Icon';
import Menu from '../ui/Menu';
import MenuItem from '../ui/MenuItem';
import MenuSeparator from '../ui/MenuSeparator';
import { FIRST_FOLDER_INDEX, SAVED_MESSAGES_HOTKEY } from './main/ChatFolders';
import LeftMainMenu from './main/LeftMainMenu';

import './LeftColumnBar.scss';

type OwnProps = {
  shouldHideSearch?: boolean;
  content: LeftColumnContent;
  shouldSkipTransition?: boolean;
  onSelectSettings: NoneToVoidFunction;
  onSelectContacts: NoneToVoidFunction;
  onSelectArchived: NoneToVoidFunction;
  onReset: NoneToVoidFunction;
  foldersDispatch: FolderEditDispatch;
  setContent: (content: LeftColumnContent) => void;
};

type StateProps = {
  orderedFolderIds?: number[];
  chatFoldersById: Record<number, ApiChatFolder>;
  folderInvitesById: Record<number, ApiChatlistExportedInvite[]>;
  currentUserId?: string;
  maxFolders: number;
  maxChatLists: number;
  maxFolderInvites: number;
};

type LeftBarFolderTab = TabWithProperties & {
  folder: ApiChatFolder;
  onClick: () => void;
};

// According to TDesktop: https://github.com/tdlib/td/blob/28c6f2e9c045372d50217919bf5768b7fbbe0294/td/telegram/DialogFilter.cpp#L365
const getChosenOrDefaultIconName = (folder: ApiChatFolder): IconName => {
  if (folder.id === FIRST_FOLDER_INDEX) {
    return 'filter-chats';
  }

  if (folder.emoticon) {
    if (folder.emoticon in FILTER_EMOTICON_ICONS) {
      return FILTER_EMOTICON_ICONS[folder.emoticon];
    }

    return 'filter-folder';
  }

  if ((folder.pinnedChatIds ?? []).length > 0 || (folder.includedChatIds ?? []).length > 0) {
    return 'filter-folder';
  }

  if (folder.contacts || folder.nonContacts) {
    if (!folder.bots && !folder.groups && !folder.channels) {
      return 'filter-user';
    }
  } else {
    if (!folder.bots && !folder.channels) {
      if (!folder.groups) {
        return 'filter-folder';
      }
      return 'filter-group';
    }

    if (!folder.bots && !folder.groups) {
      return 'filter-channel';
    }

    if (!folder.groups && !folder.channels) {
      return 'filter-bot';
    }
  }

  if (folder.excludeRead && !folder.excludeMuted) {
    // We use chat icon as unread since there is no svg provided
    return 'filter-chat';
  }

  if (folder.excludeMuted && !folder.excludeRead) {
    // We use chat icon as unmuted since there is no svg provided
    return 'filter-chat';
  }

  return 'filter-folder';
};

export const LeftColumnBarFolderIcon: FC<{ folder: ApiChatFolder }> = ({ folder }) => {
  const customEmojiIcon = folder.title.entities?.reduce(
    (prev, curr) => ((curr.type === 'MessageEntityCustomEmoji') ? (prev + 1) : prev), 0,
  ) === 1
    ? folder.title.entities?.find((item) => (
      item.type === 'MessageEntityCustomEmoji'
    && (item.offset === 0 || (item.offset === folder.title.text.length - item.length))
    )) as (ApiMessageEntityCustomEmoji | undefined) : undefined;

  return customEmojiIcon ? (
    <CustomEmoji
      key={customEmojiIcon.documentId}
      documentId={customEmojiIcon.documentId}
      loopLimit={1}
      noPlay={folder.noTitleAnimations}
    />
  ) : (<Icon name={getChosenOrDefaultIconName(folder)} />);
};

const LeftColumnBarFolder: FC<{ folderTab: LeftBarFolderTab; active: boolean }> = (props) => {
  // eslint-disable-next-line no-null/no-null
  const folderItemRef = useRef<HTMLDivElement>(null);

  const {
    folderTab: {
      badgeCount, isBadgeActive, contextActions, onClick, folder,
    },
    active,
  } = props;

  const {
    contextMenuAnchor, handleContextMenu, handleBeforeContextMenu, handleContextMenuClose,
    handleContextMenuHide, isContextMenuOpen,
  } = useContextMenuHandlers(folderItemRef, !contextActions);

  const { handleClick, handleMouseDown } = useFastClick((e: React.MouseEvent<HTMLDivElement>) => {
    if (contextActions && (e.button === MouseButton.Secondary || !onClick)) {
      handleBeforeContextMenu(e);
    }

    if (e.type === 'mousedown' && e.button !== MouseButton.Main) {
      return;
    }

    onClick();
  });

  const getTriggerElement = useLastCallback(() => folderItemRef.current);
  const getRootElement = useLastCallback(
    () => (folderItemRef.current!.closest('#LeftColumn')),
  );
  const getMenuElement = useLastCallback(
    () => document.querySelector('#portals')!.querySelector('.Folder-context-menu .bubble'),
  );
  const getLayout = useLastCallback(() => ({ withPortal: true }));

  const customEmojiIcon = folder.title.entities?.reduce(
    (prev, curr) => ((curr.type === 'MessageEntityCustomEmoji') ? (prev + 1) : prev), 0,
  ) === 1
    ? folder.title.entities?.find((item) => (
      item.type === 'MessageEntityCustomEmoji'
    && (item.offset === 0 || (item.offset === folder.title.text.length - item.length))
    )) as (ApiMessageEntityCustomEmoji | undefined) : undefined;

  const titleRendered = renderTextWithEntities({
    text: customEmojiIcon
      ? (folder.title.text.slice(0, customEmojiIcon.offset)
    + folder.title.text.slice(customEmojiIcon.offset + customEmojiIcon.length))
      : folder.title.text,
    entities: customEmojiIcon
      ? (folder.title.entities?.filter((item) => item !== customEmojiIcon))
      : folder.title.entities,
    noCustomEmojiPlayback: folder.noTitleAnimations,
  });

  return (
    <div
      onClick={handleClick}
      onMouseDown={handleMouseDown}
      onContextMenu={handleContextMenu}
      ref={folderItemRef}
      className={buildClassName(active && 'active')}
    >
      <LeftColumnBarFolderIcon folder={folder} />
      <span>
        {typeof titleRendered === 'string' ? renderText(titleRendered) : titleRendered}
      </span>
      {Boolean(badgeCount) && (
        <span className={buildClassName('badge', isBadgeActive && 'badgeActive')}>{badgeCount}</span>
      )}

      {contextActions && contextMenuAnchor !== undefined && (
        <Menu
          isOpen={isContextMenuOpen}
          anchor={contextMenuAnchor}
          getTriggerElement={getTriggerElement}
          getRootElement={getRootElement}
          getMenuElement={getMenuElement}
          getLayout={getLayout}
          className="Folder-context-menu"
          autoClose
          onClose={handleContextMenuClose}
          onCloseAnimationEnd={handleContextMenuHide}
          withPortal
        >
          {contextActions.map((action) => (
            ('isSeparator' in action) ? (
              <MenuSeparator key={action.key || 'separator'} />
            ) : (
              <MenuItem
                key={action.title}
                icon={action.icon}
                destructive={action.destructive}
                disabled={!action.handler}
                onClick={action.handler}
              >
                {action.title}
              </MenuItem>
            )
          ))}
        </Menu>
      )}
    </div>
  );
};

const LeftColumnBar: FC<OwnProps & StateProps> = ({
  shouldHideSearch,
  content,
  shouldSkipTransition,
  onSelectSettings,
  onSelectContacts,
  onSelectArchived,
  onReset,
  chatFoldersById,
  folderInvitesById,
  orderedFolderIds,
  currentUserId,
  maxFolders,
  maxChatLists,
  maxFolderInvites,
  setContent,
  // foldersDispatch,
}) => {
  const { isMobile } = useAppLayout();

  const [activeChatFolderIndex, setActiveChatFolderIndex] = useState(FIRST_FOLDER_INDEX);

  const {
    loadChatFolders,
    setActiveChatFolder,
    openChat,
    openShareChatFolderModal,
    openDeleteChatFolderModal,
    openEditChatFolder,
    openLimitReachedModal,
  } = getActions();

  const lang = useLang();

  useEffect(() => {
    loadChatFolders();
  }, []);

  const allChatsFolder: ApiChatFolder = useMemo(() => {
    return {
      id: ALL_FOLDER_ID,
      title: { text: orderedFolderIds?.[0] === ALL_FOLDER_ID ? lang('FilterAllChatsShort') : lang('FilterAllChats') },
      includedChatIds: MEMO_EMPTY_ARRAY,
      excludedChatIds: MEMO_EMPTY_ARRAY,
    } satisfies ApiChatFolder;
  }, [orderedFolderIds, lang]);

  const displayedFolders = useMemo(() => {
    return orderedFolderIds
      ? orderedFolderIds.map((id) => {
        if (id === ALL_FOLDER_ID) {
          return allChatsFolder;
        }

        return chatFoldersById[id] || {};
      }).filter(Boolean)
      : undefined;
  }, [chatFoldersById, allChatsFolder, orderedFolderIds]);

  // const allChatsFolderIndex = displayedFolders?.findIndex((folder) => folder.id === ALL_FOLDER_ID);
  const isInFirstFolder = FIRST_FOLDER_INDEX === activeChatFolderIndex;

  const folderCountersById = useFolderManagerForUnreadCounters();
  const folderTabs = useMemo(() => {
    if (!displayedFolders || !displayedFolders.length) {
      return undefined;
    }

    return displayedFolders.map((folder, i) => {
      const { id, title } = folder;
      const isBlocked = id !== ALL_FOLDER_ID && i > maxFolders - 1;
      const canShareFolder = selectCanShareFolder(getGlobal(), id);
      const contextActions: MenuItemContextAction[] = [];

      if (canShareFolder) {
        contextActions.push({
          title: lang('FilterShare'),
          icon: 'link',
          handler: () => {
            const chatListCount = Object.values(chatFoldersById).reduce((acc, el) => acc + (el.isChatList ? 1 : 0), 0);
            if (chatListCount >= maxChatLists && !folder.isChatList) {
              openLimitReachedModal({
                limit: 'chatlistJoined',
              });
              return;
            }

            // Greater amount can be after premium downgrade
            if (folderInvitesById[id]?.length >= maxFolderInvites) {
              openLimitReachedModal({
                limit: 'chatlistInvites',
              });
              return;
            }

            openShareChatFolderModal({
              folderId: id,
            });
          },
        });
      }

      if (id !== ALL_FOLDER_ID) {
        contextActions.push({
          title: lang('FilterEdit'),
          icon: 'edit',
          handler: () => {
            openEditChatFolder({ folderId: id });
          },
        });

        contextActions.push({
          title: lang('FilterDelete'),
          icon: 'delete',
          destructive: true,
          handler: () => {
            openDeleteChatFolderModal({ folderId: id });
          },
        });
      }

      return {
        id,
        title: renderTextWithEntities({
          text: title.text,
          entities: title.entities,
          noCustomEmojiPlayback: folder.noTitleAnimations,
        }),
        folder,
        badgeCount: folderCountersById[id]?.chatsCount,
        isBadgeActive: Boolean(folderCountersById[id]?.notificationsCount),
        isBlocked,
        contextActions: contextActions?.length ? contextActions : undefined,
        onClick: () => {
          setContent(0);
          setTimeout(() => {
            setActiveChatFolderIndex(i);
            setActiveChatFolder({ activeChatFolder: i }, { forceOnHeavyAnimation: true });
          });
        },
      } satisfies LeftBarFolderTab;
    });
  }, [
    displayedFolders, maxFolders, folderCountersById, lang, chatFoldersById, maxChatLists, folderInvitesById,
    maxFolderInvites, setContent,
  ]);

  useEffect(() => {
    if (!folderTabs?.length) {
      return;
    }

    if (activeChatFolderIndex >= folderTabs.length) {
      setActiveChatFolderIndex(FIRST_FOLDER_INDEX);
      setActiveChatFolder({ activeChatFolder: FIRST_FOLDER_INDEX });
    }
  }, [activeChatFolderIndex, folderTabs, setActiveChatFolder]);

  const isNotInFirstFolderRef = useRef();
  isNotInFirstFolderRef.current = !isInFirstFolder;
  useEffect(() => (!isMobile && isNotInFirstFolderRef.current ? captureEscKeyListener(() => {
    if (isNotInFirstFolderRef.current) {
      setActiveChatFolderIndex(FIRST_FOLDER_INDEX);
      setActiveChatFolder({ activeChatFolder: FIRST_FOLDER_INDEX });
    }
  }) : undefined), [activeChatFolderIndex, setActiveChatFolder, isMobile]);

  useHistoryBack({
    isActive: !isInFirstFolder && !isMobile,
    onBack: () => {
      setActiveChatFolderIndex(FIRST_FOLDER_INDEX);
      setActiveChatFolder({ activeChatFolder: FIRST_FOLDER_INDEX }, { forceOnHeavyAnimation: true });
    },
  });

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.code.startsWith('Digit') && folderTabs) {
        const [, digit] = e.code.match(/Digit(\d)/) || [];
        if (!digit) return;

        if (digit === SAVED_MESSAGES_HOTKEY) {
          openChat({ id: currentUserId, shouldReplaceHistory: true });
          return;
        }

        const folder = Number(digit) - 1;
        if (folder > folderTabs.length - 1) return;

        setActiveChatFolderIndex(folder);
        setActiveChatFolder({ activeChatFolder: folder }, { forceOnHeavyAnimation: true });
        e.preventDefault();
      }
    };

    document.addEventListener('keydown', handleKeyDown, true);

    return () => {
      document.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [currentUserId, folderTabs, openChat, setActiveChatFolder]);

  return (
    <div id="LeftColumn-Bar">
      <LeftMainMenu
        content={content}
        onReset={onReset}
        onSelectArchived={onSelectArchived}
        onSelectContacts={onSelectContacts}
        onSelectSettings={onSelectSettings}
        shouldHideSearch={shouldHideSearch}
        shouldSkipTransition={shouldSkipTransition}
        forceHasMenu
      />

      {folderTabs && (
        <section>{folderTabs.map((item, i) => (
          <LeftColumnBarFolder
            folderTab={item}
            active={activeChatFolderIndex === i}
          />
        ))}
        </section>
      )}
    </div>
  );
};

export default withGlobal<OwnProps>((global): StateProps => {
  const {
    chatFolders: {
      byId: chatFoldersById,
      orderedIds: orderedFolderIds,
      invites: folderInvitesById,
    },
    currentUserId,
  } = global;

  return {
    chatFoldersById,
    folderInvitesById,
    orderedFolderIds,
    currentUserId,
    maxFolders: selectCurrentLimit(global, 'dialogFilters'),
    maxFolderInvites: selectCurrentLimit(global, 'chatlistInvites'),
    maxChatLists: selectCurrentLimit(global, 'chatlistJoined'),
  };
})(LeftColumnBar);
