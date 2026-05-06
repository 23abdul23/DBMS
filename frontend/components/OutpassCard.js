'use client';

import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { outpass as outpassAPI } from '../services/api';
import {
  FONTS,
  OUTPASS_REQUEST_TYPE,
  SIZES,
  SPACING,
  OUTPASS_STATUS,
} from '../utils/constants';
import { useTheme } from '../context/ThemeContext';

export default function OutpassCard({ outpass, onUpdate }) {
  const { colors } = useTheme();

  const getStatusMeta = (status) => {
    switch (status) {
      case OUTPASS_STATUS.PENDING:
        return {
          color: colors.warning,
          soft: colors.warningSoft,
          icon: 'time-outline',
          label: 'Pending Review',
        };
      case OUTPASS_STATUS.APPROVED:
        return {
          color: colors.success,
          soft: colors.successSoft,
          icon: 'checkmark-circle-outline',
          label: 'Approved',
        };
      case OUTPASS_STATUS.REJECTED:
        return {
          color: colors.danger,
          soft: colors.dangerSoft,
          icon: 'close-circle-outline',
          label: 'Rejected',
        };
      case OUTPASS_STATUS.EXPIRED:
        return {
          color: colors.textMuted,
          soft: colors.cardMuted,
          icon: 'time-outline',
          label: 'Expired',
        };
      case OUTPASS_STATUS.CANCELLED:
        return {
          color: '#f97316',
          soft: '#ffedd5',
          icon: 'ban-outline',
          label: 'Cancelled',
        };
      case OUTPASS_STATUS.ACTIVE:
        return {
          color: colors.primary,
          soft: colors.primarySoft,
          icon: 'sparkles-outline',
          label: 'Ready To Use',
        };
      case OUTPASS_STATUS.COMPLETED:
        return {
          color: colors.accent,
          soft: colors.accentSoft,
          icon: 'checkmark-done-outline',
          label: 'Completed',
        };
      default:
        return {
          color: colors.textMuted,
          soft: colors.cardMuted,
          icon: 'help-circle-outline',
          label: 'Unknown',
        };
    }
  };

  const formatDate = (dateString) =>
    new Date(dateString).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });

  const formatTime = (dateString) =>
    new Date(dateString).toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
    });

  const handleCancel = () => {
    Alert.alert(
      'Cancel Outpass',
      'Are you sure you want to cancel this outpass request?',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes, Cancel',
          style: 'destructive',
          onPress: async () => {
            try {
              const response = await outpassAPI.updateOutpass(
                outpass._id || outpass.id,
                { status: 'cancelled' }
              );
              onUpdate(response.data?.outpass || response.data);
              Alert.alert('Success', 'Outpass cancelled successfully');
            } catch (error) {
              Alert.alert(
                'Error',
                error?.response?.data?.message || 'Failed to cancel outpass'
              );
            }
          },
        },
      ]
    );
  };

  const canCancel =
    typeof outpass.canCancel === 'boolean'
      ? outpass.canCancel
      : outpass.status === OUTPASS_STATUS.PENDING ||
        (outpass.status === OUTPASS_STATUS.APPROVED &&
          outpass.monitoringState !== 'ongoing');

  const isLongVisit =
    (outpass.requestType || outpass.type) === OUTPASS_REQUEST_TYPE.LONG_VISIT;
  const statusMeta = getStatusMeta(outpass.status);

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.cardElevated,
          borderColor: colors.border,
          shadowColor: colors.shadow,
        },
      ]}
    >
      <View style={[styles.glow, { backgroundColor: statusMeta.soft }]} />

      <View style={styles.cardHeader}>
        <View
          style={[styles.statusContainer, { backgroundColor: statusMeta.soft }]}
        >
          <Ionicons name={statusMeta.icon} size={18} color={statusMeta.color} />
          <Text style={[styles.statusText, { color: statusMeta.color }]}>
            {statusMeta.label}
          </Text>
        </View>
        {canCancel ? (
          <TouchableOpacity
            style={[
              styles.cancelButton,
              { backgroundColor: colors.dangerSoft },
            ]}
            onPress={handleCancel}
          >
            <Ionicons name="close" size={16} color={colors.danger} />
          </TouchableOpacity>
        ) : null}
      </View>

      <View style={styles.cardContent}>
        <Text style={[styles.purpose, { color: colors.heading }]}>
          {outpass.purpose || outpass.reason}
        </Text>
        <Text style={[styles.destination, { color: colors.subText }]}>
          {outpass.destination || 'Destination pending'}
        </Text>

        <View
          style={[
            styles.schedule,
            { backgroundColor: colors.cardMuted, borderColor: colors.border },
          ]}
        >
          <View style={styles.scheduleItem}>
            <Text style={[styles.scheduleLabel, { color: colors.textMuted }]}>
              Departure
            </Text>
            <Text style={[styles.scheduleValue, { color: colors.text }]}>
              {formatDate(outpass.fromDate || outpass.outDate)} at{' '}
              {formatTime(outpass.fromTime || outpass.outDate)}
            </Text>
          </View>
          <View
            style={[
              styles.scheduleDivider,
              { backgroundColor: colors.divider },
            ]}
          />
          <View style={styles.scheduleItem}>
            <Text style={[styles.scheduleLabel, { color: colors.textMuted }]}>
              Return
            </Text>
            <Text style={[styles.scheduleValue, { color: colors.text }]}>
              {formatDate(outpass.toDate || outpass.expectedReturnDate)} at{' '}
              {formatTime(outpass.toTime || outpass.expectedReturnDate)}
            </Text>
          </View>
        </View>

        {isLongVisit ? (
          <View
            style={[
              styles.requestTypeChip,
              { backgroundColor: colors.warningSoft },
            ]}
          >
            <Text style={[styles.requestTypeText, { color: colors.warning }]}>
              Long Visit: multi-day outpass with warden approval
            </Text>
          </View>
        ) : null}

        {outpass.emergencyContact ? (
          <View style={styles.contactContainer}>
            <Ionicons name="call-outline" size={16} color={colors.subText} />
            <Text style={[styles.contactText, { color: colors.text }]}>
              Emergency:{' '}
              {typeof outpass.emergencyContact === 'object'
                ? `${outpass.emergencyContact.name} (${outpass.emergencyContact.phone})`
                : outpass.emergencyContact}
            </Text>
          </View>
        ) : null}

        {outpass.remarks ? (
          <View
            style={[
              styles.remarksContainer,
              { backgroundColor: colors.cardMuted },
            ]}
          >
            <Text style={[styles.remarksLabel, { color: colors.heading }]}>
              Remarks
            </Text>
            <Text style={[styles.remarksText, { color: colors.subText }]}>
              {outpass.remarks}
            </Text>
          </View>
        ) : null}

        {outpass.latestStatusRemark &&
        outpass.latestStatusRemark !== outpass.remarks ? (
          <View
            style={[
              styles.remarksContainer,
              { backgroundColor: colors.primarySoft },
            ]}
          >
            <Text style={[styles.remarksLabel, { color: colors.primary }]}>
              Latest Update
            </Text>
            <Text style={[styles.remarksText, { color: colors.text }]}>
              {outpass.latestStatusRemark}
            </Text>
          </View>
        ) : null}
      </View>

      <View style={[styles.cardFooter, { borderTopColor: colors.divider }]}>
        <Text style={[styles.createdAt, { color: colors.textMuted }]}>
          Requested on {formatDate(outpass.createdAt)}
        </Text>
        {outpass.approvedBy ? (
          <Text style={[styles.approvedBy, { color: colors.success }]}>
            Approved by {outpass.approvedBy.name}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 24,
    padding: 20,
    marginBottom: SPACING.md,
    borderWidth: 1,
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 1,
    shadowRadius: 18,
    elevation: 10,
  },
  glow: {
    position: 'absolute',
    top: -48,
    right: -34,
    width: 128,
    height: 128,
    borderRadius: 64,
    opacity: 0.9,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  statusText: {
    fontSize: SIZES.sm,
    fontFamily: FONTS.bold,
    marginLeft: 6,
  },
  cancelButton: {
    padding: 8,
    borderRadius: 12,
  },
  cardContent: {
    marginBottom: SPACING.md,
  },
  purpose: {
    fontSize: SIZES.lg,
    fontFamily: FONTS.bold,
    marginBottom: SPACING.xs,
  },
  destination: {
    fontSize: SIZES.md,
    fontFamily: FONTS.regular,
    marginBottom: SPACING.md,
  },
  schedule: {
    borderRadius: 18,
    borderWidth: 1,
    marginBottom: SPACING.md,
    overflow: 'hidden',
  },
  scheduleItem: {
    padding: 14,
  },
  scheduleDivider: {
    height: 1,
  },
  scheduleLabel: {
    fontSize: SIZES.xs,
    fontFamily: FONTS.regular,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 6,
  },
  scheduleValue: {
    fontSize: SIZES.sm,
    fontFamily: FONTS.bold,
    lineHeight: 20,
  },
  requestTypeChip: {
    borderRadius: 12,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.sm,
    marginBottom: SPACING.md,
  },
  requestTypeText: {
    fontSize: SIZES.sm,
    fontFamily: FONTS.bold,
  },
  contactContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  contactText: {
    fontSize: SIZES.sm,
    fontFamily: FONTS.regular,
    marginLeft: SPACING.xs,
    flex: 1,
  },
  remarksContainer: {
    padding: SPACING.sm,
    borderRadius: 14,
    marginTop: 8,
  },
  remarksLabel: {
    fontSize: SIZES.sm,
    fontFamily: FONTS.bold,
    marginBottom: SPACING.xs,
  },
  remarksText: {
    fontSize: SIZES.sm,
    fontFamily: FONTS.regular,
    lineHeight: 20,
  },
  cardFooter: {
    borderTopWidth: 1,
    paddingTop: SPACING.sm,
  },
  createdAt: {
    fontSize: SIZES.xs,
    fontFamily: FONTS.regular,
  },
  approvedBy: {
    fontSize: SIZES.xs,
    fontFamily: FONTS.regular,
    marginTop: SPACING.xs,
  },
});
