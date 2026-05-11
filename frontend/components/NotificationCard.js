'use client';

import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import api from '../services/api';
import { FONTS, SIZES, SPACING } from '../utils/constants';

export default function NotificationCard({ notification, onMarkAsRead }) {
  const { colors } = useTheme();

  const getNotificationMeta = (type, priority) => {
    const priorityConfig = {
      LOW: { color: colors.info, icon: 'information-circle-outline' },
      NORMAL: { color: colors.primary, icon: 'notifications-outline' },
      HIGH: { color: colors.warning, icon: 'warning-outline' },
      URGENT: { color: colors.danger, icon: 'alert-circle-outline' },
    };

    const typeConfig = {
      OUTPASS: { label: 'Outpass', icon: 'exit-outline' },
      LIBRARY: { label: 'Library', icon: 'book-outline' },
      SAC: { label: 'SAC', icon: 'shirt-outline' },
      EMERGENCY: { label: 'Emergency', icon: 'alert-outline' },
      NEWS: { label: 'News', icon: 'newspaper-outline' },
      SYSTEM: { label: 'System', icon: 'settings-outline' },
      SECURITY: { label: 'Security', icon: 'shield-outline' },
    };

    return {
      ...(priorityConfig[priority] || priorityConfig.NORMAL),
      ...(typeConfig[type] || typeConfig.SYSTEM),
    };
  };

  const formatTime = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;

    return date.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
    });
  };

  const handleMarkAsRead = async () => {
    try {
      if (!notification.isRead) {
        await api.patch(`/notifications/${notification.id}/read`);
        onMarkAsRead?.(notification.id);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to mark notification as read');
    }
  };

  const meta = getNotificationMeta(notification.type, notification.priority);

  return (
    <TouchableOpacity
      style={[
        styles.card,
        {
          backgroundColor: notification.isRead
            ? colors.cardBackground
            : colors.cardElevated,
          borderColor: colors.border,
          borderLeftColor: meta.color,
          borderLeftWidth: 4,
        },
      ]}
      onPress={handleMarkAsRead}
      activeOpacity={0.7}
    >
      <View style={styles.content}>
        <View style={styles.header}>
          <View style={styles.iconContainer}>
            <View
              style={[
                styles.iconBackground,
                { backgroundColor: `${meta.color}20` },
              ]}
            >
              <Ionicons name={meta.icon} size={20} color={meta.color} />
            </View>
          </View>

          <View style={styles.titleSection}>
            <View style={styles.titleRow}>
              <Text
                style={[
                  styles.title,
                  {
                    color: colors.text,
                    fontWeight: notification.isRead ? '400' : '600',
                  },
                ]}
                numberOfLines={1}
              >
                {notification.title}
              </Text>
              {!notification.isRead && (
                <View
                  style={[styles.unreadBadge, { backgroundColor: meta.color }]}
                />
              )}
            </View>
            <Text style={[styles.type, { color: colors.textMuted }]}>
              {meta.label}
            </Text>
          </View>

          <Text style={[styles.time, { color: colors.textMuted }]}>
            {formatTime(notification.createdAt)}
          </Text>
        </View>

        <Text
          style={[
            styles.message,
            {
              color: colors.text,
              opacity: notification.isRead ? 0.7 : 1,
            },
          ]}
          numberOfLines={2}
        >
          {notification.message}
        </Text>

        {notification.entityType && (
          <View
            style={[styles.entityBadge, { backgroundColor: `${meta.color}10` }]}
          >
            <Text style={[styles.entityText, { color: meta.color }]}>
              {notification.entityType.toUpperCase()}
            </Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: SPACING.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    borderRadius: 12,
    borderWidth: 1,
  },
  content: {
    gap: SPACING.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.md,
  },
  iconContainer: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconBackground: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  titleSection: {
    flex: 1,
    gap: SPACING.xs,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  title: {
    fontSize: SIZES.md,
    fontFamily: FONTS.semibold,
    flex: 1,
  },
  unreadBadge: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  type: {
    fontSize: SIZES.xs,
    fontFamily: FONTS.regular,
  },
  time: {
    fontSize: SIZES.xs,
    fontFamily: FONTS.regular,
    minWidth: 45,
    textAlign: 'right',
  },
  message: {
    fontSize: SIZES.sm,
    fontFamily: FONTS.regular,
    lineHeight: 20,
  },
  entityBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: 6,
  },
  entityText: {
    fontSize: SIZES.xs,
    fontFamily: FONTS.semibold,
  },
});
