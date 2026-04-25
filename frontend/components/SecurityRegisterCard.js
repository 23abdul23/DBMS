
import React from 'react';
import { View, TextInput, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AllLocations from '../constants/SecuityLocations.json';
import { Picker } from '@react-native-picker/picker';

const LOCATION_OPTIONS = [
  AllLocations.defaultOption,
  ...(Array.isArray(AllLocations.exit_gates) ? AllLocations.exit_gates : []),
  ...(Array.isArray(AllLocations.campus_buildings) ? AllLocations.campus_buildings : []),
  ...(Array.isArray(AllLocations.hostels) ? AllLocations.hostels : []),
]

export default function SecurityRegisterCard({ formData, updateFormData, colors }) {
  return (
    <>
      <View style={[styles.inputContainer, { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder }]}>
        <Ionicons name="mail-outline" size={20} color={colors.subText} style={styles.inputIcon} />
        <TextInput
          style={[styles.input, { color: colors.inputText }]}
          placeholder="Email Address *"
          placeholderTextColor={colors.placeholder}
          value={formData.email}
          onChangeText={value => updateFormData('email', value)}
          keyboardType="email-address"
          autoCapitalize="none"
        />
      </View>
      <View style={[styles.inputContainer, { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder }]}>
        <Ionicons name="school-outline" size={20} color={colors.subText} style={styles.inputIcon} />
        <TextInput
          style={[styles.input, { color: colors.inputText }]}
          placeholder="Guard ID*"
          placeholderTextColor={colors.placeholder}
          value={formData.guardId}
          onChangeText={value => updateFormData('guardId', value)}
          autoCapitalize="characters"
        />
      </View>
      <View style={[styles.inputContainer, { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder }]}>
        <Ionicons name="shield-outline" size={20} color={colors.subText} style={styles.inputIcon} />



        <Picker
          selectedValue={formData.securityPost}
          onValueChange={(value) => updateFormData('securityPost', value)}
          style={{ width: 310, color: colors.inputText }}
        >
          {LOCATION_OPTIONS.map((loc, index) => <Picker.Item key={index} label={loc} value={loc} />)}
        </Picker>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 12,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#eee',
  },
  inputIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    height: 50,
    fontSize: 16,
    color: '#333',
  },
});
