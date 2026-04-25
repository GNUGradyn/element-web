/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type JSX, memo, useEffect, useRef, type ReactNode, useState } from "react";
import classNames from "classnames";
import { Text } from "@vector-im/compound-web";

import { Flex } from "../../../../core/utils/Flex";
import { NotificationDecoration, type NotificationDecorationData } from "./NotificationDecoration";
import {
    type CallParticipantListItem,
    CallParticipantsList,
    type CallParticipantsListData,
} from "./CallParticipantsList";
import { RoomListItemHoverMenu } from "./RoomListItemHoverMenu";
import { RoomListItemContextMenu } from "./RoomListItemContextMenu";
import { type RoomNotifState } from "./RoomNotifs";
import styles from "./RoomListItemView.module.css";
import { useViewModel, type ViewModel } from "../../../../core/viewmodel";
import { _t } from "../../../../core/i18n/i18n";

const CALL_ROOM_ICON_SIZE = 24;

/**
 * Opaque type representing a Room object from the parent application
 */
export type Room = unknown;

/**
 * Generate an accessible label for a room based on its notification state.
 */
function getA11yLabel(roomName: string, notification: NotificationDecorationData): string {
    if (notification.isUnsentMessage) {
        return _t("room_list|a11y|unsent_message", { roomName });
    } else if (notification.invited) {
        return _t("room_list|a11y|invitation", { roomName });
    } else if (notification.isMention && notification.count) {
        return _t("room_list|a11y|mention", { roomName, count: notification.count });
    } else if (notification.hasUnreadCount && notification.count) {
        return _t("room_list|a11y|unread", { roomName, count: notification.count });
    } else if (notification.callType === "voice") {
        return _t("room_list|a11y|voice_call", { roomName });
    } else if (notification.callType === "video") {
        return _t("room_list|a11y|video_call", { roomName });
    } else {
        return _t("room_list|a11y|default", { roomName });
    }
}

/**
 * Describes a section that a room can be assigned to.
 * Used to render toggle items in the "Move to section" submenu.
 */
export interface Section {
    /** The tag that identifies this section (e.g. `m.favourite`, custom tag) */
    tag: string;
    /** The human-readable display name of the section */
    name: string;
    /** Whether the room currently belongs to this section */
    isSelected: boolean;
}

/**
 * Snapshot for a room list item.
 * Contains all the data needed to render a room in the list.
 */
export interface RoomListItemViewSnapshot {
    /** Unique identifier for the room (used for list keying) */
    id: string;
    /** The opaque Room object from the client (e.g., matrix-js-sdk Room) */
    room: Room;
    /** The name of the room */
    name: string;
    /** Whether the room name should be bolded (has unread/activity) */
    isBold: boolean;
    /** Optional message preview text */
    messagePreview?: string;
    /** Notification decoration data */
    notification: NotificationDecorationData;
    /** Whether the more options menu should be shown */
    showMoreOptionsMenu: boolean;
    /** Whether the notification menu should be shown */
    showNotificationMenu: boolean;
    /** Whether the room is a favourite room */
    isFavourite: boolean;
    /** Whether the room is a low priority room */
    isLowPriority: boolean;
    /** Can invite other users in the room */
    canInvite: boolean;
    /** Can copy the room link */
    canCopyRoomLink: boolean;
    /** Can mark the room as read */
    canMarkAsRead: boolean;
    /** Can mark the room as unread */
    canMarkAsUnread: boolean;
    /** The room's notification state */
    roomNotifState: RoomNotifState;
    /** Optional data for the participant list in a call channel */
    callParticipants?: CallParticipantsListData;
    /** Whether the room can be moved to a section */
    canMoveToSection: boolean;
    /** Available sections the room can be assigned to */
    sections: Section[];
}

/**
 * Actions interface for room list item operations.
 * Implemented by the room item view model.
 */
export interface RoomListItemViewActions {
    /** Called when the room should be opened */
    onOpenRoom: () => void;
    /** Called when the room should be marked as read */
    onMarkAsRead: () => void;
    /** Called when the room should be marked as unread */
    onMarkAsUnread: () => void;
    /** Called when the room's favorite status should be toggled */
    onToggleFavorite: () => void;
    /** Called when the room's low priority status should be toggled */
    onToggleLowPriority: () => void;
    /** Called when inviting users to the room */
    onInvite: () => void;
    /** Called when copying the room link */
    onCopyRoomLink: () => void;
    /** Called when leaving the room */
    onLeaveRoom: () => void;
    /** Called when setting the room notification state */
    onSetRoomNotifState: (state: RoomNotifState) => void;
    /** Called when creating a new section */
    onCreateSection: () => void;
    /** Called when toggling a room's membership in a section */
    onToggleSection: (tag: string) => void;
}

/**
 * The view model type for a room list item
 */
export type RoomListItemViewModel = ViewModel<RoomListItemViewSnapshot, RoomListItemViewActions>;

/**
 * Props for RoomListItemView component
 */
export interface RoomListItemViewProps extends Omit<React.HTMLAttributes<HTMLButtonElement>, "onFocus"> {
    /** The room item view model */
    vm: RoomListItemViewModel;
    /** Whether the room is selected */
    isSelected: boolean;
    /** Whether the room should be focused */
    isFocused: boolean;
    /** Callback when item receives focus */
    onFocus: (roomId: string, e: React.FocusEvent) => void;
    /** Whether this is the first item in the list */
    isFirstItem: boolean;
    /** Whether this is the last item in the list */
    isLastItem: boolean;
    /** Function to render the room avatar */
    renderAvatar: (room: Room) => ReactNode;
    /** Function to render a user avatar for the member list on a call channel */
    renderCallUserAvatar: (participant: CallParticipantListItem) => ReactNode;
}

/**
 * A presentational room list item component.
 * Displays room name, avatar, message preview, and notifications.
 */
export const RoomListItemView = memo(function RoomListItemView({
    vm,
    isSelected,
    isFocused,
    onFocus,
    isFirstItem,
    isLastItem,
    renderAvatar,
    renderCallUserAvatar,
    ...props
}: RoomListItemViewProps): JSX.Element {
    const ref = useRef<HTMLButtonElement>(null);
    const contentRef = useRef<HTMLDivElement>(null);

    const [maxCallRoomIcons, setMaxCallRoomIcons] = useState<number>(0);

    const item = useViewModel(vm);

    useEffect(() => {
        if (isFocused) {
            ref.current?.focus({ preventScroll: true, focusVisible: true } as FocusOptions);
        }
    }, [isFocused]);

    useEffect(() => {
        if (!contentRef.current) return;

        const updateSize = (): void => {
            if (!contentRef.current) return;

            const containerRect = contentRef.current.getBoundingClientRect();

            setMaxCallRoomIcons(Math.floor(containerRect.width / 2 / CALL_ROOM_ICON_SIZE));
        };

        updateSize();

        const observer = new ResizeObserver((entries) => {
            for (const entry of entries) {
                if (contentRef.current === entry.target) updateSize();
            }
        });

        if (contentRef.current) observer.observe(contentRef.current);

        return () => observer.disconnect();
    }, []);

    // Generate a11y label from notification state and room name
    const a11yLabel = getA11yLabel(item.name, item.notification);

    return (
        <RoomListItemContextMenu vm={vm}>
            <Flex
                as="button"
                ref={ref}
                className={classNames(styles.roomListItem, "mx_RoomListItemView", {
                    [styles.selected]: isSelected,
                    [styles.bold]: item.isBold,
                    [styles.firstItem]: isFirstItem,
                    [styles.lastItem]: isLastItem,
                    mx_RoomListItemView_selected: isSelected,
                })}
                gap="var(--cpd-space-3x)"
                align="stretch"
                type="button"
                aria-selected={isSelected}
                aria-label={a11yLabel}
                onClick={vm.onOpenRoom}
                onFocus={(e: React.FocusEvent<HTMLButtonElement>) => onFocus(item.id, e)}
                tabIndex={isFocused ? 0 : -1}
                {...props}
            >
                <Flex className={styles.container} gap="var(--cpd-space-3x)" align="center">
                    {renderAvatar(item.room)}
                    <Flex className={styles.content} gap="var(--cpd-space-2x)" align="center" justify="space-between">
                        {/* We truncate the room name when too long. Title here is to show the full name on hover */}
                        <div className={styles.ellipsis}>
                            <div className={styles.roomName} title={item.name} data-testid="room-name">
                                {item.name}
                            </div>
                            {item.messagePreview && (
                                <Text as="div" size="sm" className={styles.ellipsis} title={item.messagePreview}>
                                    {item.messagePreview}
                                </Text>
                            )}
                        </div>
                        {/**Container for both so they are both right-aligned via the flex container*/}
                        <div className={styles.rightAlignedContainer}>
                            {item.callParticipants && (
                                <div className={styles.callRoomList}>
                                    <CallParticipantsList
                                        renderAvatar={renderCallUserAvatar}
                                        {...item.callParticipants}
                                        maxIcons={maxCallRoomIcons}
                                    />
                                </div>
                            )}
                            {/* aria-hidden because we summarise the unread count/notification status in a11yLabel */}
                            {item.notification.hasAnyNotificationOrActivity && (
                                <div className={styles.notificationDecoration} aria-hidden={true}>
                                    <NotificationDecoration {...item.notification} />
                                </div>
                            )}
                        </div>
                        {(item.showMoreOptionsMenu || item.showNotificationMenu) && (
                            <RoomListItemHoverMenu
                                showMoreOptionsMenu={item.showMoreOptionsMenu}
                                showNotificationMenu={item.showNotificationMenu}
                                vm={vm}
                            />
                        )}
                    </Flex>
                </Flex>
            </Flex>
        </RoomListItemContextMenu>
    );
});
