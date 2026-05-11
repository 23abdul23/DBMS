import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';

export default function ImpersonationBanner() {
  const { colors } = useTheme();
  const { impersonatedRole, clearImpersonation } = useAuth();

  if (!impersonatedRole) {
    return null;
  }

  const roleLabel = impersonatedRole
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

  return (
    <View
      style={[styles.banner, { backgroundColor: colors.warning || '#FFA500' }]}
    >
      <View style={styles.content}>
        <Ionicons name="eye" size={16} color="#000" style={styles.icon} />
        <Text style={styles.text}>
          Impersonating: <Text style={styles.role}>{roleLabel}</Text>
        </Text>
      </View>
      <TouchableOpacity onPress={clearImpersonation} style={styles.closeButton}>
        <Ionicons name="close" size={18} color="#000" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  icon: {
    marginRight: 8,
  },
  text: {
    fontSize: 13,
    fontWeight: '600',
    color: '#000',
  },
  role: {
    fontWeight: '700',
  },
  closeButton: {
    padding: 4,
  },
});
