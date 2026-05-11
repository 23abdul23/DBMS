'use client';

import {
  View,
  Text,
  TouchableOpacity,
  RefreshControl,
  Alert,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { useCallback, useState, useEffect, useMemo } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useFocusEffect } from '@react-navigation/native';
import api from '../services/api';

import NotificationCard from '../components/NotificationCard';
import FilterTabs from '../components/FilterTabs';
import LoadingSpinner from '../components/LoadingSpinner';

import styles from '../styles/NotificationStyles';

export default function NotificationsScreen() {
  const { isDarkMode, colors } = useTheme();
  const [notifications, setNotifications] = useState([]);
  const [filteredNotifications, setFilteredNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeFilter, setActiveFilter] = useState('all');
  const [unreadCount, setUnreadCount] = useState(0);

  const typeCounts = useMemo(() => {
    const counts = {
      all: notifications.length,
      unread: notifications.filter((n) => !n.isRead).length,
      outpass: notifications.filter((n) => n.type === 'OUTPASS').length,
      library: notifications.filter((n) => n.type === 'LIBRARY').length,
      emergency: notifications.filter((n) => n.type === 'EMERGENCY').length,
      system: notifications.filter((n) => n.type === 'SYSTEM').length,
    };

    return counts;
  }, [notifications]);

  const filterOptions = useMemo(
    () => [
      { key: 'all', label: 'All', count: typeCounts.all },
      { key: 'unread', label: 'Unread', count: typeCounts.unread },
      { key: 'outpass', label: 'Outpass', count: typeCounts.outpass },
      { key: 'library', label: 'Library', count: typeCounts.library },
      { key: 'emergency', label: 'Emergency', count: typeCounts.emergency },
    ],
    [typeCounts]
  );

  useFocusEffect(
    useCallback(() => {
      loadNotifications();
    }, [])
  );

  useEffect(() => {
    filterNotifications();
  }, [notifications, activeFilter]);

  const loadNotifications = async () => {
    try {
      const response = await api.get('/notifications');
      const notificationList = Array.isArray(response.data?.data)
        ? response.data.data
        : Array.isArray(response.data)
        ? response.data
        : [];

      setNotifications(notificationList);

      // Get unread count
      const countResponse = await api.get('/notifications/unread-count');
      setUnreadCount(countResponse.data?.unreadCount || 0);
    } catch (error) {
      console.error('Notification load error:', error);
      Alert.alert('Error', 'Failed to load notifications');
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadNotifications();
    setRefreshing(false);
  };

  const filterNotifications = () => {
    let filtered = notifications;

    if (activeFilter === 'unread') {
      filtered = notifications.filter((n) => !n.isRead);
    } else if (activeFilter !== 'all') {
      filtered = notifications.filter(
        (n) => n.type === activeFilter.toUpperCase()
      );
    }

    setFilteredNotifications(filtered);
  };

  const handleMarkAsRead = (notificationId) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === notificationId ? { ...n, isRead: true } : n))
    );
    setUnreadCount((prev) => Math.max(0, prev - 1));
  };

  const handleMarkAllAsRead = async () => {
    try {
      // Mark all unread notifications as read
      const unreadNotifications = notifications.filter((n) => !n.isRead);

      if (unreadNotifications.length === 0) {
        Alert.alert('Info', 'All notifications are already read');
        return;
      }

      await Promise.all(
        unreadNotifications.map((n) => api.patch(`/notifications/${n.id}/read`))
      );

      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
      Alert.alert('Success', 'All notifications marked as read');
    } catch (error) {
      Alert.alert('Error', 'Failed to mark all as read');
    }
  };

  const renderNotificationCard = ({ item }) => (
    <NotificationCard notification={item} onMarkAsRead={handleMarkAsRead} />
  );

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Ionicons name="notifications-off-outline" size={64} color="#D1D5DB" />
      <Text style={[styles.emptyTitle, { color: colors.text }]}>
        {activeFilter === 'unread'
          ? 'No Unread Notifications'
          : 'No Notifications Yet'}
      </Text>
      <Text style={[styles.emptyText, { color: colors.textMuted }]}>
        {activeFilter === 'unread'
          ? "You're all caught up! Check back later."
          : "You don't have any notifications yet"}
      </Text>
    </View>
  );

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <LoadingSpinner />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View
        style={[
          styles.header,
          { backgroundColor: colors.card, borderBottomColor: colors.border },
        ]}
      >
        <View style={styles.headerTitle}>
          <Text style={[styles.title, { color: colors.text }]}>
            Notifications
          </Text>
          {unreadCount > 0 && (
            <View style={[styles.badge, { backgroundColor: colors.danger }]}>
              <Text style={styles.badgeText}>{unreadCount}</Text>
            </View>
          )}
        </View>
        {unreadCount > 0 && (
          <TouchableOpacity
            style={[
              styles.markAllButton,
              { backgroundColor: `${colors.primary}20` },
            ]}
            onPress={handleMarkAllAsRead}
          >
            <Ionicons
              name="checkmark-done-outline"
              size={18}
              color={colors.primary}
            />
          </TouchableOpacity>
        )}
      </View>

      {/* Filter Tabs */}
      {filteredNotifications.length > 0 && filterOptions.length > 0 && (
        <FilterTabs
          options={filterOptions}
          activeOption={activeFilter}
          onOptionSelect={setActiveFilter}
        />
      )}

      {/* Notifications List */}
      <FlatList
        data={filteredNotifications}
        renderItem={renderNotificationCard}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContainer}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
        ListEmptyComponent={renderEmptyState}
        scrollEventThrottle={16}
      />
    </View>
  );
}
