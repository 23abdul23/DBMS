"use client"

import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Modal,
} from "react-native"
import { useState, useEffect } from "react"
import { useTheme } from "../context/ThemeContext"
import { Ionicons } from "@expo/vector-icons"
import { useAuth } from "../context/AuthContext"
import { commonAPI } from "../services/api"
import { COLORS, FONTS, SIZES, SPACING } from "../utils/constants"
import { AcademicYearList, AcademicYearMap, DepartmentList, DepartmentMap } from "../utils/enumMappings"
import LoadingSpinner from "../components/LoadingSpinner"
import { Picker } from "@react-native-picker/picker"

const STRONG_PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d])(?=\S+$).{8,64}$/

const getStrongPasswordError = (password) => {
  if (!password) {
    return "Please enter a new password"
  }

  if (!STRONG_PASSWORD_REGEX.test(password)) {
    return "Password must be 8-64 chars with uppercase, lowercase, number, and special character (no spaces)."
  }

  return null
}

const getBannerBackground = (type) => {
  if (type === "success") {
    return "#166534"
  }

  if (type === "warning") {
    return "#92400e"
  }

  return "#b91c1c"
}

export default function ProfileScreen() {
  const { isDarkMode, toggleTheme, colors } = useTheme()
  const { logout } = useAuth()
  const [profile, setProfile] = useState(null)
  const [editing, setEditing] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [pwdSaving, setPwdSaving] = useState(false)
  const [otpSubmitting, setOtpSubmitting] = useState(false)
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [otpCode, setOtpCode] = useState("")
  const [otpModalVisible, setOtpModalVisible] = useState(false)
  const [otpExpiresAt, setOtpExpiresAt] = useState(null)
  const [otpCountdown, setOtpCountdown] = useState(0)
  const [banner, setBanner] = useState({
    visible: false,
    title: "",
    message: "",
    type: "error",
  })

  const departments = DepartmentList
  const years = AcademicYearList
  const hostels = ["BH 1", "BH 2", "BH 3", "BH 4", "BH 5", "GH 1", "GH 2", "GH 3"]

  useEffect(() => {
    loadProfile()
  }, [])

  useEffect(() => {
    if (!banner.visible) {
      return undefined
    }

    const timeoutId = setTimeout(() => {
      setBanner((prev) => ({ ...prev, visible: false }))
    }, 4000)

    return () => clearTimeout(timeoutId)
  }, [banner.visible, banner.message, banner.title, banner.type])

  useEffect(() => {
    if (!otpModalVisible || !otpExpiresAt) {
      setOtpCountdown(0)
      return undefined
    }

    const updateCountdown = () => {
      const remainingSeconds = Math.max(0, Math.ceil((otpExpiresAt - Date.now()) / 1000))
      setOtpCountdown(remainingSeconds)
    }

    updateCountdown()
    const intervalId = setInterval(updateCountdown, 250)

    return () => clearInterval(intervalId)
  }, [otpModalVisible, otpExpiresAt])

  const showBanner = (title, message, type = "error") => {
    setBanner({
      visible: true,
      title,
      message,
      type,
    })
  }

  const resetPasswordFields = () => {
    setCurrentPassword("")
    setNewPassword("")
    setConfirmPassword("")
    setOtpCode("")
    setOtpExpiresAt(null)
    setOtpCountdown(0)
    setOtpModalVisible(false)
  }

  const loadProfile = async () => {
    try {
      const response = await commonAPI.getProfile()
      setProfile(response.data.userData || response.data.user)
    } catch (error) {
      console.log("Profile load error:", error)
      Alert.alert("Error", "Failed to load profile")
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await commonAPI.updateProfile(profile)
      setEditing(false)
      loadProfile()
      Alert.alert("Success", "Profile updated successfully")
    } catch (error) {
      Alert.alert("Error", "Error in Update profile")
    } finally {
      setSaving(false)
    }
  }

  const updateProfile = (key, value) => {
    setProfile((prev) => ({ ...prev, [key]: value }))
  }

  const requestStudentOtp = async (successTitle) => {
    if (!newPassword || !confirmPassword) {
      showBanner("Error", "Please fill all password fields")
      return false
    }

    if (newPassword !== confirmPassword) {
      showBanner("Error", "New password and confirm password do not match")
      return false
    }

    const strongPasswordError = getStrongPasswordError(newPassword)
    if (strongPasswordError) {
      showBanner("Weak Password", strongPasswordError)
      return false
    }

    try {
      setPwdSaving(true)
      const response = await commonAPI.requestPasswordOtp({
        newPassword,
        confirmPassword,
      })

      const expiresInSeconds = Number(response?.data?.expiresInSeconds || 90)
      setOtpCode("")
      setOtpExpiresAt(Date.now() + expiresInSeconds * 1000)
      setOtpModalVisible(true)
      showBanner(successTitle, response?.data?.message || "OTP sent to your email", "success")
      return true
    } catch (err) {
      console.log("Password OTP request error", err)

      if (err?.response?.data?.code === "WEAK_PASSWORD") {
        showBanner("Weak Password", err?.response?.data?.message || "Please choose a stronger password")
        return false
      }

      showBanner("Error", err?.response?.data?.message || err.message || "Server error")
      return false
    } finally {
      setPwdSaving(false)
    }
  }

  const handleStudentPasswordSubmit = async () => {
    await requestStudentOtp("OTP Sent")
  }

  const handleVerifyOtp = async () => {
    if (!otpCode.trim()) {
      showBanner("Error", "Please enter the OTP")
      return
    }

    try {
      setOtpSubmitting(true)
      const response = await commonAPI.verifyPasswordOtp({
        otp: otpCode.trim(),
      })

      showBanner("Success", response?.data?.message || "Password updated", "success")
      resetPasswordFields()
    } catch (err) {
      console.log("Password OTP verify error", err)
      showBanner("Error", err?.response?.data?.message || err.message || "Failed to verify OTP")
    } finally {
      setOtpSubmitting(false)
    }
  }

  const handleLegacyPasswordUpdate = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      showBanner("Error", "Please fill all password fields")
      return
    }

    if (newPassword !== confirmPassword) {
      showBanner("Error", "New password and confirm password do not match")
      return
    }

    const strongPasswordError = getStrongPasswordError(newPassword)
    if (strongPasswordError) {
      showBanner("Weak Password", strongPasswordError)
      return
    }

    try {
      setPwdSaving(true)
      const res = await commonAPI.changePassword({ currentPassword, newPassword, confirmPassword })
      showBanner("Success", res?.data?.message || "Password updated", "success")
      resetPasswordFields()
    } catch (err) {
      console.log("Change password error", err)

      if (err?.response?.data?.code === "WEAK_PASSWORD") {
        showBanner("Weak Password", err?.response?.data?.message || "Please choose a stronger password")
        return
      }

      showBanner("Error", err?.response?.data?.message || err.message || "Server error")
    } finally {
      setPwdSaving(false)
    }
  }

  if (loading) {
    return <LoadingSpinner />
  }

  const isStudent = profile?.role === "student"
  const isSecurity = profile?.role === "security"
  const locationLabel = isSecurity ? "Assigned Post" : "Assigned Hostel"
  const idLabel = isSecurity ? "Guard ID" : "Student ID"
  const resendDisabled = otpCountdown > 0 || pwdSaving

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      {banner.visible ? (
        <View style={[styles.banner, { backgroundColor: getBannerBackground(banner.type) }]}>
          <View style={styles.bannerContent}>
            <Text style={styles.bannerTitle}>{banner.title}</Text>
            <Text style={styles.bannerMessage}>{banner.message}</Text>
          </View>
          <TouchableOpacity onPress={() => setBanner((prev) => ({ ...prev, visible: false }))} style={styles.bannerClose}>
            <Ionicons name="close" size={18} color={COLORS.white} />
          </TouchableOpacity>
        </View>
      ) : null}

      <ScrollView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { backgroundColor: colors.card }]}>
          <View style={styles.headerActions}>
            <TouchableOpacity onPress={toggleTheme} style={styles.themeToggle}>
              <Ionicons name={isDarkMode ? "sunny" : "moon"} size={24} color={colors.text} />
            </TouchableOpacity>
          </View>
          <View style={styles.avatarContainer}>
            <View style={[styles.avatar, { backgroundColor: colors.background + "20" }]}>
              <Text style={[styles.avatarText, { color: colors.text }]}>{profile?.name?.charAt(0)?.toUpperCase() || "U"}</Text>
            </View>
            <Text style={[styles.userName, { color: colors.text }]}>{profile?.name}</Text>
            <Text style={[styles.userRole, { color: colors.text, opacity: 0.8 }]}>{profile?.role?.toUpperCase()}</Text>
          </View>
        </View>

        <View style={styles.content}>
          <View style={[styles.section, { backgroundColor: colors.card }]}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Personal Information</Text>
              <TouchableOpacity
                style={styles.editButton}
                onPress={() => (editing ? handleSave() : setEditing(true))}
                disabled={saving}
              >
                <Ionicons name={editing ? "checkmark" : "pencil"} size={20} color={colors.text} />
                <Text style={[styles.editButtonText, { color: colors.text }]}>{editing ? (saving ? "Saving..." : "Save") : "Edit"}</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.fieldContainer}>
              <Text style={[styles.fieldLabel, { color: colors.text }]}>Full Name</Text>
              {editing ? (
                <TextInput
                  style={[styles.fieldInput, { color: colors.inputText, borderBottomColor: colors.inputBorderFocus }]}
                  value={profile?.name || ""}
                  onChangeText={(value) => updateProfile("name", value)}
                  placeholderTextColor={colors.subText}
                />
              ) : (
                <Text style={[styles.fieldValue, { color: colors.text }]}>{profile?.name}</Text>
              )}
            </View>

            <View style={styles.fieldContainer}>
              <Text style={[styles.fieldLabel, { color: colors.text }]}>Email</Text>
              {editing ? (
                <TextInput
                  style={[styles.fieldInput, { color: colors.inputText, borderBottomColor: colors.inputBorderFocus }]}
                  value={profile?.email || ""}
                  onChangeText={(value) => updateProfile("email", value)}
                  placeholderTextColor={colors.subText}
                />
              ) : (
                <Text style={[styles.fieldValue, { color: colors.text }]}>{profile?.email}</Text>
              )}
            </View>

            {isStudent || isSecurity ? (
              <View style={styles.fieldContainer}>
                <Text style={[styles.fieldLabel, { color: colors.text }]}>{idLabel}</Text>
                {editing ? (
                  <TextInput
                    style={[styles.fieldInput, { color: colors.inputText, borderBottomColor: colors.inputBorderFocus }]}
                    value={isSecurity ? profile?.guardId || "" : profile?.studentId || ""}
                    onChangeText={(value) => updateProfile(isSecurity ? "guardId" : "studentId", value)}
                    placeholderTextColor={colors.subText}
                  />
                ) : (
                  <Text style={[styles.fieldValue, { color: colors.text }]}>
                    {isSecurity ? profile?.guardId : profile?.studentId}
                  </Text>
                )}
              </View>
            ) : null}

            <View style={styles.fieldContainer}>
              <Text style={[styles.fieldLabel, { color: colors.text }]}>Phone Number</Text>
              {editing ? (
                <TextInput
                  style={[styles.fieldInput, { color: colors.inputText, borderBottomColor: colors.inputBorderFocus }]}
                  value={profile?.phoneNumber || ""}
                  onChangeText={(value) => updateProfile("phoneNumber", value)}
                  keyboardType="phone-pad"
                  placeholderTextColor={colors.subText}
                />
              ) : (
                <Text style={[styles.fieldValue, { color: colors.text }]}>{profile?.phoneNumber}</Text>
              )}
            </View>
          </View>

          <View style={[styles.section, { backgroundColor: colors.card }]}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                {isStudent ? "Academic Information" : isSecurity ? "Station Information" : "Hostel Information"}
              </Text>
            </View>

            {isStudent && !editing ? (
              <>
                <View style={styles.fieldContainer}>
                  <Text style={[styles.fieldLabel, { color: colors.text }]}>Department</Text>
                  <Text style={[styles.fieldValue, { color: colors.text }]}>{DepartmentMap[profile?.department] || profile?.department}</Text>
                </View>

                <View style={styles.fieldContainer}>
                  <Text style={[styles.fieldLabel, { color: colors.text }]}>Year</Text>
                  <Text style={[styles.fieldValue, { color: colors.text }]}>{AcademicYearMap[profile?.year] || profile?.year}</Text>
                </View>

                <View style={styles.fieldContainer}>
                  <Text style={[styles.fieldLabel, { color: colors.text }]}>Hostel</Text>
                  <Text style={[styles.fieldValue, { color: colors.text }]}>{profile?.hostel}</Text>
                </View>
              </>
            ) : isStudent && editing ? (
              <>
                <View style={[styles.pickerContainer, { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder }]}>
                  <Ionicons name="library-outline" size={20} color={colors.subText} style={styles.inputIcon} />
                  <Picker selectedValue={profile.department || ""} style={[styles.picker, { color: colors.inputText }]} onValueChange={(value) => updateProfile("department", value)}>
                    <Picker.Item label="Select Department *" value="" />
                    {departments.map((dept) => (
                      <Picker.Item key={dept} label={DepartmentMap[dept] || dept} value={dept} />
                    ))}
                  </Picker>
                </View>
                <View style={[styles.pickerContainer, { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder }]}>
                  <Ionicons name="calendar-outline" size={20} color={colors.subText} style={styles.inputIcon} />
                  <Picker selectedValue={profile.year || ""} style={[styles.picker, { color: colors.inputText }]} onValueChange={(value) => updateProfile("year", value)}>
                    <Picker.Item label="Select Year *" value="" />
                    {years.map((year) => (
                      <Picker.Item key={year} label={AcademicYearMap[year] || year} value={year} />
                    ))}
                  </Picker>
                </View>
                <View style={[styles.pickerContainer, { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder }]}>
                  <Ionicons name="home-outline" size={20} color={colors.subText} style={styles.inputIcon} />
                  <Picker selectedValue={profile.hostel || ""} style={[styles.picker, { color: colors.inputText }]} onValueChange={(value) => updateProfile("hostel", value)}>
                    <Picker.Item label="Select Hostel *" value="" />
                    {hostels.map((hostel) => (
                      <Picker.Item key={hostel} label={hostel} value={hostel} />
                    ))}
                  </Picker>
                </View>
              </>
            ) : (
              <View style={styles.fieldContainer}>
                <Text style={[styles.fieldLabel, { color: colors.text }]}>{locationLabel}</Text>
                <Text style={[styles.fieldValue, { color: colors.text }]}>{profile?.hostel || "Not assigned"}</Text>
              </View>
            )}

            <View style={styles.fieldContainer}>
              <Text style={[styles.fieldLabel, { color: colors.text }]}>Room Number</Text>
              {editing ? (
                <TextInput
                  style={[styles.fieldInput, { color: colors.inputText, borderBottomColor: colors.inputBorderFocus }]}
                  value={profile?.roomNumber || ""}
                  onChangeText={(value) => updateProfile("roomNumber", value)}
                  placeholderTextColor={colors.subText}
                />
              ) : (
                <Text style={[styles.fieldValue, { color: colors.text }]}>{profile?.roomNumber || "Not specified"}</Text>
              )}
            </View>
          </View>

          <View style={[styles.section, { backgroundColor: colors.card }]}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Change Password</Text>
            </View>

            {!isStudent ? (
              <View style={styles.fieldContainer}>
                <Text style={[styles.fieldLabel, { color: colors.text }]}>Current Password</Text>
                <TextInput
                  style={[styles.fieldInput, { color: colors.inputText, borderBottomColor: colors.inputBorderFocus }]}
                  value={currentPassword}
                  onChangeText={setCurrentPassword}
                  secureTextEntry={!showCurrent}
                  placeholder="Enter current password"
                  placeholderTextColor={colors.subText}
                  autoCapitalize="none"
                />
                <TouchableOpacity onPress={() => setShowCurrent((value) => !value)} style={styles.eyeButton}>
                  <Ionicons name={showCurrent ? "eye-outline" : "eye-off-outline"} size={18} color={colors.subText} />
                </TouchableOpacity>
              </View>
            ) : null}

            <View style={styles.fieldContainer}>
              <Text style={[styles.fieldLabel, { color: colors.text }]}>New Password</Text>
              <TextInput
                style={[styles.fieldInput, { color: colors.inputText, borderBottomColor: colors.inputBorderFocus }]}
                value={newPassword}
                onChangeText={setNewPassword}
                secureTextEntry={!showNew}
                placeholder="Enter new password"
                placeholderTextColor={colors.subText}
                autoCapitalize="none"
              />
              <TouchableOpacity onPress={() => setShowNew((value) => !value)} style={styles.eyeButton}>
                <Ionicons name={showNew ? "eye-outline" : "eye-off-outline"} size={18} color={colors.subText} />
              </TouchableOpacity>
            </View>

            <View style={styles.fieldContainer}>
              <Text style={[styles.fieldLabel, { color: colors.text }]}>Confirm New Password</Text>
              <TextInput
                style={[styles.fieldInput, { color: colors.inputText, borderBottomColor: colors.inputBorderFocus }]}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry={!showConfirm}
                placeholder="Confirm new password"
                placeholderTextColor={colors.subText}
                autoCapitalize="none"
              />
              <TouchableOpacity onPress={() => setShowConfirm((value) => !value)} style={styles.eyeButton}>
                <Ionicons name={showConfirm ? "eye-outline" : "eye-off-outline"} size={18} color={colors.subText} />
              </TouchableOpacity>
            </View>

            {isStudent ? (
              <Text style={[styles.passwordHint, { color: colors.subText }]}>An OTP will be sent to your email after you submit the new password.</Text>
            ) : null}

            <View style={styles.passwordActions}>
              <TouchableOpacity onPress={resetPasswordFields} style={styles.cancelButton}>
                <Text style={{ color: colors.text }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={isStudent ? handleStudentPasswordSubmit : handleLegacyPasswordUpdate}
                style={[styles.editButton, styles.passwordSubmit]}
                disabled={pwdSaving}
              >
                <Ionicons name="key-outline" size={18} color={colors.text} />
                <Text style={[styles.editButtonText, { color: colors.text, marginLeft: SPACING.xs }]}>
                  {pwdSaving ? (isStudent ? "Sending OTP..." : "Updating...") : isStudent ? "Send OTP" : "Update Password"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={[styles.section, { backgroundColor: colors.card }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Account Status</Text>

            <View style={styles.statusContainer}>
              <View style={styles.statusItem}>
                <View
                  style={[
                    styles.statusDot,
                    {
                      backgroundColor: profile?.isActive ? "#4caf50" : "#f44336",
                    },
                  ]}
                />
                <Text style={[styles.statusText, { color: colors.text }]}>{profile?.isActive ? "Active" : "Inactive"}</Text>
              </View>

              <View style={styles.statusItem}>
                <Text style={[styles.statusLabel, { color: colors.text }]}>Member since</Text>
                <Text style={[styles.statusValue, { color: colors.text }]}>{new Date(profile?.createdAt).toLocaleDateString()}</Text>
              </View>
            </View>
          </View>

          <TouchableOpacity style={[styles.logoutButton, { backgroundColor: isDarkMode ? "#f4433620" : COLORS.error + "10" }]} onPress={logout}>
            <Ionicons name="log-out-outline" size={20} color={isDarkMode ? "#f44336" : COLORS.error} />
            <Text style={[styles.logoutButtonText, { color: isDarkMode ? "#f44336" : COLORS.error }]}>Logout</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <Modal visible={otpModalVisible} transparent animationType="fade" onRequestClose={() => setOtpModalVisible(false)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { backgroundColor: colors.card }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Verify OTP</Text>
              <TouchableOpacity onPress={() => setOtpModalVisible(false)}>
                <Ionicons name="close" size={20} color={colors.text} />
              </TouchableOpacity>
            </View>

            <Text style={[styles.modalText, { color: colors.subText }]}>
              Enter the 6-digit OTP sent to {profile?.email || "your email"}.
            </Text>

            <TextInput
              style={[styles.otpInput, { color: colors.text, borderColor: colors.subText }]}
              value={otpCode}
              onChangeText={setOtpCode}
              keyboardType="number-pad"
              maxLength={6}
              placeholder="Enter OTP"
              placeholderTextColor={colors.subText}
            />

            <Text style={[styles.modalCountdown, { color: otpCountdown > 0 ? colors.text : COLORS.error }]}>
              {otpCountdown > 0 ? `OTP expires in ${otpCountdown}s` : "OTP expired. You can resend it now."}
            </Text>

            <View style={styles.modalActions}>
              <TouchableOpacity
                onPress={() => requestStudentOtp("OTP Resent")}
                disabled={resendDisabled}
                style={[styles.modalSecondaryButton, resendDisabled && styles.disabledButton]}
              >
                <Text style={[styles.modalSecondaryText, { color: resendDisabled ? colors.subText : colors.text }]}>Resend OTP</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleVerifyOtp} style={styles.modalPrimaryButton} disabled={otpSubmitting}>
                <Text style={styles.modalPrimaryText}>{otpSubmitting ? "Verifying..." : "Verify OTP"}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  banner: {
    position: "absolute",
    top: 18,
    left: 12,
    right: 12,
    zIndex: 20,
    borderRadius: 14,
    paddingVertical: 12,
    paddingLeft: 14,
    paddingRight: 10,
    flexDirection: "row",
    alignItems: "flex-start",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
  },
  bannerContent: {
    flex: 1,
    paddingRight: 8,
  },
  bannerTitle: {
    color: COLORS.white,
    fontSize: SIZES.md,
    fontFamily: FONTS.bold,
    marginBottom: 2,
  },
  bannerMessage: {
    color: COLORS.white,
    fontSize: SIZES.sm,
    fontFamily: FONTS.regular,
    lineHeight: 20,
  },
  bannerClose: {
    padding: 4,
  },
  container: {
    flex: 1,
  },
  header: {
    paddingTop: 50,
    paddingBottom: SPACING.xl,
    alignItems: "center",
  },
  headerActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    width: "100%",
  },
  themeToggle: {
    padding: 8,
    alignSelf: "flex-end",
  },
  avatarContainer: {
    alignItems: "center",
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: SPACING.md,
  },
  avatarText: {
    fontSize: SIZES.xxxl,
    fontFamily: FONTS.bold,
  },
  userName: {
    fontSize: SIZES.xl,
    fontFamily: FONTS.bold,
    marginBottom: SPACING.xs,
  },
  userRole: {
    fontSize: SIZES.sm,
    fontFamily: FONTS.regular,
    opacity: 0.8,
  },
  content: {
    padding: SPACING.lg,
  },
  section: {
    borderRadius: 12,
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: SPACING.lg,
  },
  sectionTitle: {
    fontSize: SIZES.lg,
    fontFamily: FONTS.bold,
  },
  editButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: 6,
  },
  editButtonText: {
    fontSize: SIZES.sm,
    fontFamily: FONTS.regular,
    marginLeft: SPACING.xs,
  },
  fieldContainer: {
    marginBottom: SPACING.md,
    position: "relative",
  },
  fieldLabel: {
    fontSize: SIZES.sm,
    fontFamily: FONTS.regular,
    marginBottom: SPACING.xs,
  },
  fieldValue: {
    fontSize: SIZES.md,
    fontFamily: FONTS.regular,
  },
  fieldInput: {
    fontSize: SIZES.md,
    fontFamily: FONTS.regular,
    borderBottomWidth: 1,
    paddingVertical: SPACING.xs,
    paddingRight: 36,
  },
  eyeButton: {
    position: "absolute",
    right: 12,
    top: 34,
  },
  pickerContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    marginBottom: SPACING.md,
    paddingHorizontal: SPACING.md,
    borderWidth: 1,
    height: 50,
  },
  inputIcon: {
    marginRight: SPACING.sm,
  },
  picker: {
    flex: 1,
    height: 50,
  },
  passwordHint: {
    fontSize: SIZES.sm,
    fontFamily: FONTS.regular,
    lineHeight: 20,
  },
  passwordActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 12,
  },
  cancelButton: {
    padding: 10,
    marginRight: 8,
  },
  passwordSubmit: {
    paddingHorizontal: 16,
  },
  statusContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  statusItem: {
    flexDirection: "row",
    alignItems: "center",
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: SPACING.xs,
  },
  statusText: {
    fontSize: SIZES.md,
    fontFamily: FONTS.regular,
  },
  statusLabel: {
    fontSize: SIZES.sm,
    fontFamily: FONTS.regular,
    marginRight: SPACING.xs,
  },
  statusValue: {
    fontSize: SIZES.sm,
    fontFamily: FONTS.regular,
  },
  logoutButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: SPACING.md,
    borderRadius: 12,
    marginTop: SPACING.lg,
  },
  logoutButtonText: {
    fontSize: SIZES.md,
    fontFamily: FONTS.bold,
    marginLeft: SPACING.xs,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.45)",
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  modalCard: {
    borderRadius: 18,
    padding: SPACING.lg,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: SPACING.md,
  },
  modalTitle: {
    fontSize: SIZES.lg,
    fontFamily: FONTS.bold,
  },
  modalText: {
    fontSize: SIZES.sm,
    fontFamily: FONTS.regular,
    lineHeight: 20,
    marginBottom: SPACING.md,
  },
  otpInput: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    fontSize: SIZES.lg,
    fontFamily: FONTS.bold,
    letterSpacing: 4,
    textAlign: "center",
  },
  modalCountdown: {
    marginTop: SPACING.sm,
    fontSize: SIZES.sm,
    fontFamily: FONTS.regular,
  },
  modalActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: SPACING.lg,
  },
  modalSecondaryButton: {
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderRadius: 10,
  },
  modalSecondaryText: {
    fontSize: SIZES.sm,
    fontFamily: FONTS.bold,
  },
  modalPrimaryButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.lg,
    borderRadius: 10,
  },
  modalPrimaryText: {
    color: COLORS.white,
    fontSize: SIZES.sm,
    fontFamily: FONTS.bold,
  },
  disabledButton: {
    opacity: 0.55,
  },
})
