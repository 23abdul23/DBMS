import React, { useEffect, useState } from 'react';
import {
  View,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  FlatList,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { notificationAPI } from '../services/api';
import ImpersonationBanner from '../components/ImpersonationBanner';

export default function NotificationTestingScreen() {
  const { colors } = useTheme();
  const [studentId, setStudentId] = useState('');
  const [loading, setLoading] = useState(false);
  const [testLogs, setTestLogs] = useState([]);
  const [result, setResult] = useState(null);
  const [expandedLog, setExpandedLog] = useState(null);

  const handleSendTestNotification = async () => {
    if (!studentId.trim()) {
      Alert.alert('Error', 'Please enter a student ID or email');
      return;
    }

    try {
      setLoading(true);
      const response = await notificationAPI.testHelloNotification(studentId);

      if (response?.data?.success) {
        setResult(response.data);
        setTestLogs((prev) => [
          {
            id: Date.now().toString(),
            timestamp: new Date().toLocaleTimeString(),
            studentId,
            ...response.data,
          },
          ...prev,
        ]);
        setStudentId('');
        Alert.alert(
          'Success',
          `Test notification sent to ${response.data.studentName || studentId}`
        );
      } else {
        setResult({
          success: false,
          error: response?.data?.error || 'Unknown error',
        });
        Alert.alert(
          'Error',
          response?.data?.error || 'Failed to send notification'
        );
      }
    } catch (error) {
      const errorMsg =
        error?.response?.data?.error || error?.message || 'Unknown error';
      setResult({
        success: false,
        error: errorMsg,
      });
      Alert.alert('Error', errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const renderResultStatus = () => {
    if (!result) return null;

    if (result.success) {
      return (
        <View style={[styles.resultCard, styles.successCard]}>
          <View style={styles.resultHeader}>
            <Ionicons name="checkmark-circle" size={24} color="#22c55e" />
            <Text style={[styles.resultTitle, { color: '#16a34a' }]}>
              Notification Queued
            </Text>
          </View>

          <View style={styles.resultContent}>
            <ResultRow label="Student" value={result.studentName} />
            <ResultRow label="Email" value={result.studentEmail} />
            {result.tokenFound && (
              <>
                <ResultRow
                  label="Device"
                  value={result.tokenInfo?.deviceName}
                />
                <ResultRow
                  label="Platform"
                  value={result.tokenInfo?.platform}
                />
              </>
            )}
            {!result.tokenFound && (
              <ResultRow
                label="Status"
                value="⚠️ No active push token"
                valueColor="#ea580c"
              />
            )}
          </View>
        </View>
      );
    }

    return (
      <View style={[styles.resultCard, styles.errorCard]}>
        <View style={styles.resultHeader}>
          <Ionicons name="close-circle" size={24} color="#ef4444" />
          <Text style={[styles.resultTitle, { color: '#dc2626' }]}>Error</Text>
        </View>
        <Text style={[styles.errorMessage, { color: '#991b1b' }]}>
          {result.error}
        </Text>
      </View>
    );
  };

  const renderLogItem = ({ item }) => (
    <TouchableOpacity
      style={[
        styles.logItem,
        { borderColor: colors.border, borderWidth: 1 },
        item.success
          ? { backgroundColor: colors.success + '15' }
          : { backgroundColor: colors.danger + '15' },
      ]}
      onPress={() => setExpandedLog(expandedLog === item.id ? null : item.id)}
    >
      <View style={styles.logHeader}>
        <View style={styles.logTitleRow}>
          <Ionicons
            name={item.success ? 'checkmark-circle' : 'close-circle'}
            size={20}
            color={item.success ? colors.success : colors.danger}
          />
          <Text style={[styles.logTime, { color: colors.text }]}>
            {item.timestamp}
          </Text>
        </View>
        <Ionicons
          name={expandedLog === item.id ? 'chevron-up' : 'chevron-down'}
          size={20}
          color={colors.textMuted}
        />
      </View>

      {expandedLog === item.id && (
        <View style={[styles.logDetails, { borderTopColor: colors.border }]}>
          <DetailRow label="Student ID" value={item.studentId} />
          {item.studentName && (
            <DetailRow label="Name" value={item.studentName} />
          )}
          {item.studentEmail && (
            <DetailRow label="Email" value={item.studentEmail} />
          )}
          {item.success && item.tokenFound && (
            <>
              <DetailRow label="Device" value={item.tokenInfo?.deviceName} />
              <DetailRow label="Platform" value={item.tokenInfo?.platform} />
            </>
          )}
          {item.error && (
            <DetailRow
              label="Error"
              value={item.error}
              valueColor={colors.danger}
            />
          )}
        </View>
      )}
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ImpersonationBanner />
      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            Test HELLO Notification
          </Text>
          <Text
            style={[styles.sectionDescription, { color: colors.textMuted }]}
          >
            Send a test notification to verify push delivery
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
              editable={!loading}
            />
          </View>

          <TouchableOpacity
            style={[
              styles.sendButton,
              { backgroundColor: colors.primary },
              loading && { opacity: 0.6 },
            ]}
            onPress={handleSendTestNotification}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Ionicons name="send" size={18} color="#fff" />
            )}
            <Text style={styles.sendButtonText}>
              {loading ? 'Sending...' : 'Send Test Notification'}
            </Text>
          </TouchableOpacity>
        </View>

        {renderResultStatus()}

        {testLogs.length > 0 && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              Recent Tests ({testLogs.length})
            </Text>

            <FlatList
              data={testLogs}
              renderItem={renderLogItem}
              keyExtractor={(item) => item.id}
              scrollEnabled={false}
              nestedScrollEnabled={false}
            />
          </View>
        )}

        <View style={styles.footer} />
      </ScrollView>
    </View>
  );
}

function ResultRow({ label, value, valueColor }) {
  const { colors } = useTheme();
  return (
    <View style={styles.resultRow}>
      <Text style={[styles.resultLabel, { color: colors.textMuted }]}>
        {label}:
      </Text>
      <Text style={[styles.resultValue, { color: valueColor || colors.text }]}>
        {value || 'N/A'}
      </Text>
    </View>
  );
}

function DetailRow({ label, value, valueColor }) {
  const { colors } = useTheme();
  return (
    <View style={styles.detailRow}>
      <Text style={[styles.detailLabel, { color: colors.textMuted }]}>
        {label}:
      </Text>
      <Text
        style={[styles.detailValue, { color: valueColor || colors.text }]}
        numberOfLines={3}
      >
        {value}
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
  section: {
    paddingHorizontal: 12,
    paddingVertical: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
  },
  sectionDescription: {
    fontSize: 13,
    marginBottom: 16,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 8,
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
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
  },
  sendButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  // Result Card
  resultCard: {
    marginHorizontal: 12,
    marginVertical: 12,
    borderRadius: 12,
    padding: 16,
    borderLeftWidth: 4,
  },
  successCard: {
    borderLeftColor: '#22c55e',
    backgroundColor: '#f0fdf4',
  },
  errorCard: {
    borderLeftColor: '#ef4444',
    backgroundColor: '#fef2f2',
  },
  resultHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  resultTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  resultContent: {
    gap: 8,
  },
  resultRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  resultLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  resultValue: {
    fontSize: 13,
    fontWeight: '500',
  },
  errorMessage: {
    fontSize: 13,
    fontWeight: '500',
  },
  // Log Item
  logItem: {
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  logHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  logTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  logTime: {
    fontSize: 13,
    fontWeight: '600',
  },
  logDetails: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    gap: 8,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: 4,
  },
  detailLabel: {
    fontSize: 12,
    fontWeight: '600',
    flex: 0.35,
  },
  detailValue: {
    fontSize: 12,
    flex: 0.65,
    textAlign: 'right',
  },
  footer: {
    height: 40,
  },
});
