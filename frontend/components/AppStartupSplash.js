import React from 'react';
import { Image, StatusBar, StyleSheet, Text, View } from 'react-native';

export default function AppStartupSplash() {
  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#f4f7fb" />

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
    backgroundColor: '#f4f7fb', // background
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },

  glowLarge: {
    position: 'absolute',
    width: 300,
    height: 300,
    borderRadius: 999,
    backgroundColor: 'rgba(37,99,235,0.12)', // infoSoft vibe
    top: '14%',
    alignSelf: 'center',
  },

  glowSmall: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 999,
    backgroundColor: 'rgba(15,118,110,0.10)', // accentSoft vibe
    bottom: '18%',
    right: 24,
  },

  logoShell: {
    width: 132,
    height: 132,
    borderRadius: 36,

    backgroundColor: 'rgba(255,255,255,0.92)',
    borderWidth: 1,
    borderColor: '#d8e1ef',

    alignItems: 'center',
    justifyContent: 'center',

    marginBottom: 28,

    shadowColor: '#102033',
    shadowOffset: {
      width: 0,
      height: 10,
    },
    shadowOpacity: 0.12,
    shadowRadius: 24,

    elevation: 10,
  },

  logo: {
    width: 92,
    height: 92,
  },

  title: {
    color: '#08111f', // heading
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: 0.4,
  },

  subtitle: {
    color: '#5f6f85', // subText
    fontSize: 15,
    marginTop: 10,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 18,
  },
});
