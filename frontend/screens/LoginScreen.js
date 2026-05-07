'use client';

import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Modal,
  ImageBackground,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useRef, useEffect } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { COLORS, FONTS, SIZES, SPACING } from '../utils/constants';
import LoadingSpinner from '../components/LoadingSpinner';
import wardens from '../constants/Wardens.json';
import api, {
  devQuickLoginCredentialsByRole,
  isDevelopmentEnvironement,
} from '../services/api';

export default function LoginScreen({ navigation }) {
  const { isDarkMode, toggleTheme, colors } = useTheme();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('student');
  const [password, setPassword] = useState('123456');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const backgroundImages = [
    require('../assets/images/iiita.jpeg'),
    require('../assets/images/iiita2.jpeg'),
  ];

  const [forgotModalVisible, setForgotModalVisible] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [sendingForgot, setSendingForgot] = useState(false);
  const forgotInputRef = useRef(null);

  // Switch image every 5 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentImageIndex(
        (prevIndex) => (prevIndex + 1) % backgroundImages.length
      );
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }
    setLoading(true);
    const result = await login(email, password, role);
    setLoading(false);

    if (!result.success) {
      Alert.alert('Login Failed', result.error);
    }
  };

  const handleDevQuickLogin = async () => {
    const credentials = devQuickLoginCredentialsByRole[role];

    if (!credentials) {
      Alert.alert(
        'Missing Test Credentials',
        `No development test account is configured for role: ${role}`
      );
      return;
    }

    setLoading(true);
    const result = await login(credentials.email, credentials.password, role);
    setLoading(false);

    if (!result.success) {
      Alert.alert(
        'Quick Login Failed',
        `${result.error}. Run backend dummy seed scripts and try again.`
      );
    }
  };

  const openForgotModal = () => {
    setForgotEmail(email || '');
    setForgotModalVisible(true);
  };

  const sendForgotEmail = async () => {
    if (!forgotEmail) {
      Alert.alert('Error', 'Please enter your email');
      return;
    }
    try {
      setSendingForgot(true);
      const res = await api.post('/forgot', { email: forgotEmail });
      setSendingForgot(false);
      setForgotModalVisible(false);
      Alert.alert('Success', res.data?.message || 'Password reset email sent');
    } catch (err) {
      setSendingForgot(false);
      const msg =
        err?.response?.data?.message ||
        err.message ||
        'Failed to send reset email';
      Alert.alert('Error Sending', msg);
    }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <SafeAreaView
      style={[styles.safeContainer, { backgroundColor: colors.background }]}
    >
      <ImageBackground
        source={backgroundImages[currentImageIndex]}
        style={styles.backgroundImage}
        blurRadius={0.8}
      >
        <View style={styles.overlayContainer}>
          <KeyboardAvoidingView
            style={[styles.container]}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          >
            {/* Floating Theme Toggle */}
            <TouchableOpacity
              onPress={toggleTheme}
              style={[
                styles.themeButton,
                {
                  backgroundColor: colors.cardGlass,
                  borderColor: colors.border,
                },
              ]}
            >
              <Ionicons
                name={isDarkMode ? 'sunny' : 'moon'}
                size={24}
                color={colors.text}
              />
            </TouchableOpacity>

            <ScrollView
              contentContainerStyle={styles.scrollContainer}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {/* Header */}
              <View
                style={[
                  styles.header,
                  {
                    backgroundColor: colors.cardGlass,
                    borderColor: colors.border,
                    shadowColor: colors.shadow,
                  },
                ]}
              >
                <Text style={[styles.title, { color: colors.text }]}>
                  Aegis ID
                </Text>
                <Text style={[styles.subtitle, { color: colors.subText }]}>
                  Digital Campus Pass
                </Text>
              </View>

              {/* Role Picker */}
              <View
                style={[
                  styles.inputContainer,
                  {
                    backgroundColor: colors.inputBackground,
                    borderColor: colors.inputBorder,
                  },
                ]}
              >
                <Ionicons
                  name="person-outline"
                  size={20}
                  color={colors.subText}
                  style={styles.inputIcon}
                />
                <Picker
                  selectedValue={role}
                  style={[styles.input, { color: colors.inputText, flex: 1 }]}
                  onValueChange={(itemValue) => setRole(itemValue)}
                  dropdownIconColor={colors.subText}
                >
                  <Picker.Item label="Student" value="student" />
                  <Picker.Item label="Warden" value="warden" />
                  <Picker.Item label="Security" value="security" />
                  <Picker.Item label="SAC Administrator" value="sac_admin" />
                  <Picker.Item
                    label="Library Administrator"
                    value="library_admin"
                  />
                </Picker>
              </View>

              {/* Form */}
              <View style={styles.form}>
                <View
                  style={[
                    styles.inputContainer,
                    {
                      backgroundColor: colors.inputBackground,
                      borderColor: colors.inputBorder,
                    },
                  ]}
                >
                  <Ionicons
                    name="mail-outline"
                    size={20}
                    color={colors.subText}
                    style={styles.inputIcon}
                  />
                  {role === 'warden' ? (
                    <Picker
                      selectedValue={email}
                      style={[
                        styles.input,
                        { color: colors.inputText, flex: 1 },
                      ]}
                      onValueChange={(itemValue) => setEmail(itemValue)}
                      dropdownIconColor={colors.subText}
                    >
                      <Picker.Item label="Select Hostel" value="" />
                      {wardens.wardens.map((info, index) => {
                        return (
                          <Picker.Item
                            key={index}
                            label={info.hostel}
                            value={info.email}
                          ></Picker.Item>
                        );
                      })}
                    </Picker>
                  ) : (
                    <TextInput
                      style={[styles.input, { color: colors.inputText }]}
                      placeholder="Email Address"
                      placeholderTextColor={colors.inputText}
                      value={email}
                      onChangeText={setEmail}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      autoComplete="email"
                    />
                  )}
                </View>

                <View
                  style={[
                    styles.inputContainer,
                    {
                      backgroundColor: colors.inputBackground,
                      borderColor: colors.inputBorder,
                    },
                  ]}
                >
                  <Ionicons
                    name="lock-closed-outline"
                    size={20}
                    color={colors.subText}
                    style={styles.inputIcon}
                  />
                  <TextInput
                    style={[styles.input, { color: colors.inputText }]}
                    placeholder="Password"
                    placeholderTextColor={colors.placeholder}
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={!showPassword}
                    autoComplete="password"
                  />
                  <TouchableOpacity
                    onPress={() => setShowPassword(!showPassword)}
                    style={styles.eyeIcon}
                  >
                    <Ionicons
                      name={showPassword ? 'eye-outline' : 'eye-off-outline'}
                      size={20}
                      color={colors.subText}
                    />
                  </TouchableOpacity>
                </View>

                <TouchableOpacity
                  style={[
                    styles.loginButton,
                    { backgroundColor: colors.primary },
                  ]}
                  onPress={handleLogin}
                >
                  <Text
                    style={[
                      styles.loginButtonText,
                      { color: colors.onPrimary },
                    ]}
                  >
                    Sign In
                  </Text>
                </TouchableOpacity>

                {isDevelopmentEnvironement ? (
                  <TouchableOpacity
                    style={[
                      styles.devQuickLoginButton,
                      {
                        borderColor: colors.border,
                        backgroundColor: colors.cardGlass,
                      },
                    ]}
                    onPress={handleDevQuickLogin}
                  >
                    <Text
                      style={[styles.devQuickLoginText, { color: colors.text }]}
                    >
                      Dev Quick Login ({role.replace('_', ' ')})
                    </Text>
                  </TouchableOpacity>
                ) : null}

                <TouchableOpacity
                  style={styles.forgotPassword}
                  onPress={openForgotModal}
                >
                  <Text
                    style={[styles.forgotPasswordText, { color: '#E8F4F8' }]}
                  >
                    Forgot Password?
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Forgot Password Modal */}
              <Modal
                visible={forgotModalVisible}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setForgotModalVisible(false)}
                onShow={() =>
                  setTimeout(() => forgotInputRef.current?.focus?.(), 100)
                }
              >
                <KeyboardAvoidingView
                  behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                  style={{
                    flex: 1,
                    justifyContent: 'center',
                    alignItems: 'center',
                    backgroundColor: colors.overlay,
                  }}
                >
                  <View
                    style={{
                      width: '90%',
                      backgroundColor: colors.modalSurface,
                      borderRadius: 24,
                      padding: 20,
                      borderWidth: 1,
                      borderColor: colors.border,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 18,
                        fontFamily: FONTS.bold,
                        color: colors.heading,
                        marginBottom: 8,
                      }}
                    >
                      Reset Password
                    </Text>
                    <Text style={{ color: colors.subText, marginBottom: 12 }}>
                      Enter your email to receive a reset link.
                    </Text>

                    <TextInput
                      ref={forgotInputRef}
                      autoFocus={true}
                      value={forgotEmail}
                      onChangeText={setForgotEmail}
                      placeholder="Email Address"
                      placeholderTextColor={colors.placeholder}
                      style={{
                        backgroundColor: colors.inputBackground,
                        color: colors.inputText,
                        height: 44,
                        borderRadius: 14,
                        paddingHorizontal: 14,
                        borderWidth: 1,
                        borderColor: colors.inputBorder,
                      }}
                      keyboardType="email-address"
                      autoCapitalize="none"
                    />

                    <View
                      style={{
                        flexDirection: 'row',
                        justifyContent: 'flex-end',
                        marginTop: 12,
                      }}
                    >
                      <TouchableOpacity
                        onPress={() => setForgotModalVisible(false)}
                        style={{ padding: 10, marginRight: 8 }}
                      >
                        <Text style={{ color: colors.subText }}>Cancel</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={sendForgotEmail}
                        style={{
                          paddingVertical: 10,
                          paddingHorizontal: 16,
                          borderRadius: 12,
                          backgroundColor: colors.primary,
                        }}
                      >
                        <Text style={{ color: colors.onPrimary }}>
                          {sendingForgot ? 'Sending...' : 'Send'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </KeyboardAvoidingView>
              </Modal>

              {/* Footer */}
              <View style={styles.footer}>
                <Text style={[styles.footerText, { color: '#D0D0D0' }]}>
                  Don`&apos;`t have an account?{' '}
                </Text>
                <TouchableOpacity
                  onPress={() => navigation.navigate('Register')}
                >
                  <Text style={[styles.signUpText, { color: '#E8F4F8' }]}>
                    Sign Up
                  </Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
        </View>
      </ImageBackground>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeContainer: {
    flex: 1,
  },
  backgroundImage: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  blurContainer: {
    flex: 1,
  },
  overlayContainer: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  container: {
    flex: 1,
    position: 'relative',
  },
  themeButton: {
    position: 'absolute',
    top: 38,
    right: 16,
    zIndex: 100,
    padding: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: SPACING.lg,
  },
  header: {
    alignItems: 'center',
    marginBottom: SPACING.xxl,
    paddingVertical: 24,
    paddingHorizontal: 18,
    borderRadius: 28,
    borderWidth: 1,
    shadowOpacity: 1,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 14 },
    elevation: 10,
    opacity: 0.9,
  },
  title: {
    fontSize: SIZES.xxxl,
    fontFamily: FONTS.bold,
    color: COLORS.primary,
    marginBottom: SPACING.xs,
  },
  subtitle: {
    fontSize: SIZES.md,
    fontFamily: FONTS.regular,
    color: COLORS.gray[600],
  },
  form: { marginBottom: SPACING.xl },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: 12,
    marginBottom: SPACING.md,
    paddingHorizontal: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.gray[200],
    opacity: 0.85,
  },
  inputIcon: { marginRight: SPACING.sm },
  input: {
    flex: 1,
    height: 50,
    fontSize: SIZES.md,
    fontFamily: FONTS.regular,
    color: COLORS.gray[800],
  },
  eyeIcon: { padding: SPACING.xs },
  loginButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: SPACING.md,
  },
  loginButtonText: {
    color: COLORS.white,
    fontSize: SIZES.lg,
    fontFamily: FONTS.bold,
  },
  devQuickLoginButton: {
    borderRadius: 12,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: SPACING.sm,
    borderWidth: 1,
  },
  devQuickLoginText: {
    fontSize: SIZES.sm,
    fontFamily: FONTS.regular,
    textTransform: 'capitalize',
  },
  forgotPassword: { alignItems: 'center', marginTop: SPACING.md },
  forgotPasswordText: { fontSize: SIZES.sm },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: SPACING.lg,
  },
  footerText: { fontSize: SIZES.md },
  signUpText: { fontSize: SIZES.md },
});
