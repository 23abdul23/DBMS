import React, { useEffect, useState } from 'react';
import {
  View,
  ScrollView,
  Text,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useFocusEffect } from '@react-navigation/native';
import { adminAPI } from '../services/api';
import RoleCard from '../components/RoleCard';
import ImpersonationBanner from '../components/ImpersonationBanner';

const ROLE_CONFIG = [
  {
    dbRole: 'warden',
    label: 'Wardens',
    icon: 'key',
  },
  {
    dbRole: 'security',
    label: 'Security Guards',
    icon: 'shield',
  },
  {
    dbRole: 'admin',
    label: 'Admin Users',
    icon: 'settings',
    subTypes: [
      { label: 'SAC Admins', type: 'sac' },
      { label: 'Library Admins', type: 'library' },
      { label: 'Security Admins', type: 'security_admin' },
    ],
  },
];

export default function SuperAdminDashboardScreen({ navigation }) {
  const { colors } = useTheme();
  const { startImpersonation, isImpersonating } = useAuth();
  const [loading, setLoading] = useState(false);
  const [roleUsers, setRoleUsers] = useState({});
  const [refreshing, setRefreshing] = useState(false);

  useFocusEffect(
    React.useCallback(() => {
      loadAllUsers();
    }, [])
  );

  const loadAllUsers = async () => {
    try {
      setLoading(true);
      const newRoleUsers = {};

      // Fetch wardens
      try {
        const wardensRes = await adminAPI.getAllUsersByRole('warden');
        newRoleUsers.warden = wardensRes?.data?.users || [];
      } catch (err) {
        console.warn('Failed to fetch wardens:', err);
        newRoleUsers.warden = [];
      }

      // Fetch security
      try {
        const securityRes = await adminAPI.getAllUsersByRole('security');
        newRoleUsers.security = securityRes?.data?.users || [];
      } catch (err) {
        console.warn('Failed to fetch security:', err);
        newRoleUsers.security = [];
      }

      // Fetch admins
      try {
        const adminsRes = await adminAPI.getAllUsersByRole('admin');
        newRoleUsers.admin = adminsRes?.data?.users || [];
      } catch (err) {
        console.warn('Failed to fetch admins:', err);
        newRoleUsers.admin = [];
      }

      setRoleUsers(newRoleUsers);
    } catch (error) {
      console.error('Error loading users:', error);
      Alert.alert('Error', 'Failed to load user list');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleImpersonate = (role, userId, userName) => {
    startImpersonation(role, userId);
    Alert.alert(
      'Impersonation Started',
      `You are now viewing as ${userName} (${role}). Use the banner to stop impersonation.`,
      [{ text: 'OK' }]
    );

    // Navigate based on role
    const roleNavigationMap = {
      warden: 'WardenMain',
      security: 'GuardMain',
      admin: 'SecurityAdminMain',
    };

    const screenName = roleNavigationMap[role];
    if (screenName) {
      navigation.navigate(screenName);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadAllUsers();
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.text }]}>
            Loading users...
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ImpersonationBanner />

      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerSection}>
          <Text style={[styles.title, { color: colors.text }]}>
            SUPER_ADMIN Dashboard
          </Text>

          <Text style={[styles.subtitle, { color: colors.textMuted }]}>
            Select a user to impersonate their workflows
          </Text>
        </View>

        {ROLE_CONFIG.map((roleConfig) => (
          <RoleCard
            key={roleConfig.dbRole}
            role={roleConfig.dbRole}
            roleLabel={roleConfig.label}
            users={roleUsers[roleConfig.dbRole] || []}
            loading={false}
            onImpersonate={handleImpersonate}
          />
        ))}

        <View style={styles.footer} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    marginTop: 12,
    fontWeight: '500',
  },
  headerSection: {
    paddingHorizontal: 12,
    paddingVertical: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
  },
  footer: {
    height: 40,
  },
});
