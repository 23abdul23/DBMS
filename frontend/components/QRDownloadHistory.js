import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { FONTS, SPACING } from '../utils/constants';
import {
  getDownloadedFiles,
  deleteDownloadedFile,
} from '../utils/qrDownloadUtils';

/**
 * QRDownloadHistory Component
 * Displays and manages downloaded QR code files
 */
export default function QRDownloadHistory({ onRefresh = () => {} }) {
  const { colors } = useTheme();
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [expandedItems, setExpandedItems] = useState({});

  useEffect(() => {
    loadFiles();
  }, []);

  const loadFiles = async () => {
    try {
      setLoading(true);
      const fileList = await getDownloadedFiles();
      setFiles(fileList);
    } catch (error) {
      console.log('Load files error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteFile = (fileName) => {
    Alert.alert('Delete File', `Delete ${fileName}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        onPress: async () => {
          const result = await deleteDownloadedFile(fileName);
          if (result.success) {
            loadFiles();
            onRefresh();
          } else {
            Alert.alert('Error', 'Could not delete file');
          }
        },
        style: 'destructive',
      },
    ]);
  };

  const toggleExpanded = (fileName) => {
    setExpandedItems((prev) => ({
      ...prev,
      [fileName]: !prev[fileName],
    }));
  };

  const renderFile = ({ item: fileName }) => {
    const isExpanded = expandedItems[fileName];
    const fileSize = 'N/A'; // Would need additional logic to get actual size

    return (
      <TouchableOpacity
        style={[
          styles.fileItem,
          {
            backgroundColor: colors.cardElevated,
            borderColor: colors.border,
          },
        ]}
        onPress={() => toggleExpanded(fileName)}
      >
        <View style={styles.fileItemContent}>
          <View style={styles.fileIcon}>
            <Ionicons
              name={
                fileName.endsWith('.json')
                  ? 'document-text-outline'
                  : 'image-outline'
              }
              size={24}
              color={colors.primary}
            />
          </View>

          <View style={{ flex: 1 }}>
            <Text
              style={[styles.fileName, { color: colors.heading }]}
              numberOfLines={1}
            >
              {fileName}
            </Text>
            <Text style={[styles.fileSize, { color: colors.subText }]}>
              {fileSize}
            </Text>
          </View>

          <Ionicons
            name={isExpanded ? 'chevron-up' : 'chevron-down'}
            size={20}
            color={colors.subText}
          />
        </View>

        {isExpanded && (
          <View
            style={[styles.expandedContent, { borderTopColor: colors.border }]}
          >
            <TouchableOpacity
              onPress={() => handleDeleteFile(fileName)}
              style={styles.deleteBtn}
            >
              <Ionicons name="trash-outline" size={18} color={colors.danger} />
              <Text style={[styles.deleteBtnText, { color: colors.danger }]}>
                Delete
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <ActivityIndicator
          size="large"
          color={colors.primary}
          style={{ marginTop: SPACING.lg }}
        />
      </View>
    );
  }

  if (files.length === 0) {
    return (
      <View
        style={[styles.emptyContainer, { backgroundColor: colors.cardMuted }]}
      >
        <Ionicons
          name="folder-open-outline"
          size={48}
          color={colors.subText}
          style={{ marginBottom: SPACING.md }}
        />
        <Text style={[styles.emptyTitle, { color: colors.heading }]}>
          No QR Codes Downloaded
        </Text>
        <Text style={[styles.emptyText, { color: colors.subText }]}>
          Your downloaded QR codes will appear here
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <Ionicons
          name="download-outline"
          size={20}
          color={colors.primary}
          style={{ marginRight: 8 }}
        />
        <Text style={[styles.headerTitle, { color: colors.heading }]}>
          Downloaded Files ({files.length})
        </Text>
      </View>

      <FlatList
        data={files}
        renderItem={renderFile}
        keyExtractor={(item) => item}
        scrollEnabled={false}
        ItemSeparatorComponent={() => <View style={{ height: SPACING.sm }} />}
        contentContainerStyle={styles.list}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  headerTitle: {
    fontSize: 14,
    fontFamily: FONTS.bold,
    flex: 1,
  },
  list: {
    gap: SPACING.sm,
  },
  fileItem: {
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
  fileItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    gap: SPACING.md,
  },
  fileIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fileName: {
    fontSize: 13,
    fontFamily: FONTS.bold,
    marginBottom: 4,
  },
  fileSize: {
    fontSize: 11,
    fontFamily: FONTS.regular,
  },
  expandedContent: {
    borderTopWidth: 1,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
  },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  deleteBtnText: {
    fontSize: 13,
    fontFamily: FONTS.bold,
  },
  emptyContainer: {
    borderRadius: 12,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    fontSize: 14,
    fontFamily: FONTS.bold,
    marginBottom: 4,
  },
  emptyText: {
    fontSize: 12,
    fontFamily: FONTS.regular,
    textAlign: 'center',
  },
});
