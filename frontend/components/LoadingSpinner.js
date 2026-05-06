import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Easing,
  Image,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { FONTS } from '../utils/constants';

export default function LoadingSpinner({
  variant = 'screen',
  label = 'Preparing your campus pass',
  sublabel = 'Verifying identity, syncing movement status, and loading your dashboard.',
  statusText = 'This usually takes a moment while Aegis connects your campus services.',
  showThemeToggle,
}) {
  const { isDarkMode, toggleTheme, colors } = useTheme();
  const pulseAnim = useRef(new Animated.Value(0)).current;
  const orbitAnim = useRef(new Animated.Value(0)).current;
  const beamAnim = useRef(new Animated.Value(0)).current;
  const floatAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1800,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0,
          duration: 1800,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    );

    const orbitLoop = Animated.loop(
      Animated.timing(orbitAnim, {
        toValue: 1,
        duration: 9000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );

    const beamLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(beamAnim, {
          toValue: 1,
          duration: 1600,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(beamAnim, {
          toValue: 0,
          duration: 1600,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    );

    const floatLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, {
          toValue: 1,
          duration: 2200,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(floatAnim, {
          toValue: 0,
          duration: 2200,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    );

    pulseLoop.start();
    orbitLoop.start();
    beamLoop.start();
    floatLoop.start();

    return () => {
      pulseLoop.stop();
      orbitLoop.stop();
      beamLoop.stop();
      floatLoop.stop();
    };
  }, [beamAnim, floatAnim, orbitAnim, pulseAnim]);

  const pulseScale = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.94, 1.08],
  });

  const pulseOpacity = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.45, 0.9],
  });

  const orbitRotation = orbitAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const beamTranslateY = beamAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-54, 54],
  });

  const heroTranslateY = floatAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -10],
  });

  if (variant === 'inline') {
    return (
      <View style={styles.inlineWrap}>
        <View style={styles.inlineOrb}>
          <Animated.View
            style={[
              styles.inlinePulse,
              {
                backgroundColor: colors.primarySoft,
                opacity: pulseOpacity,
                transform: [{ scale: pulseScale }],
              },
            ]}
          />
          <Animated.View
            style={[
              styles.inlineRing,
              {
                borderColor: colors.borderStrong,
                transform: [{ rotate: orbitRotation }],
              },
            ]}
          >
            <View
              style={[
                styles.inlineDot,
                styles.inlineDotTop,
                { backgroundColor: colors.primary },
              ]}
            />
            <View
              style={[
                styles.inlineDot,
                styles.inlineDotBottom,
                { backgroundColor: colors.accent },
              ]}
            />
          </Animated.View>
          <View
            style={[styles.inlineCore, { backgroundColor: colors.primary }]}
          />
        </View>
        <Text style={[styles.inlineText, { color: colors.subText }]}>
          {label}
        </Text>
      </View>
    );
  }

  const isScreen = variant === 'screen';
  const resolvedShowThemeToggle = showThemeToggle ?? isScreen;
  const shellPadding = isScreen
    ? styles.screenContainer
    : styles.panelContainer;
  const heroSize = isScreen ? styles.heroWrap : styles.heroWrapCompact;

  const hero = (
    <Animated.View
      style={[
        heroSize,
        {
          transform: [{ translateY: heroTranslateY }],
        },
      ]}
    >
      <Animated.View
        pointerEvents="none"
        style={[
          styles.heroHalo,
          {
            backgroundColor: colors.primarySoft,
            opacity: pulseOpacity,
            transform: [{ scale: pulseScale }],
          },
        ]}
      />

      <Animated.View
        pointerEvents="none"
        style={[
          styles.orbitRing,
          {
            borderColor: colors.borderStrong,
            transform: [{ rotate: orbitRotation }],
          },
        ]}
      >
        <View
          style={[
            styles.orbitDot,
            styles.orbitTop,
            { backgroundColor: colors.primary },
          ]}
        />
        <View
          style={[
            styles.orbitDot,
            styles.orbitRight,
            { backgroundColor: colors.accent },
          ]}
        />
        <View
          style={[
            styles.orbitDot,
            styles.orbitBottom,
            { backgroundColor: colors.warning },
          ]}
        />
        <View
          style={[
            styles.orbitDot,
            styles.orbitLeft,
            { backgroundColor: colors.success },
          ]}
        />
      </Animated.View>

      <View
        style={[
          styles.logoShell,
          {
            backgroundColor: colors.cardGlass,
            borderColor: colors.border,
            shadowColor: colors.shadowStrong,
          },
        ]}
      >
        <Animated.View
          pointerEvents="none"
          style={[
            styles.scanBeam,
            {
              backgroundColor: isDarkMode
                ? 'rgba(96, 165, 250, 0.16)'
                : 'rgba(29, 78, 216, 0.12)',
              transform: [{ translateY: beamTranslateY }],
            },
          ]}
        />
        <Image
          source={require('../assets/aegisIdLogo.png')}
          style={styles.logo}
          resizeMode="contain"
        />
      </View>
    </Animated.View>
  );

  const content = (
    <View style={[styles.baseContainer, shellPadding]}>
      <Animated.View
        pointerEvents="none"
        style={[
          styles.backgroundGlowLarge,
          {
            backgroundColor: colors.primarySoft,
            opacity: pulseOpacity,
            transform: [{ scale: pulseScale }],
          },
        ]}
      />

      {resolvedShowThemeToggle ? (
        <View style={styles.topRow}>
          <TouchableOpacity
            onPress={toggleTheme}
            style={[
              styles.themeButton,
              {
                backgroundColor: colors.cardElevated,
                borderColor: colors.border,
                shadowColor: colors.shadowStrong,
              },
            ]}
            activeOpacity={0.88}
          >
            <Ionicons
              name={isDarkMode ? 'sunny' : 'moon'}
              size={20}
              color={colors.text}
            />
          </TouchableOpacity>
        </View>
      ) : null}

      <View style={styles.content}>
        {hero}
        {/* {copyCard} */}
      </View>
    </View>
  );

  if (isScreen) {
    return (
      <SafeAreaView
        style={[styles.safeArea, { backgroundColor: colors.background }]}
      >
        <StatusBar
          barStyle={isDarkMode ? 'light-content' : 'dark-content'}
          backgroundColor={colors.background}
        />
        {content}
      </SafeAreaView>
    );
  }

  return (
    <View style={[styles.panelWrap, { backgroundColor: colors.background }]}>
      {content}
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  panelWrap: {
    flex: 1,
  },
  baseContainer: {
    flex: 1,
    overflow: 'hidden',
  },
  screenContainer: {
    paddingHorizontal: 22,
    paddingTop: 8,
    paddingBottom: 28,
  },
  panelContainer: {
    paddingHorizontal: 18,
    paddingVertical: 18,
  },
  backgroundGlowLarge: {
    position: 'absolute',
    width: 280,
    height: 280,
    borderRadius: 999,
    top: 64,
    left: -24,
  },
  backgroundGlowSmall: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 999,
    bottom: 108,
    right: -38,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  themeButton: {
    width: 42,
    height: 42,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    shadowOffset: { width: 0, height: 10 },
    shadowRadius: 18,
    elevation: 5,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroWrap: {
    width: 250,
    height: 250,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 30,
  },
  heroWrapCompact: {
    width: 212,
    height: 212,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 22,
  },
  heroHalo: {
    position: 'absolute',
    width: 208,
    height: 208,
    borderRadius: 999,
  },
  orbitRing: {
    position: 'absolute',
    width: 228,
    height: 228,
    borderRadius: 999,
    borderWidth: 1,
  },
  orbitDot: {
    position: 'absolute',
    width: 12,
    height: 12,
    borderRadius: 999,
  },
  orbitTop: {
    top: -6,
    left: '50%',
    marginLeft: -6,
  },
  orbitRight: {
    right: -6,
    top: '50%',
    marginTop: -6,
  },
  orbitBottom: {
    bottom: -6,
    left: '50%',
    marginLeft: -6,
  },
  orbitLeft: {
    left: -6,
    top: '50%',
    marginTop: -6,
  },
  logoShell: {
    width: 152,
    height: 152,
    borderRadius: 40,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.18,
    shadowRadius: 28,
    elevation: 10,
  },
  scanBeam: {
    position: 'absolute',
    width: '100%',
    height: 58,
  },
  logo: {
    width: 98,
    height: 98,
  },
  copyCard: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 24,
    borderWidth: 1,
    padding: 18,
    shadowOffset: { width: 0, height: 16 },
    shadowRadius: 24,
    elevation: 10,
  },
  copyCardCompact: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 28,
    borderWidth: 1,
    padding: 20,
    shadowOffset: { width: 0, height: 16 },
    shadowRadius: 24,
    elevation: 8,
  },
  eyebrowRow: {
    flexDirection: 'row',
    marginBottom: 14,
  },
  eyebrowBadge: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  eyebrowText: {
    fontSize: 12,
    fontFamily: FONTS.bold,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  title: {
    fontSize: 30,
    lineHeight: 36,
    fontFamily: FONTS.bold,
  },
  subtitle: {
    marginTop: 10,
    fontSize: 14,
    lineHeight: 21,
    fontFamily: FONTS.regular,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 20,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 9,
    marginRight: 8,
    marginBottom: 8,
  },
  chipText: {
    marginLeft: 7,
    fontSize: 12,
    fontFamily: FONTS.bold,
  },
  statusCard: {
    marginTop: 18,
    borderRadius: 22,
    borderWidth: 1,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusIcon: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  statusPulse: {
    position: 'absolute',
    width: 30,
    height: 30,
    borderRadius: 999,
  },
  statusDot: {
    width: 12,
    height: 12,
    borderRadius: 999,
  },
  statusCopy: {
    flex: 1,
  },
  statusTitle: {
    fontSize: 15,
    fontFamily: FONTS.bold,
  },
  statusText: {
    marginTop: 4,
    fontSize: 13,
    lineHeight: 19,
    fontFamily: FONTS.regular,
  },
  inlineWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
  },
  inlineOrb: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  inlinePulse: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderRadius: 999,
  },
  inlineRing: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderRadius: 999,
    borderWidth: 1,
  },
  inlineDot: {
    position: 'absolute',
    width: 7,
    height: 7,
    borderRadius: 999,
    left: '50%',
    marginLeft: -3.5,
  },
  inlineDotTop: {
    top: -3.5,
  },
  inlineDotBottom: {
    bottom: -3.5,
  },
  inlineCore: {
    width: 8,
    height: 8,
    borderRadius: 999,
  },
  inlineText: {
    fontSize: 13,
    fontFamily: FONTS.bold,
  },
});
