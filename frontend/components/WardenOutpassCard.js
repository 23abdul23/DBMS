'use client';

import { Alert, Text, TouchableOpacity, View, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import styles from '../styles/WardenStyles';
import { COLORS, OUTPASS_REQUEST_TYPE } from '../utils/constants';
import { AuthProvider, useAuth } from '../context/AuthContext';

const statusColors = {
  pending: '#f59e0b',
  approved: '#10b981',
  rejected: '#ef4444',
  expired: '#6b7280',
  cancelled: '#f97316',
};

const callStudent = async (phoneNo) => {
  try {
    const phone = `tel:${String(phoneNo).trim()}`;
    await Linking.openURL(phone);
  } catch (err) {
    console.log('Call Error:', err);
  }
};

const formatDateTime = (value) => {
  if (!value) {
    return '-';
  }

  return new Date(value).toLocaleString();
};

const prettify = (value) => {
  return String(value || '')
    .split('_')
    .join(' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
};

export default function WardenOutpassCard({
  outpass,
  colors,
  onAction,
  isBusy,
}) {
  const handleAction = (action, title, message) => {
    Alert.alert(title, message, [
      { text: 'No', style: 'cancel' },
      {
        text: 'Yes',
        onPress: () => onAction?.(outpass, action),
      },
    ]);
  };

  const { user, loading } = useAuth();

  const canCancel =
    typeof outpass.canCancel === 'boolean'
      ? outpass.canCancel
      : outpass.status === 'approved';
  const isLongVisit =
    (outpass.requestType || outpass.type) === OUTPASS_REQUEST_TYPE.LONG_VISIT;

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.card,
          borderColor: colors.border || COLORS.gray[200],
        },
      ]}
    >
      <View style={styles.cardRow}>
        <View style={{ flex: 1, paddingRight: 12 }}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>
            {outpass.user?.name || 'Student'}
          </Text>
          <Text style={[styles.metaText, { color: colors.subText }]}>
            {outpass.user?.studentId || 'No student ID'} | Room{' '}
            {outpass.user?.roomNumber || '-'}
          </Text>
        </View>
        <Ionicons name="person-circle-outline" size={32} color={colors.text} />
      </View>

      <View style={styles.badgeRow}>
        {isLongVisit ? (
          <View style={[styles.badge, { backgroundColor: '#ccfbf1' }]}>
            <Text style={[styles.badgeText, { color: '#115e59' }]}>
              Long Visit
            </Text>
          </View>
        ) : null}
        <View
          style={[
            styles.badge,
            {
              backgroundColor: `${
                statusColors[outpass.status] || COLORS.gray[500]
              }20`,
            },
          ]}
        >
          <Text
            style={[
              styles.badgeText,
              { color: statusColors[outpass.status] || COLORS.gray[500] },
            ]}
          >
            {prettify(outpass.status)}
          </Text>
        </View>
      </View>

      <Text style={[styles.metaText, { color: colors.text }]}>
        Reason: {outpass.reason}
      </Text>
      <Text style={[styles.metaText, { color: colors.text }]}>
        Destination: {outpass.destination}
      </Text>

      {user ? (
        <View style={styles.contactRow}>
          <Text
            style={[
              styles.metaText,
              styles.contactName,
              { color: colors.subText },
            ]}
          >
            Phone Number:
          </Text>
          <TouchableOpacity
            style={styles.callChip}
            onPress={() => callStudent(user.phoneNumber)}
            activeOpacity={0.8}
          >
            <Ionicons name="call-outline" size={14} color="#065f46" />
            <Text style={styles.callChipText}>{String(user.phoneNumber)}</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      <Text style={[styles.metaText, { color: colors.subText }]}>
        Departure: {formatDateTime(outpass.outDate)}
      </Text>
      <Text style={[styles.metaText, { color: colors.subText }]}>
        Return By: {formatDateTime(outpass.expectedReturnDate)}
      </Text>
      {isLongVisit ? (
        <Text style={[styles.metaText, { color: '#b45309' }]}>
          Student must visit the warden physically for approval handling.
        </Text>
      ) : null}

      {outpass.emergencyContact?.phone ? (
        <View style={styles.contactRow}>
          <Text
            style={[
              styles.metaText,
              styles.contactName,
              { color: colors.subText },
            ]}
          >
            Emergency: {outpass.emergencyContact.name || 'Contact'}
          </Text>
          <TouchableOpacity
            style={styles.callChip}
            onPress={() => callStudent(outpass.emergencyContact.phone)}
            activeOpacity={0.8}
          >
            <Ionicons name="call-outline" size={14} color="#065f46" />
            <Text style={styles.callChipText}>
              {String(outpass.emergencyContact.phone)}
            </Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {outpass.latestMovement ? (
        <Text style={[styles.metaText, { color: colors.subText }]}>
          Last Scan: {prettify(outpass.latestMovement.location)} at{' '}
          {formatDateTime(outpass.latestMovement.createdAt)}
        </Text>
      ) : null}

      {outpass.latestStatusRemark ? (
        <Text style={[styles.metaText, { color: colors.text }]}>
          Latest Note: {outpass.latestStatusRemark}
        </Text>
      ) : null}

      {outpass.status === 'pending' ? (
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: '#dcfce7' }]}
            onPress={() =>
              handleAction(
                'approve',
                'Approve Request',
                'Approve this outpass request for the student?'
              )
            }
            disabled={isBusy}
          >
            <Text style={[styles.actionButtonText, { color: '#166534' }]}>
              {isBusy ? 'Updating...' : 'Approve'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.actionButton,
              styles.secondaryActionButton,
              { backgroundColor: '#fee2e2', marginRight: 0 },
            ]}
            onPress={() =>
              handleAction(
                'reject',
                'Reject Request',
                'Reject this outpass request?'
              )
            }
            disabled={isBusy}
          >
            <Text style={[styles.actionButtonText, { color: '#991b1b' }]}>
              {isBusy ? 'Updating...' : 'Reject'}
            </Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {canCancel ? (
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={[
              styles.actionButton,
              { backgroundColor: '#fff7ed', marginRight: 0 },
            ]}
            onPress={() =>
              handleAction(
                'cancel',
                'Cancel Outpass',
                'Cancel this approved outpass before use?'
              )
            }
            disabled={isBusy}
          >
            <Text style={[styles.actionButtonText, { color: '#c2410c' }]}>
              {isBusy ? 'Updating...' : 'Cancel Approval'}
            </Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </View>
  );
}
