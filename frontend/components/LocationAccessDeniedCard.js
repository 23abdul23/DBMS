import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Easing,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { FONTS, SIZES, SPACING } from '../utils/constants';

const DEFAULT_TITLE = 'Access Out Of Bounds';
const DEFAULT_MESSAGE =
  'You are not within the required location proximity. Current access attempt is outside the allowed campus range.';
const DEFAULT_ACTION_LABEL = 'Go To Dashboard';

const formatDistance = (distance) => {
  if (distance === null || distance === undefined || distance === '') {
    return null;
  }

  if (typeof distance === 'string') {
    return distance;
  }

  if (!Number.isFinite(distance)) {
    return null;
  }

  if (distance < 1000) {
    return `${Math.round(distance)} m away`;
  }

  return `${(distance / 1000).toFixed(2)} km away`;
};

export default function LocationAccessDeniedCard({
  visible,
  title = DEFAULT_TITLE,
  message = DEFAULT_MESSAGE,
  onConfirm,
  actionLabel = DEFAULT_ACTION_LABEL,
  distance,
  targetLocation,
}) {
  const { colors, isDarkMode } = useTheme();
  const entrance = useRef(new Animated.Value(0.96)).current;

  useEffect(() => {
    if (!visible) {
      entrance.setValue(0.96);
      return;
    }

    Animated.timing(entrance, {
      toValue: 1,
      duration: 320,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [entrance, visible]);

  const distanceLabel = formatDistance(distance);
  const distanceSentence =
    distanceLabel && targetLocation
      ? `You are ${distanceLabel} away from ${targetLocation}.`
      : distanceLabel
      ? `You are ${distanceLabel} away.`
      : null;

  return (
    <Animated.View
      style={[
        styles.card,
        {
          opacity: entrance,
          transform: [
            {
              translateY: entrance.interpolate({
                inputRange: [0.96, 1],
                outputRange: [18, 0],
              }),
            },
            {
              scale: entrance,
            },
          ],
          backgroundColor: colors.modalSurface,
          borderColor: `${colors.warning}${isDarkMode ? '5a' : '2f'}`,
          shadowColor: colors.shadowStrong,
        },
      ]}
    >
      <View
        pointerEvents="none"
        style={[
          styles.glow,
          {
            backgroundColor: colors.warningSoft,
          },
        ]}
      />

      <View style={styles.headerRow}>
        <View
          style={[
            styles.iconWrap,
            {
              backgroundColor: colors.warningSoft,
              borderColor: `${colors.warning}40`,
            },
          ]}
        >
          <Ionicons name="warning-outline" size={28} color={colors.warning} />
        </View>

        <View style={styles.headerCopy}>
          <Text style={[styles.title, { color: colors.heading }]}>{title}</Text>
          <Text style={[styles.message, { color: colors.subText }]}>
            {message}
          </Text>
          {distanceSentence ? (
            <Text style={[styles.distanceText, { color: colors.warning }]}>
              {distanceSentence}
            </Text>
          ) : null}
        </View>
      </View>

      <View style={styles.metaRow}>
        {targetLocation ? (
          <View
            style={[
              styles.chip,
              {
                backgroundColor: colors.primarySoft,
                borderColor: colors.border,
              },
            ]}
          >
            <Ionicons
              name="location-outline"
              size={14}
              color={colors.primary}
            />
            <Text style={[styles.chipText, { color: colors.primary }]}>
              {targetLocation}
            </Text>
          </View>
        ) : null}

        {distanceLabel ? (
          <View
            style={[
              styles.chip,
              {
                backgroundColor: colors.warningSoft,
                borderColor: colors.border,
              },
            ]}
          >
            <Ionicons name="resize-outline" size={14} color={colors.warning} />
            <Text style={[styles.chipText, { color: colors.warning }]}>
              {distanceLabel}
            </Text>
          </View>
        ) : null}
      </View>

      <TouchableOpacity
        activeOpacity={0.9}
        onPress={onConfirm}
        style={[
          styles.button,
          {
            backgroundColor: colors.primary,
            shadowColor: colors.primary,
          },
        ]}
      >
        <Text style={[styles.buttonText, { color: colors.onPrimary }]}>
          {actionLabel}
        </Text>
        <Ionicons name="arrow-forward" size={18} color={colors.onPrimary} />
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 30,
    paddingHorizontal: 22,
    paddingTop: 22,
    paddingBottom: 20,
    borderWidth: 1,
    overflow: 'hidden',
    shadowOpacity: 0.24,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 16 },
    elevation: 18,
  },
  glow: {
    position: 'absolute',
    top: -18,
    right: -18,
    width: 108,
    height: 108,
    borderRadius: 999,
    opacity: 0.65,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.md,
  },
  iconWrap: {
    width: 54,
    height: 54,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  headerCopy: {
    flex: 1,
  },
  title: {
    fontFamily: FONTS.bold,
    fontSize: SIZES.xxl,
    lineHeight: 28,
    marginBottom: 8,
  },
  message: {
    fontFamily: FONTS.regular,
    fontSize: SIZES.sm,
    lineHeight: 22,
  },
  distanceText: {
    fontFamily: FONTS.bold,
    fontSize: SIZES.sm,
    lineHeight: 22,
    marginTop: 10,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 18,
    marginBottom: 20,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
  },
  chipText: {
    fontFamily: FONTS.bold,
    fontSize: 12,
  },
  button: {
    minHeight: 52,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 10,
    shadowOpacity: 0.24,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  buttonText: {
    fontFamily: FONTS.bold,
    fontSize: SIZES.md,
    letterSpacing: 0.2,
  },
});
