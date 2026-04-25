"use client"

import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from "react-native"
import { useState } from "react"
import { Ionicons } from "@expo/vector-icons"
import { useTheme } from "../context/ThemeContext"
import DateTimePicker from "@react-native-community/datetimepicker"
import { outpass } from "../services/api"
import {useAuth} from "../context/AuthContext"
import { COLORS, FONTS, OUTPASS_REQUEST_TYPE, SIZES, SPACING } from "../utils/constants"
import LoadingSpinner from "../components/LoadingSpinner"

import styles from "../styles/CreateOutpassStyles"

export default function CreateOutpassScreen({ navigation }) {
  const { isDarkMode, toggleTheme, colors } = useTheme();
  const { user, logout } = useAuth()
  const [formData, setFormData] = useState({
    purpose: "Going out",
    destination: "Cafe",
    fromDate: new Date(),
    fromTime: new Date(),
    toDate: new Date(),
    toTime: new Date(),
    // fromDate: new Date("2025-08-01"),          // 1st Aug 2025
    // fromTime: new Date("2025-08-01T09:30:00"), // 9:30 AM
    // toDate: new Date("2025-08-05"),            // 5th Aug 2025
    // toTime: new Date("2025-08-05T18:00:00"),
    emergencyName: "Abdul",
    emergencyContact: "8909627048",
    remarks: "Nothing",
    longVisit: false,
  })
  const [showDatePicker, setShowDatePicker] = useState(null)
  const [loading, setLoading] = useState(false)

  const updateFormData = (key, value) => {
    setFormData((prev) => ({ ...prev, [key]: value }))
  }

  const handleDateChange = (event, selectedDate, field) => {
    setShowDatePicker(null)
    if (selectedDate) {
      updateFormData(field, selectedDate)
    }
  }

  const validateForm = () => {
    const { purpose, destination, fromDate, toDate, fromTime, toTime, emergencyName, emergencyContact, longVisit } =
      formData

    if (!purpose.trim()) {
      Alert.alert("Error", "Please enter the purpose of outpass")
      return false
    }

    if (!destination.trim()) {
      Alert.alert("Error", "Please enter the destination")
      return false
    }

    if (!emergencyName.trim()) {
      Alert.alert("Error", "Please enter emergency contact name")
      return false
    }

    if (!emergencyContact.trim()) {
      Alert.alert("Error", "Please enter emergency contact number")
      return false
    }

    const departure = new Date(fromDate)
    departure.setHours(fromTime.getHours(), fromTime.getMinutes(), 0, 0)

    const expectedReturn = new Date(toDate)
    expectedReturn.setHours(toTime.getHours(), toTime.getMinutes(), 0, 0)

    if (expectedReturn <= departure) {
      Alert.alert("Error", "Expected return time must be after departure time")
      return false
    }

    if (!longVisit) {
      const isSameDay =
        departure.getFullYear() === expectedReturn.getFullYear() &&
        departure.getMonth() === expectedReturn.getMonth() &&
        departure.getDate() === expectedReturn.getDate()

      if (!isSameDay) {
        Alert.alert("Error", "Regular outpasses must start and end on the same day")
        return false
      }

      if (expectedReturn.getHours() > 22 || (expectedReturn.getHours() === 22 && expectedReturn.getMinutes() > 30)) {
        Alert.alert("Error", "Regular outpasses must end by 10:30 PM")
        return false
      }
    }

    return true
  }

  const handleSubmit = async () => {
    if (!validateForm()) return

    setLoading(true)
    try {
      const payload = {
        ...formData,
        requestType: formData.longVisit ? OUTPASS_REQUEST_TYPE.LONG_VISIT : OUTPASS_REQUEST_TYPE.REGULAR,
      }
      const response = await outpass.createOutpass(payload)
      const createdStatus = response?.data?.outpass?.status || "pending"
      const isLongVisit = response?.data?.outpass?.requestType === OUTPASS_REQUEST_TYPE.LONG_VISIT
      const successMessage =
        isLongVisit
          ? "Long visit request submitted. Please visit the warden physically for approval."
          : createdStatus === "pending"
          ? "Outpass request submitted successfully and is now pending warden approval."
          : `Outpass request submitted with status: ${createdStatus}.`

      Alert.alert("Success", successMessage, [
        { text: "OK", onPress: () => navigation.goBack() },
      ])
    } 
    catch (error) {
      Alert.alert("Error Screen", error.response?.data?.message || "Failed to create outpass")
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (date) => {
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    })
  }

  const formatTime = (date) => {
    return date.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  if (loading) {
    return <LoadingSpinner />
  }

  return (
    <KeyboardAvoidingView style={[styles.container, { backgroundColor: colors.background }]} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <View style={[styles.header, { backgroundColor: colors.card, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]}> 
        
        <TouchableOpacity style={{ padding: 8 }} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>

        <Text style={[styles.headerTitle, { color: colors.text, flex: 1, textAlign: 'center' }]}>Create Outpass</Text>
        
        <TouchableOpacity onPress={toggleTheme} style={{ padding: 8 }}>
          <Ionicons name={isDarkMode ? 'sunny' : 'moon'} size={24} color={colors.text} />
        </TouchableOpacity>

      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.form}>
          <View style={[styles.inputContainer, { backgroundColor: colors.card, borderColor: colors.text }]}> 
            <Text style={[styles.label, { color: colors.text }]}>Purpose *</Text>
            <TextInput
              style={[styles.input, { color: colors.text }]}
              placeholder="e.g., Medical appointment, Family visit"
              placeholderTextColor={colors.subText}
              value={formData.purpose}
              onChangeText={(value) => updateFormData("purpose", value)}
              multiline
            />
          </View>

          <View style={[styles.inputContainer, { backgroundColor: colors.card, borderColor: colors.text }]}> 
            <Text style={[styles.label, { color: colors.text }]}>Destination *</Text>
            <TextInput
              style={[styles.input, { color: colors.text }]}
              placeholder="e.g., City Hospital, Home"
              placeholderTextColor={colors.subText}
              value={formData.destination}
              onChangeText={(value) => updateFormData("destination", value)}
            />
          </View>

          <View style={styles.dateTimeContainer}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Departure</Text>
            <View style={styles.dateTimeRow}>
              <TouchableOpacity style={[styles.dateTimeButton, { backgroundColor: colors.card, borderColor: colors.text }]} onPress={() => setShowDatePicker("fromDate")}> 
                <Ionicons name="calendar-outline" size={20} color={colors.text} />
                <Text style={[styles.dateTimeText, { color: colors.text }]}>{formatDate(formData.fromDate)}</Text>
              </TouchableOpacity>

              <TouchableOpacity style={[styles.dateTimeButton, { backgroundColor: colors.card, borderColor: colors.text }]} onPress={() => setShowDatePicker("fromTime")}> 
                <Ionicons name="time-outline" size={20} color={colors.text} />
                <Text style={[styles.dateTimeText, { color: colors.text }]}>{formatTime(formData.fromTime)}</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.dateTimeContainer}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Return</Text>
            <View style={styles.dateTimeRow}>
              <TouchableOpacity style={[styles.dateTimeButton, { backgroundColor: colors.card, borderColor: colors.text }]} onPress={() => setShowDatePicker("toDate")}> 
                <Ionicons name="calendar-outline" size={20} color={colors.text} />
                <Text style={[styles.dateTimeText, { color: colors.text }]}>{formatDate(formData.toDate)}</Text>
              </TouchableOpacity>

              <TouchableOpacity style={[styles.dateTimeButton, { backgroundColor: colors.card, borderColor: colors.text }]} onPress={() => setShowDatePicker("toTime")}> 
                <Ionicons name="time-outline" size={20} color={colors.text} />
                <Text style={[styles.dateTimeText, { color: colors.text }]}>{formatTime(formData.toTime)}</Text>
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity
            style={[
              localStyles.longVisitToggle,
              { backgroundColor: colors.card, borderColor: formData.longVisit ? COLORS.warning : colors.text },
            ]}
            onPress={() => updateFormData("longVisit", !formData.longVisit)}
            activeOpacity={0.85}
          >
            <Ionicons
              name={formData.longVisit ? "checkbox" : "square-outline"}
              size={22}
              color={formData.longVisit ? COLORS.warning : colors.text}
            />
            <View style={localStyles.longVisitCopy}>
              <Text style={[localStyles.longVisitTitle, { color: colors.text }]}>Long Visit (Home / Relative Visit)</Text>
              <Text style={[localStyles.longVisitText, { color: colors.subText }]}>
                Use this when you will not return on the same day.
              </Text>
            </View>
          </TouchableOpacity>

          {formData.longVisit ? (
            <View style={[localStyles.noticeCard, { backgroundColor: "#fff7ed", borderColor: "#fdba74" }]}>
              <Text style={localStyles.noticeTitle}>Physical Warden Approval Required</Text>
              <Text style={localStyles.noticeText}>
                This outpass will be granted only by physically visiting the warden. Same-day and 10:30 PM rules do not
                apply to this request.
              </Text>
            </View>
          ) : (
            <View style={[localStyles.noticeCard, { backgroundColor: "#eff6ff", borderColor: "#93c5fd" }]}>
              <Text style={[localStyles.noticeTitle, { color: "#1d4ed8" }]}>Regular Outpass Rule</Text>
              <Text style={[localStyles.noticeText, { color: "#1e3a8a" }]}>
                Regular outpasses must start and end on the same day and return by 10:30 PM.
              </Text>
            </View>
          )}

          <View style={[styles.inputContainer, { backgroundColor: colors.card, borderColor: colors.text }]}> 
            <Text style={[styles.label, { color: colors.text }]}>Emergency Name *</Text>
            <TextInput
              style={[styles.input, { color: colors.text }]}
              placeholder="Person to contact in emergency"
              placeholderTextColor={colors.subText}
              value={formData.emergencyName}
              onChangeText={(value) => updateFormData("emergencyName", value)}
              keyboardType="phone-pad"
            />
          </View>

          <View style={[styles.inputContainer, { backgroundColor: colors.card, borderColor: colors.text }]}> 
            <Text style={[styles.label, { color: colors.text }]}>Emergency Contact *</Text>
            <TextInput
              style={[styles.input, { color: colors.text }]}
              placeholder="Phone number to contact in emergency"
              placeholderTextColor={colors.subText}
              value={formData.emergencyContact}
              onChangeText={(value) => updateFormData("emergencyContact", value)}
              keyboardType="phone-pad"
            />
          </View>

          <View style={[styles.inputContainer, { backgroundColor: colors.card, borderColor: colors.text }]}> 
            <Text style={[styles.label, { color: colors.text }]}>Additional Remarks</Text>
            <TextInput
              style={[styles.input, styles.textArea, { color: colors.text }]}
              placeholder="Any additional information..."
              placeholderTextColor={colors.subText}
              value={formData.remarks}
              onChangeText={(value) => updateFormData("remarks", value)}
              multiline
              numberOfLines={2}
            />
          </View>

          <TouchableOpacity style={[styles.submitButton, { backgroundColor: isDarkMode ? '#2196f3' : '#2196f3' }]} onPress={handleSubmit}>
            <Text style={[styles.submitButtonText, { color: colors.text }]}>Submit Request</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {showDatePicker && (
        <DateTimePicker
          value={formData[showDatePicker]}
          mode={showDatePicker.includes("Date") ? "date" : "time"}
          display="default"
          onChange={(event, selectedDate) => handleDateChange(event, selectedDate, showDatePicker)}
          minimumDate={new Date()}
        />
      )}
    </KeyboardAvoidingView>
  )
}

const localStyles = StyleSheet.create({
  longVisitToggle: {
    borderWidth: 1,
    borderRadius: 12,
    padding: SPACING.md,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: SPACING.md,
  },
  longVisitCopy: {
    flex: 1,
    marginLeft: SPACING.sm,
  },
  longVisitTitle: {
    fontSize: SIZES.md,
    fontFamily: FONTS.bold,
  },
  longVisitText: {
    fontSize: SIZES.sm,
    fontFamily: FONTS.regular,
    marginTop: 4,
  },
  noticeCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: SPACING.md,
    marginBottom: SPACING.md,
  },
  noticeTitle: {
    fontSize: SIZES.sm,
    fontFamily: FONTS.bold,
    color: "#9a3412",
  },
  noticeText: {
    fontSize: SIZES.sm,
    fontFamily: FONTS.regular,
    color: "#7c2d12",
    marginTop: 4,
    lineHeight: 20,
  },
})
