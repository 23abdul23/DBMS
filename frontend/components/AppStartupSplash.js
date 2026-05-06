import React from 'react';
import { Image, StatusBar, StyleSheet, Text, View } from 'react-native';

export default function AppStartupSplash() {
  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#08111f" />

      <View style={styles.glowLarge} />
      <View style={styles.glowSmall} />

      <View style={styles.logoShell}>
        <Image
          source={require('../assets/aegisIdLogo.png')}
          style={styles.logo}
          resizeMode="contain"
        />
      </View>

      <Text style={styles.title}>Aegis ID</Text>
      <Text style={styles.subtitle}>Campus access, movement, and safety.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#08111f',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  glowLarge: {
    position: 'absolute',
    width: 280,
    height: 280,
    borderRadius: 999,
    backgroundColor: 'rgba(29,78,216,0.26)',
    top: '18%',
    alignSelf: 'center',
  },
  glowSmall: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 999,
    backgroundColor: 'rgba(45,212,191,0.18)',
    bottom: '20%',
    right: 38,
  },
  logoShell: {
    width: 122,
    height: 122,
    borderRadius: 34,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 22,
  },
  logo: {
    width: 84,
    height: 84,
  },
  title: {
    color: '#f8fbff',
    fontSize: 30,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  subtitle: {
    color: 'rgba(248,251,255,0.7)',
    fontSize: 14,
    marginTop: 10,
    textAlign: 'center',
  },
});
