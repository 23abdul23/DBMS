import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import ImpersonationBanner from '../components/ImpersonationBanner';
import { useTheme } from '../context/ThemeContext';
import { notificationAPI } from '../services/api';

function formatStatusCounts(items = []) {
  return items.reduce((accumulator, item) => {
    accumulator[item.status] = item?._count?._all || 0;
    return accumulator;
  }, {});
}

export default function NotificationTestingScreen() {
  const { colors } = useTheme();
  const [studentId, setStudentId] = useState('');
  const [sending, setSending] = useState(false);
  const [loadingDiagnostics, setLoadingDiagnostics] = useState(false);
  const [result, setResult] = useState(null);
  const [overview, setOverview] = useState(null);
  const [tokens, setTokens] = useState([]);
  const [deliveries, setDeliveries] = useState([]);

  const refreshDiagnostics = async () => {
    try {
      setLoadingDiagnostics(true);

      const [overviewResponse, tokensResponse, deliveriesResponse] =
        await Promise.all([
          notificationAPI.adminOverview(),
          notificationAPI.adminTokens({ limit: 12 }),
          notificationAPI.adminDeliveries({ limit: 12 }),
        ]);

      setOverview(overviewResponse.data || null);
      setTokens(tokensResponse.data?.data || []);
      setDeliveries(deliveriesResponse.data?.data || []);
    } catch (error) {
      console.log(
        '[Notifications] Failed to load diagnostics:',
        error?.message || error
      );
    } finally {
      setLoadingDiagnostics(false);
    }
  };

  useEffect(() => {
    refreshDiagnostics();
  }, []);

  const handleSendTestNotification = async () => {
    if (!studentId.trim()) {
      Alert.alert('Error', 'Please enter a student ID or email');
      return;
    }

    try {
      setSending(true);
      const response = await notificationAPI.testHelloNotification(studentId);

      if (response?.data?.success) {
        setResult(response.data);
        setStudentId('');
        await refreshDiagnostics();
        Alert.alert(
          'Queued',
          `Native push notification queued for ${
            response.data.studentName || studentId
          }`
        );
      } else {
        const errorMessage =
          response?.data?.error || 'Failed to queue notification';
        setResult({
          success: false,
          error: errorMessage,
        });
        Alert.alert('Error', errorMessage);
      }
    } catch (error) {
      const errorMessage =
        error?.response?.data?.error || error?.message || 'Unknown error';
      setResult({
        success: false,
        error: errorMessage,
      });
      Alert.alert('Error', errorMessage);
    } finally {
      setSending(false);
    }
  };

  const tokenCounts = formatStatusCounts(overview?.tokenCounts);
  const deliveryCounts = formatStatusCounts(overview?.recentDeliveries);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ImpersonationBanner />
      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              Native Push Diagnostics
            </Text>
            <Text
              style={[styles.sectionDescription, { color: colors.textMuted }]}
            >
              Android uses FCM tokens. iOS uses APNs tokens. Expo relay is not
              in this path.
            </Text>
          </View>

          <TouchableOpacity
            style={[
              styles.refreshButton,
              { borderColor: colors.border, backgroundColor: colors.card },
            ]}
            onPress={refreshDiagnostics}
            disabled={loadingDiagnostics}
          >
            {loadingDiagnostics ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Ionicons name="refresh" size={18} color={colors.primary} />
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={[styles.label, { color: colors.text }]}>
            Send Direct Push Test
          </Text>

          <View style={[styles.inputContainer, { borderColor: colors.border }]}>
            <Ionicons
              name="person"
              size={20}
              color={colors.textMuted}
              style={styles.inputIcon}
            />
            <TextInput
              style={[styles.input, { color: colors.text }]}
              placeholder="Student ID or Email"
              placeholderTextColor={colors.textMuted}
              value={studentId}
              onChangeText={setStudentId}
              editable={!sending}
            />
          </View>

          <TouchableOpacity
            style={[
              styles.sendButton,
              { backgroundColor: colors.primary },
              sending && { opacity: 0.7 },
            ]}
            onPress={handleSendTestNotification}
            disabled={sending}
          >
            {sending ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Ionicons name="send" size={18} color="#fff" />
            )}
            <Text style={styles.sendButtonText}>
              {sending ? 'Queueing...' : 'Queue Test Notification'}
            </Text>
          </TouchableOpacity>
        </View>

        {result && (
          <View
            style={[
              styles.card,
              {
                backgroundColor: result.success
                  ? colors.success + '14'
                  : colors.danger + '14',
                borderColor: result.success ? colors.success : colors.danger,
              },
            ]}
          >
            <Text
              style={[
                styles.cardTitle,
                { color: result.success ? colors.success : colors.danger },
              ]}
            >
              {result.success ? 'Queued Successfully' : 'Queue Failed'}
            </Text>

            {result.success ? (
              <>
                <InfoRow
                  label="Student"
                  value={`${result.studentName} (${result.studentEmail})`}
                  colors={colors}
                />
                <InfoRow
                  label="Active Devices"
                  value={String(result.tokenCount || 0)}
                  colors={colors}
                />
                {(result.tokenInfo || []).map((token) => (
                  <InfoRow
                    key={token.id}
                    label={`${token.platform}/${token.tokenType}`}
                    value={`${token.deviceName} • ${token.deviceId}`}
                    colors={colors}
                  />
                ))}
              </>
            ) : (
              <Text style={[styles.errorText, { color: colors.danger }]}>
                {result.error}
              </Text>
            )}
          </View>
        )}

        <View style={styles.section}>
          <Text style={[styles.label, { color: colors.text }]}>
            Token Status
          </Text>
          <View style={styles.statsRow}>
            <StatCard
              label="Active"
              value={tokenCounts.ACTIVE || 0}
              colors={colors}
            />
            <StatCard
              label="Invalid"
              value={tokenCounts.INVALID || 0}
              colors={colors}
            />
            <StatCard
              label="Logged Out"
              value={tokenCounts.LOGGED_OUT || 0}
              colors={colors}
            />
            <StatCard
              label="Stale"
              value={tokenCounts.STALE || 0}
              colors={colors}
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={[styles.label, { color: colors.text }]}>
            Delivery Status (7 days)
          </Text>
          <View style={styles.statsRow}>
            <StatCard
              label="Delivered"
              value={deliveryCounts.DELIVERED || 0}
              colors={colors}
            />
            <StatCard
              label="Retrying"
              value={deliveryCounts.RETRYING || 0}
              colors={colors}
            />
            <StatCard
              label="Failed"
              value={deliveryCounts.FAILED || 0}
              colors={colors}
            />
            <StatCard
              label="Invalid"
              value={deliveryCounts.INVALID_TOKEN || 0}
              colors={colors}
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={[styles.label, { color: colors.text }]}>
            Recent Device Registrations
          </Text>
          <FlatList
            data={tokens}
            scrollEnabled={false}
            keyExtractor={(item) => item.id}
            ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
            renderItem={({ item }) => (
              <View
                style={[
                  styles.listCard,
                  {
                    backgroundColor: colors.card,
                    borderColor: colors.border,
                  },
                ]}
              >
                <Text style={[styles.listTitle, { color: colors.text }]}>
                  {item.user?.name || item.user?.email || item.userId}
                </Text>
                <Text style={[styles.listMeta, { color: colors.textMuted }]}>
                  {item.platform.toUpperCase()} • {item.tokenType} •{' '}
                  {item.status}
                </Text>
                <Text style={[styles.listMeta, { color: colors.textMuted }]}>
                  {item.deviceName || 'Unknown device'} • {item.deviceId}
                </Text>
              </View>
            )}
          />
        </View>

        <View style={styles.section}>
          <Text style={[styles.label, { color: colors.text }]}>
            Recent Delivery Failures
          </Text>
          <FlatList
            data={(overview?.recentFailures || []).slice(0, 8)}
            scrollEnabled={false}
            keyExtractor={(item) => item.id}
            ListEmptyComponent={
              <Text style={[styles.emptyText, { color: colors.textMuted }]}>
                No recent failed deliveries
              </Text>
            }
            ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
            renderItem={({ item }) => (
              <View
                style={[
                  styles.listCard,
                  {
                    backgroundColor: colors.card,
                    borderColor: colors.border,
                  },
                ]}
              >
                <Text style={[styles.listTitle, { color: colors.text }]}>
                  {item.notification?.title || 'Notification'}
                </Text>
                <Text style={[styles.listMeta, { color: colors.textMuted }]}>
                  {item.pushToken?.user?.name || item.pushToken?.user?.email}
                </Text>
                <Text style={[styles.listMeta, { color: colors.danger }]}>
                  {item.status} • {item.failureCode || item.failureReason}
                </Text>
              </View>
            )}
          />
        </View>

        <View style={styles.section}>
          <Text style={[styles.label, { color: colors.text }]}>
            Recent Delivery Log
          </Text>
          <FlatList
            data={deliveries}
            scrollEnabled={false}
            keyExtractor={(item) => item.id}
            ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
            renderItem={({ item }) => (
              <View
                style={[
                  styles.listCard,
                  {
                    backgroundColor: colors.card,
                    borderColor: colors.border,
                  },
                ]}
              >
                <Text style={[styles.listTitle, { color: colors.text }]}>
                  {item.notification?.title || 'Notification'}
                </Text>
                <Text style={[styles.listMeta, { color: colors.textMuted }]}>
                  {item.pushToken?.platform?.toUpperCase()} •{' '}
                  {item.pushToken?.tokenType} • attempt {item.attemptCount}
                </Text>
                <Text
                  style={[
                    styles.listMeta,
                    {
                      color:
                        item.status === 'DELIVERED'
                          ? colors.success
                          : item.status === 'RETRYING'
                          ? colors.warning
                          : item.status === 'FAILED' ||
                            item.status === 'INVALID_TOKEN'
                          ? colors.danger
                          : colors.textMuted,
                    },
                  ]}
                >
                  {item.status}
                  {item.failureCode ? ` • ${item.failureCode}` : ''}
                </Text>
              </View>
            )}
          />
        </View>
      </ScrollView>
    </View>
  );
}

function InfoRow({ label, value, colors }) {
  return (
    <View style={styles.infoRow}>
      <Text style={[styles.infoLabel, { color: colors.textMuted }]}>
        {label}
      </Text>
      <Text style={[styles.infoValue, { color: colors.text }]}>{value}</Text>
    </View>
  );
}

function StatCard({ label, value, colors }) {
  return (
    <View
      style={[
        styles.statCard,
        { backgroundColor: colors.card, borderColor: colors.border },
      ]}
    >
      <Text style={[styles.statValue, { color: colors.text }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: colors.textMuted }]}>
        {label}
      </Text>
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
  content: {
    paddingBottom: 32,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingHorizontal: 12,
    paddingTop: 16,
  },
  refreshButton: {
    width: 42,
    height: 42,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  section: {
    paddingHorizontal: 12,
    paddingTop: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  sectionDescription: {
    fontSize: 13,
    marginTop: 4,
  },
  label: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    marginBottom: 12,
    backgroundColor: '#fff',
  },
  inputIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 15,
  },
  sendButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    paddingVertical: 12,
    gap: 8,
  },
  sendButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  card: {
    marginHorizontal: 12,
    marginTop: 16,
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
  },
  infoRow: {
    gap: 4,
    marginBottom: 8,
  },
  infoLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  infoValue: {
    fontSize: 13,
    fontWeight: '500',
  },
  errorText: {
    fontSize: 14,
    fontWeight: '600',
  },
  statsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  statCard: {
    minWidth: '47%',
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
  },
  statLabel: {
    fontSize: 12,
    marginTop: 4,
  },
  listCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
  },
  listTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  listMeta: {
    fontSize: 12,
    marginTop: 4,
  },
  emptyText: {
    fontSize: 13,
  },
});
