import React, { useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';

export default function RoleCard({
  role,
  roleLabel,
  users,
  loading,
  onImpersonate,
}) {
  const { colors } = useTheme();
  const [selectedUser, setSelectedUser] = useState(null);
  const [showModal, setShowModal] = useState(false);

  const handleUserPress = (user) => {
    setSelectedUser(user);
    setShowModal(true);
  };

  const handleConfirmImpersonate = () => {
    if (selectedUser) {
      onImpersonate(role, selectedUser.id, selectedUser.name);
      setShowModal(false);
      setSelectedUser(null);
    }
  };

  const renderUserItem = ({ item }) => (
    <TouchableOpacity
      style={[styles.userItem, { borderColor: colors.border }]}
      onPress={() => handleUserPress(item)}
    >
      <View style={styles.userInfo}>
        <Text style={[styles.userName, { color: colors.text }]}>
          {item.name}
        </Text>
        <Text style={[styles.userEmail, { color: colors.textMuted }]}>
          {item.email}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color={colors.primary} />
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.card }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>
          {roleLabel} ({users.length})
        </Text>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textMuted }]}>
            Loading...
          </Text>
        </View>
      ) : users.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons
            name="people-outline"
            size={40}
            color={colors.textMuted}
            style={styles.emptyIcon}
          />
          <Text style={[styles.emptyText, { color: colors.textMuted }]}>
            No {roleLabel.toLowerCase()} found
          </Text>
        </View>
      ) : (
        <FlatList
          data={users}
          renderItem={renderUserItem}
          keyExtractor={(item) => item.id}
          scrollEnabled={false}
          nestedScrollEnabled={false}
        />
      )}

      {/* Impersonation Confirmation Modal */}
      <Modal
        visible={showModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
            <View style={styles.modalHeader}>
              <Ionicons name="eye" size={32} color={colors.primary} />
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                Impersonate User?
              </Text>
            </View>

            <View style={styles.modalBody}>
              <Text style={[styles.modalLabel, { color: colors.textMuted }]}>
                Role
              </Text>
              <Text style={[styles.modalValue, { color: colors.text }]}>
                {roleLabel}
              </Text>

              <Text
                style={[
                  styles.modalLabel,
                  { color: colors.textMuted, marginTop: 16 },
                ]}
              >
                User
              </Text>
              <Text style={[styles.modalValue, { color: colors.text }]}>
                {selectedUser?.name}
              </Text>
              <Text style={[styles.modalEmail, { color: colors.textMuted }]}>
                {selectedUser?.email}
              </Text>
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.cancelButton, { borderColor: colors.border }]}
                onPress={() => setShowModal(false)}
              >
                <Text style={[styles.buttonText, { color: colors.text }]}>
                  Cancel
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.confirmButton,
                  { backgroundColor: colors.primary },
                ]}
                onPress={handleConfirmImpersonate}
              >
                <Ionicons name="checkmark" size={20} color="#fff" />
                <Text style={styles.confirmButtonText}>Impersonate</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    marginHorizontal: 12,
    marginVertical: 8,
    overflow: 'hidden',
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    marginTop: 8,
    fontSize: 14,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  emptyIcon: {
    marginBottom: 12,
  },
  emptyText: {
    fontSize: 14,
    fontWeight: '500',
  },
  userItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 2,
  },
  userEmail: {
    fontSize: 12,
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    borderRadius: 16,
    width: '85%',
    maxWidth: 400,
    paddingHorizontal: 20,
    paddingVertical: 24,
  },
  modalHeader: {
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginTop: 12,
  },
  modalBody: {
    marginBottom: 20,
  },
  modalLabel: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  modalValue: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 4,
  },
  modalEmail: {
    fontSize: 13,
    marginTop: 2,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1.5,
    alignItems: 'center',
  },
  buttonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  confirmButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  confirmButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
});
