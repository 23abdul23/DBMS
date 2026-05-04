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
import {
  AcademicYearList,
  AcademicYearMap,
  DepartmentList,
  DepartmentMap,
  GenderList,
  GenderMap,
  GenderReverseMap,
} from "../utils/enumMappings"
import LoadingSpinner from "../components/LoadingSpinner"
import { Picker } from "@react-native-picker/picker"
import { getScopedAdminLabel, isLibraryAdministrator, isSacAdministrator } from "../utils/adminScopes"

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

const formatDate = (value) => {
  if (!value) {
    return "Not available"
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return "Not available"
  }

  return date.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  })
}

const getInitials = (name = "") => {
  const parts = String(name).trim().split(/\s+/).filter(Boolean)
  if (!parts.length) {
    return "U"
  }

  return parts
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("")
}

const displayValue = (value, fallback = "Not specified") => {
  if (value === null || value === undefined || value === "") {
    return fallback
  }

  return value
}

const getRoleAccent = (role, profile, colors) => {
  if (isSacAdministrator(profile)) {
    return { icon: "color-wand-outline", bg: colors.warningSoft, fg: colors.warning }
  }

  if (isLibraryAdministrator(profile)) {
    return { icon: "library-outline", bg: colors.successSoft, fg: colors.success }
  }

  if (role === "security") {
    return { icon: "shield-checkmark-outline", bg: colors.dangerSoft, fg: colors.danger }
  }

  if (role === "warden") {
    return { icon: "business-outline", bg: colors.accentSoft, fg: colors.accent }
  }

  return { icon: "school-outline", bg: colors.primarySoft, fg: colors.primary }
}

const InfoRow = ({ icon, label, value, colors }) => (
  <View style={styles.infoRow}>
    <View style={[styles.infoIcon, { backgroundColor: colors.primarySoft }]}>
      <Ionicons name={icon} size={18} color={colors.primary} />
    </View>
    <View style={styles.infoCopy}>
      <Text style={[styles.fieldLabel, { color: colors.subText }]}>{label}</Text>
      <Text style={[styles.fieldValue, { color: colors.text }]} numberOfLines={2}>
        {displayValue(value)}
      </Text>
    </View>
  </View>
)

const EditableTextField = ({
  label,
  value,
  onChangeText,
  colors,
  keyboardType = "default",
  autoCapitalize = "sentences",
}) => (
  <View style={styles.fieldContainer}>
    <Text style={[styles.fieldLabel, { color: colors.subText }]}>{label}</Text>
    <TextInput
      style={[
        styles.fieldInput,
        {
          color: colors.inputText,
          backgroundColor: colors.inputBackground,
          borderColor: colors.inputBorder,
        },
      ]}
      value={value || ""}
      onChangeText={onChangeText}
      keyboardType={keyboardType}
      autoCapitalize={autoCapitalize}
      placeholder={label}
      placeholderTextColor={colors.subText}
    />
  </View>
)

const PasswordField = ({ label, value, onChangeText, visible, onToggle, colors, placeholder }) => (
  <View style={styles.fieldContainer}>
    <Text style={[styles.fieldLabel, { color: colors.subText }]}>{label}</Text>
    <View style={[styles.passwordInputShell, { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder }]}>
      <TextInput
        style={[styles.passwordInput, { color: colors.inputText }]}
        value={value}
        onChangeText={onChangeText}
        secureTextEntry={!visible}
        placeholder={placeholder}
        placeholderTextColor={colors.subText}
        autoCapitalize="none"
      />
      <TouchableOpacity onPress={onToggle} style={styles.passwordEyeButton}>
        <Ionicons name={visible ? "eye-outline" : "eye-off-outline"} size={18} color={colors.subText} />
      </TouchableOpacity>
    </View>
  </View>
)

export default function ProfileScreen() {
  const { isDarkMode, toggleTheme, colors } = useTheme()
  const { logout, setAuthenticatedUser } = useAuth()
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
  const genders = GenderList
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
      const response = await commonAPI.updateProfile(profile)
      const updatedProfile = response.data?.user || response.data?.userData || profile
      setProfile(updatedProfile)
      await setAuthenticatedUser(updatedProfile)
      setEditing(false)
      Alert.alert("Success", "Profile updated successfully")
    } catch (error) {
      Alert.alert("Error", error?.response?.data?.message || "Error in Update profile")
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
  const isScopedAdmin = profile?.role === "admin" && (isSacAdministrator(profile) || isLibraryAdministrator(profile))
  const locationLabel = isSecurity ? "Assigned Post" : isScopedAdmin ? "Access Scope" : "Assigned Hostel"
  const idLabel = isSecurity ? "Guard ID" : "Student ID"
  const resendDisabled = otpCountdown > 0 || pwdSaving
  const roleLabel = getScopedAdminLabel(profile) || profile?.role?.toUpperCase()
  const roleAccent = getRoleAccent(profile?.role, profile, colors)
  const primaryId = isSecurity ? profile?.guardId : profile?.studentId
  const locationValue = isSacAdministrator(profile)
    ? "SAC activity observer"
    : isLibraryAdministrator(profile)
      ? "Library activity observer"
      : profile?.hostel || "Not assigned"
  const academicLabel = isStudent
    ? `${DepartmentMap[profile?.department] || displayValue(profile?.department)} | ${
        AcademicYearMap[profile?.year] || displayValue(profile?.year)
      }`
    : locationValue
  const profileFields = [
    profile?.name,
    profile?.email,
    profile?.gender,
    profile?.phoneNumber,
    isStudent || isSecurity ? primaryId : roleLabel,
    isStudent ? profile?.department : locationValue,
    isStudent ? profile?.year : profile?.role,
    profile?.hostel,
    profile?.roomNumber,
  ]
  const completedFields = profileFields.filter((field) => field !== null && field !== undefined && field !== "").length
  const profileCompletion = Math.round((completedFields / profileFields.length) * 100)

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

      <ScrollView
        style={[styles.container, { backgroundColor: colors.background }]}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.heroShell}>
          <View
            style={[
              styles.heroCard,
              {
                backgroundColor: colors.cardElevated,
                borderColor: colors.border,
                shadowColor: colors.shadowStrong,
              },
            ]}
          >
            <View style={styles.heroTopRow}>
              <View style={[styles.avatar, { backgroundColor: roleAccent.bg }]}>
                <Text style={[styles.avatarText, { color: roleAccent.fg }]}>{getInitials(profile?.name)}</Text>
              </View>

              <View style={styles.heroActions}>
                <TouchableOpacity
                  onPress={toggleTheme}
                  style={[
                    styles.iconButton,
                    {
                      backgroundColor: colors.cardMuted,
                      borderColor: colors.border,
                    },
                  ]}
                >
                  <Ionicons name={isDarkMode ? "sunny" : "moon"} size={20} color={colors.text} />
                </TouchableOpacity>
                <View
                  style={[
                    styles.iconButton,
                    {
                      backgroundColor: profile?.isActive ? colors.successSoft : colors.dangerSoft,
                      borderColor: colors.border,
                    },
                  ]}
                >
                  <Ionicons
                    name={profile?.isActive ? "checkmark-circle-outline" : "alert-circle-outline"}
                    size={20}
                    color={profile?.isActive ? colors.success : colors.danger}
                  />
                </View>
              </View>
            </View>

            <Text style={[styles.userName, { color: colors.heading }]} numberOfLines={2}>
              {displayValue(profile?.name, "Unnamed User")}
            </Text>
            <Text style={[styles.userEmail, { color: colors.subText }]} numberOfLines={1}>
              {displayValue(profile?.email, "No email on file")}
            </Text>

            <View style={styles.chipRow}>
              <View style={[styles.roleChip, { backgroundColor: roleAccent.bg }]}>
                <Ionicons name={roleAccent.icon} size={15} color={roleAccent.fg} />
                <Text style={[styles.roleChipText, { color: roleAccent.fg }]} numberOfLines={1}>
                  {roleLabel}
                </Text>
              </View>
              <View style={[styles.statusChip, { backgroundColor: profile?.isActive ? colors.successSoft : colors.dangerSoft }]}>
                <View style={[styles.statusDot, { backgroundColor: profile?.isActive ? colors.success : colors.danger }]} />
                <Text style={[styles.statusChipText, { color: profile?.isActive ? colors.success : colors.danger }]}>
                  {profile?.isActive ? "Active" : "Inactive"}
                </Text>
              </View>
            </View>

            <View style={styles.summaryGrid}>
              <View style={[styles.summaryTile, { backgroundColor: colors.cardMuted, borderColor: colors.border }]}>
                <Text style={[styles.summaryLabel, { color: colors.subText }]}>{isStudent || isSecurity ? idLabel : "Account"}</Text>
                <Text style={[styles.summaryValue, { color: colors.text }]} numberOfLines={1}>
                  {isStudent || isSecurity ? displayValue(primaryId) : displayValue(profile?.role)}
                </Text>
              </View>
              <View style={[styles.summaryTile, { backgroundColor: colors.cardMuted, borderColor: colors.border }]}>
                <Text style={[styles.summaryLabel, { color: colors.subText }]}>{isStudent ? "Academic" : locationLabel}</Text>
                <Text style={[styles.summaryValue, { color: colors.text }]} numberOfLines={1}>
                  {academicLabel}
                </Text>
              </View>
              <View style={[styles.summaryTile, { backgroundColor: colors.cardMuted, borderColor: colors.border }]}>
                <Text style={[styles.summaryLabel, { color: colors.subText }]}>Profile</Text>
                <Text style={[styles.summaryValue, { color: colors.text }]}>{profileCompletion}% complete</Text>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.content}>
          <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.sectionHeader}>
              <View>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>Profile Details</Text>
                <Text style={[styles.sectionCaption, { color: colors.subText }]}>
                  {editing ? "Update visible account information." : "Core identity and contact records."}
                </Text>
              </View>
              <TouchableOpacity
                style={[
                  styles.primaryAction,
                  {
                    backgroundColor: editing ? colors.successSoft : colors.primarySoft,
                    borderColor: editing ? colors.success : colors.primary,
                  },
                ]}
                onPress={() => (editing ? handleSave() : setEditing(true))}
                disabled={saving}
              >
                <Ionicons name={editing ? "checkmark" : "pencil"} size={18} color={editing ? colors.success : colors.primary} />
                <Text style={[styles.primaryActionText, { color: editing ? colors.success : colors.primary }]}>
                  {editing ? (saving ? "Saving" : "Save") : "Edit"}
                </Text>
              </TouchableOpacity>
            </View>

            {editing ? (
              <>
                <EditableTextField
                  label="Full Name"
                  value={profile?.name}
                  onChangeText={(value) => updateProfile("name", value)}
                  colors={colors}
                />
                <EditableTextField
                  label="Email"
                  value={profile?.email}
                  onChangeText={(value) => updateProfile("email", value)}
                  colors={colors}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
                <View style={[styles.pickerContainer, { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder }]}>
                  <Ionicons name="person-circle-outline" size={20} color={colors.subText} style={styles.inputIcon} />
                  <Picker
                    selectedValue={GenderMap[profile?.gender] || ""}
                    style={[styles.picker, { color: colors.inputText }]}
                    onValueChange={(value) => updateProfile("gender", GenderReverseMap[value] || value)}
                  >
                    <Picker.Item label="Select Gender" value="" />
                    {genders.map((gender) => (
                      <Picker.Item key={gender} label={gender} value={gender} />
                    ))}
                  </Picker>
                </View>
                {isStudent || isSecurity ? (
                  <EditableTextField
                    label={idLabel}
                    value={primaryId}
                    onChangeText={(value) => updateProfile(isSecurity ? "guardId" : "studentId", value)}
                    colors={colors}
                    autoCapitalize="characters"
                  />
                ) : null}
                <EditableTextField
                  label="Phone Number"
                  value={profile?.phoneNumber}
                  onChangeText={(value) => updateProfile("phoneNumber", value)}
                  colors={colors}
                  keyboardType="phone-pad"
                />

                {isStudent ? (
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
                ) : null}

                {!isScopedAdmin && !isSecurity ? (
                  <EditableTextField
                    label="Room Number"
                    value={profile?.roomNumber}
                    onChangeText={(value) => updateProfile("roomNumber", value)}
                    colors={colors}
                  />
                ) : null}
              </>
            ) : (
              <>
                <InfoRow icon="person-outline" label="Full Name" value={profile?.name} colors={colors} />
                <InfoRow icon="mail-outline" label="Email" value={profile?.email} colors={colors} />
                <InfoRow icon="person-circle-outline" label="Gender" value={GenderMap[profile?.gender] || profile?.gender} colors={colors} />
                {(isStudent || isSecurity) ? <InfoRow icon="card-outline" label={idLabel} value={primaryId} colors={colors} /> : null}
                <InfoRow icon="call-outline" label="Phone Number" value={profile?.phoneNumber} colors={colors} />
                {isStudent ? (
                  <>
                    <InfoRow icon="library-outline" label="Department" value={DepartmentMap[profile?.department] || profile?.department} colors={colors} />
                    <InfoRow icon="calendar-outline" label="Year" value={AcademicYearMap[profile?.year] || profile?.year} colors={colors} />
                    <InfoRow icon="home-outline" label="Hostel" value={profile?.hostel} colors={colors} />
                    <InfoRow icon="bed-outline" label="Room Number" value={profile?.roomNumber} colors={colors} />
                  </>
                ) : (
                  <InfoRow icon={isSecurity ? "shield-outline" : "business-outline"} label={locationLabel} value={locationValue} colors={colors} />
                )}
              </>
            )}
          </View>

          <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.sectionHeader}>
              <View>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>Password</Text>
                <Text style={[styles.sectionCaption, { color: colors.subText }]}>
                  {isStudent ? "Students verify password updates with email OTP." : "Update credentials with your current password."}
                </Text>
              </View>
              <View style={[styles.lockBadge, { backgroundColor: colors.warningSoft }]}>
                <Ionicons name="lock-closed-outline" size={18} color={colors.warning} />
              </View>
            </View>

            {!isStudent ? (
              <PasswordField
                label="Current Password"
                value={currentPassword}
                onChangeText={setCurrentPassword}
                visible={showCurrent}
                onToggle={() => setShowCurrent((value) => !value)}
                colors={colors}
                placeholder="Enter current password"
              />
            ) : null}

            <PasswordField
              label="New Password"
              value={newPassword}
              onChangeText={setNewPassword}
              visible={showNew}
              onToggle={() => setShowNew((value) => !value)}
              colors={colors}
              placeholder="Enter new password"
            />

            <PasswordField
              label="Confirm New Password"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              visible={showConfirm}
              onToggle={() => setShowConfirm((value) => !value)}
              colors={colors}
              placeholder="Confirm new password"
            />

            <View style={[styles.passwordHintBox, { backgroundColor: colors.infoSoft }]}>
              <Ionicons name={isStudent ? "mail-outline" : "information-circle-outline"} size={18} color={colors.info} />
              <Text style={[styles.passwordHint, { color: colors.text }]}>
                {isStudent
                  ? "An OTP will be sent to your registered email before the password changes."
                  : "Use 8-64 characters with uppercase, lowercase, number, and special character."}
              </Text>
            </View>

            <View style={styles.passwordActions}>
              <TouchableOpacity onPress={resetPasswordFields} style={[styles.secondaryButton, { borderColor: colors.border }]}>
                <Text style={[styles.secondaryButtonText, { color: colors.text }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={isStudent ? handleStudentPasswordSubmit : handleLegacyPasswordUpdate}
                style={[styles.solidButton, { backgroundColor: colors.primary }]}
                disabled={pwdSaving}
              >
                <Ionicons name="key-outline" size={18} color={colors.buttonTextOnPrimary || COLORS.white} />
                <Text style={[styles.solidButtonText, { color: colors.buttonTextOnPrimary || COLORS.white }]}>
                  {pwdSaving ? (isStudent ? "Sending OTP" : "Updating") : isStudent ? "Send OTP" : "Update"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Account Status</Text>
            </View>

            <View style={styles.accountGrid}>
              <View style={[styles.accountTile, { backgroundColor: colors.cardMuted, borderColor: colors.border }]}>
                <Ionicons name="pulse-outline" size={20} color={profile?.isActive ? colors.success : colors.danger} />
                <Text style={[styles.accountTileLabel, { color: colors.subText }]}>State</Text>
                <Text style={[styles.accountTileValue, { color: colors.text }]}>{profile?.isActive ? "Active" : "Inactive"}</Text>
              </View>
              <View style={[styles.accountTile, { backgroundColor: colors.cardMuted, borderColor: colors.border }]}>
                <Ionicons name="time-outline" size={20} color={colors.primary} />
                <Text style={[styles.accountTileLabel, { color: colors.subText }]}>Member Since</Text>
                <Text style={[styles.accountTileValue, { color: colors.text }]}>{formatDate(profile?.createdAt)}</Text>
              </View>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.logoutButton, { backgroundColor: colors.dangerSoft, borderColor: colors.danger }]}
            onPress={logout}
          >
            <Ionicons name="log-out-outline" size={20} color={colors.danger} />
            <Text style={[styles.logoutButtonText, { color: colors.danger }]}>Logout</Text>
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
  contentContainer: {
    paddingBottom: 34,
  },
  heroShell: {
    paddingHorizontal: 18,
    paddingTop: 52,
  },
  heroCard: {
    borderRadius: 24,
    borderWidth: 1,
    padding: 18,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.14,
    shadowRadius: 20,
    elevation: 5,
  },
  heroTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  heroActions: {
    flexDirection: "row",
  },
  iconButton: {
    width: 42,
    height: 42,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 8,
  },
  avatar: {
    width: 78,
    height: 78,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: {
    fontSize: 28,
    fontFamily: FONTS.bold,
  },
  userName: {
    fontSize: 28,
    fontFamily: FONTS.bold,
    lineHeight: 34,
    marginTop: 18,
  },
  userEmail: {
    fontSize: SIZES.sm,
    fontFamily: FONTS.regular,
    marginTop: 6,
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 16,
  },
  roleChip: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
    marginRight: 8,
    marginBottom: 8,
    maxWidth: "68%",
  },
  roleChipText: {
    fontSize: SIZES.xs,
    fontFamily: FONTS.bold,
    marginLeft: 6,
  },
  statusChip: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
    marginBottom: 8,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 7,
  },
  statusChipText: {
    fontSize: SIZES.xs,
    fontFamily: FONTS.bold,
  },
  summaryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginTop: 10,
  },
  summaryTile: {
    width: "32%",
    minHeight: 82,
    borderRadius: 16,
    borderWidth: 1,
    padding: 11,
    justifyContent: "space-between",
  },
  summaryLabel: {
    fontSize: 11,
    fontFamily: FONTS.regular,
  },
  summaryValue: {
    fontSize: SIZES.sm,
    fontFamily: FONTS.bold,
    lineHeight: 18,
  },
  content: {
    paddingHorizontal: 18,
    paddingTop: 18,
  },
  section: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 2,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 14,
    gap: 12,
  },
  sectionTitle: {
    fontSize: SIZES.lg,
    fontFamily: FONTS.bold,
  },
  sectionCaption: {
    fontSize: SIZES.xs,
    fontFamily: FONTS.regular,
    marginTop: 4,
    lineHeight: 17,
  },
  primaryAction: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  primaryActionText: {
    fontSize: SIZES.sm,
    fontFamily: FONTS.bold,
    marginLeft: 6,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingVertical: 12,
  },
  infoIcon: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  infoCopy: {
    flex: 1,
    minWidth: 0,
  },
  fieldContainer: {
    marginBottom: 14,
  },
  fieldLabel: {
    fontSize: SIZES.xs,
    fontFamily: FONTS.regular,
    marginBottom: 5,
  },
  fieldValue: {
    fontSize: SIZES.md,
    fontFamily: FONTS.bold,
    lineHeight: 22,
  },
  fieldInput: {
    fontSize: SIZES.md,
    fontFamily: FONTS.regular,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  pickerContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 14,
    marginBottom: 14,
    paddingHorizontal: 12,
    borderWidth: 1,
    minHeight: 52,
  },
  inputIcon: {
    marginRight: SPACING.sm,
  },
  picker: {
    flex: 1,
    minHeight: 52,
  },
  lockBadge: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  passwordInputShell: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 14,
    paddingLeft: 14,
  },
  passwordInput: {
    flex: 1,
    fontSize: SIZES.md,
    fontFamily: FONTS.regular,
    paddingVertical: 12,
  },
  passwordEyeButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  passwordHintBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    borderRadius: 14,
    padding: 12,
    marginTop: 2,
  },
  passwordHint: {
    fontSize: SIZES.sm,
    fontFamily: FONTS.regular,
    lineHeight: 20,
    flex: 1,
    marginLeft: 8,
  },
  passwordActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 16,
  },
  secondaryButton: {
    minHeight: 44,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  secondaryButtonText: {
    fontSize: SIZES.sm,
    fontFamily: FONTS.bold,
  },
  solidButton: {
    flexDirection: "row",
    minHeight: 44,
    borderRadius: 14,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  solidButtonText: {
    fontSize: SIZES.sm,
    fontFamily: FONTS.bold,
    marginLeft: 8,
  },
  accountGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  accountTile: {
    width: "48%",
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    minHeight: 112,
  },
  accountTileLabel: {
    fontSize: SIZES.xs,
    fontFamily: FONTS.regular,
    marginTop: 14,
  },
  accountTileValue: {
    fontSize: SIZES.sm,
    fontFamily: FONTS.bold,
    marginTop: 4,
  },
  logoutButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 15,
    borderRadius: 16,
    borderWidth: 1,
    marginTop: 4,
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
