'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  ScrollView,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';
import { useTheme } from '../context/ThemeContext';
import LoadingSpinner from '../components/LoadingSpinner';
import { securityAdminAPI } from '../services/api';

const LOCATION_TYPES = [
  { label: 'Campus Building', value: 'CAMPUS_BUILDING' },
  { label: 'Hostel', value: 'HOSTEL' },
  { label: 'Exit Gate', value: 'EXIT_GATE' },
  { label: 'Fixed Location', value: 'FIXED_LOCATION' },
  { label: 'Security Point', value: 'SECURITY_POINT' },
  { label: 'Other', value: 'OTHER' },
];

const normalizeField = (value) => String(value ?? '').trim();

const isValidDecimal = (value) => {
  if (!value) {
    return true;
  }

  return /^-?\d+(\.\d+)?$/.test(value);
};

export default function EditLocationScreen({ navigation, route }) {
  const { colors, isDarkMode } = useTheme();
  const location = route?.params?.location || null;

  const [loading, setLoading] = useState(false);
  const [name, setName] = useState('');
  const [type, setType] = useState('OTHER');
  const [code, setCode] = useState('');
  const [description, setDescription] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    if (!location) {
      return;
    }

    setName(location.name || '');
    setType(location.type || 'OTHER');
    setCode(location.code || '');
    setDescription(location.description || '');
    setLatitude(
      location.latitude === null || location.latitude === undefined
        ? ''
        : String(location.latitude)
    );
    setLongitude(
      location.longitude === null || location.longitude === undefined
        ? ''
        : String(location.longitude)
    );
    setIsActive(Boolean(location.isActive));
  }, [location]);

  const typeOptions = useMemo(() => LOCATION_TYPES, []);

  const handleSave = async () => {
    const trimmedName = normalizeField(name);
    const trimmedCode = normalizeField(code);
    const trimmedDescription = normalizeField(description);
    const trimmedLatitude = normalizeField(latitude);
    const trimmedLongitude = normalizeField(longitude);

    if (!trimmedName || !trimmedCode) {
      Alert.alert('Validation Error', 'Name and code are required.');
      return;
    }

    if (!isValidDecimal(trimmedLatitude) || !isValidDecimal(trimmedLongitude)) {
      Alert.alert(
        'Validation Error',
        'Latitude and longitude must be valid numbers.'
      );
      return;
    }

    if (!location?.id) {
      Alert.alert('Error', 'Missing location details.');
      return;
    }

    try {
      setLoading(true);
      await securityAdminAPI.updateLocation(location.id, {
        name: trimmedName,
        type,
        code: trimmedCode,
        description: trimmedDescription,
        latitude: trimmedLatitude,
        longitude: trimmedLongitude,
        isActive,
      });

      Alert.alert('Saved', 'Location updated successfully.', [
        {
          text: 'OK',
          onPress: () => navigation.goBack(),
        },
      ]);
    } catch (error) {
      Alert.alert(
        'Update Failed',
        error?.response?.data?.message || 'Could not update location.'
      );
    } finally {
      setLoading(false);
    }
  };

  if (loading && !location) {
    return <LoadingSpinner />;
  }

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: colors.background }]}
    >
      <StatusBar
        barStyle={isDarkMode ? 'light-content' : 'dark-content'}
        backgroundColor={colors.background}
      />

      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
        >
          <Ionicons name="arrow-back" size={24} color={colors.primary} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: colors.heading }]}>
            Edit Location
          </Text>
          <Text
            style={[styles.subtitle, { color: colors.subText }]}
            numberOfLines={1}
          >
            {location?.name || 'Location details'}
          </Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View
          style={[
            styles.card,
            {
              backgroundColor: colors.cardElevated,
              borderColor: colors.border,
            },
          ]}
        >
          <Text style={[styles.sectionTitle, { color: colors.heading }]}>
            Location Details
          </Text>

          <Text style={[styles.label, { color: colors.subText }]}>Name</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Location name"
            placeholderTextColor={colors.placeholder}
            style={[
              styles.input,
              {
                color: colors.inputText,
                backgroundColor: colors.inputBackground,
                borderColor: colors.inputBorder,
              },
            ]}
          />

          <Text style={[styles.label, { color: colors.subText }]}>Code</Text>
          <TextInput
            value={code}
            onChangeText={setCode}
            placeholder="Location code"
            placeholderTextColor={colors.placeholder}
            style={[
              styles.input,
              {
                color: colors.inputText,
                backgroundColor: colors.inputBackground,
                borderColor: colors.inputBorder,
              },
            ]}
          />

          <Text style={[styles.label, { color: colors.subText }]}>Type</Text>
          <View
            style={[
              styles.pickerWrap,
              {
                backgroundColor: colors.inputBackground,
                borderColor: colors.inputBorder,
              },
            ]}
          >
            <Picker
              selectedValue={type}
              onValueChange={setType}
              dropdownIconColor={colors.subText}
            >
              {typeOptions.map((option) => (
                <Picker.Item
                  key={option.value}
                  label={option.label}
                  value={option.value}
                />
              ))}
            </Picker>
          </View>

          <Text style={[styles.label, { color: colors.subText }]}>
            Description
          </Text>
          <TextInput
            value={description}
            onChangeText={setDescription}
            placeholder="Optional description"
            placeholderTextColor={colors.placeholder}
            multiline
            style={[
              styles.textArea,
              {
                color: colors.inputText,
                backgroundColor: colors.inputBackground,
                borderColor: colors.inputBorder,
              },
            ]}
          />

          <View style={styles.row}>
            <View style={{ flex: 1, marginRight: 10 }}>
              <Text style={[styles.label, { color: colors.subText }]}>
                Latitude
              </Text>
              <TextInput
                value={latitude}
                onChangeText={setLatitude}
                placeholder="e.g. 28.5450"
                placeholderTextColor={colors.placeholder}
                keyboardType="decimal-pad"
                style={[
                  styles.input,
                  {
                    color: colors.inputText,
                    backgroundColor: colors.inputBackground,
                    borderColor: colors.inputBorder,
                  },
                ]}
              />
            </View>
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={[styles.label, { color: colors.subText }]}>
                Longitude
              </Text>
              <TextInput
                value={longitude}
                onChangeText={setLongitude}
                placeholder="e.g. 77.1920"
                placeholderTextColor={colors.placeholder}
                keyboardType="decimal-pad"
                style={[
                  styles.input,
                  {
                    color: colors.inputText,
                    backgroundColor: colors.inputBackground,
                    borderColor: colors.inputBorder,
                  },
                ]}
              />
            </View>
          </View>

          <View style={[styles.switchRow, { borderTopColor: colors.border }]}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.label, { color: colors.subText }]}>
                Active
              </Text>
              <Text style={{ color: colors.textMuted, fontSize: 12 }}>
                Inactive locations stay archived but remain editable.
              </Text>
            </View>
            <Switch
              value={isActive}
              onValueChange={setIsActive}
              trackColor={{ false: colors.border, true: colors.primarySoft }}
              thumbColor={isActive ? colors.primary : '#f4f3f4'}
            />
          </View>
        </View>

        <TouchableOpacity
          onPress={handleSave}
          disabled={loading}
          style={[
            styles.saveBtn,
            { backgroundColor: colors.primary, opacity: loading ? 0.7 : 1 },
          ]}
        >
          <Text
            style={[styles.saveText, { color: colors.buttonTextOnPrimary }]}
          >
            {loading ? 'Saving...' : 'Save Changes'}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 22, fontWeight: '700' },
  subtitle: { fontSize: 13, marginTop: 2 },
  content: { padding: 18, paddingBottom: 28 },
  card: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 16,
  },
  sectionTitle: { fontSize: 18, fontWeight: '700', marginBottom: 14 },
  label: { fontSize: 13, fontWeight: '600', marginBottom: 6, marginTop: 12 },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
  textArea: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  pickerWrap: {
    borderWidth: 1,
    borderRadius: 12,
    overflow: 'hidden',
  },
  row: { flexDirection: 'row', marginTop: 4 },
  switchRow: {
    marginTop: 18,
    paddingTop: 16,
    borderTopWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  saveBtn: {
    marginTop: 18,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
  },
  saveText: { fontSize: 16, fontWeight: '700' },
});
