'use client';

import {
  View,
  Text,
  TouchableOpacity,
  RefreshControl,
  Alert,
  FlatList,
  ImageBackground,
} from 'react-native';
import { useCallback, useState, useEffect, useMemo } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { outpass } from '../services/api';

import styles from '../styles/OutpassStyles';

import LoadingSpinner from '../components/LoadingSpinner';
import OutpassCard from '../components/OutpassCard';
import FilterTabs from '../components/FilterTabs';

export default function OutpassScreen() {
  const { isDarkMode, toggleTheme, colors } = useTheme();
  const navigation = useNavigation();
  const [outpasses, setOutpasses] = useState([]);
  const [filteredOutpasses, setFilteredOutpasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeFilter, setActiveFilter] = useState('all');

  const statusCounts = useMemo(() => {
    const counts = {
      pending: 0,
      approved: 0,
      expired: 0,
      cancelled: 0,
      rejected: 0,
    };

    outpasses.forEach((item) => {
      if (counts[item.status] !== undefined) {
        counts[item.status] += 1;
      }
    });

    return counts;
  }, [outpasses]);

  const filterOptions = useMemo(
    () => [
      { key: 'all', label: 'All', count: outpasses.length },
      { key: 'pending', label: 'Pending', count: statusCounts.pending },
      { key: 'approved', label: 'Active', count: statusCounts.approved },
      { key: 'expired', label: 'Expired', count: statusCounts.expired },
      { key: 'cancelled', label: 'Cancelled', count: statusCounts.cancelled },
      { key: 'rejected', label: 'Rejected', count: statusCounts.rejected },
    ],
    [outpasses.length, statusCounts]
  );

  useEffect(() => {
    loadOutpasses();
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadOutpasses();
    }, [])
  );

  useEffect(() => {
    filterOutpasses();
  }, [outpasses, activeFilter]);

  const loadOutpasses = async () => {
    try {
      const [todayResponse, historyResponse] = await Promise.all([
        outpass.getOutpasses(),
        outpass.getHistory({ limit: 50 }),
      ]);

      let historyList = [];
      if (Array.isArray(historyResponse.data?.outpasses)) {
        historyList = historyResponse.data.outpasses;
      } else if (Array.isArray(historyResponse.data)) {
        historyList = historyResponse.data;
      }

      const todayOutpass = todayResponse.data?.outpass;
      if (todayOutpass) {
        const exists = historyList.some(
          (item) => item._id === todayOutpass._id
        );
        historyList = exists ? historyList : [todayOutpass, ...historyList];
      }

      setOutpasses(historyList);
    } catch (error) {
      console.log('Outpass load error:', error);
      Alert.alert('Error', 'Failed to load outpasses');
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadOutpasses();
    setRefreshing(false);
  };

  const filterOutpasses = () => {
    if (activeFilter === 'all') {
      setFilteredOutpasses(outpasses);
    } else {
      setFilteredOutpasses(
        outpasses.filter((outpass) => outpass.status === activeFilter)
      );
    }
  };

  const handleCreateOutpass = () => {
    navigation.navigate('CreateOutpass');
  };

  const handleOutpassUpdate = (updatedOutpass) => {
    setOutpasses((prev) =>
      prev.map((op) => (op._id === updatedOutpass._id ? updatedOutpass : op))
    );
  };

  const renderOutpassCard = ({ item }) => (
    <OutpassCard outpass={item} onUpdate={handleOutpassUpdate} />
  );

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Ionicons name="document-text-outline" size={64} color="#D1D5DB" />
      <Text style={[styles.emptyTitle, { color: '#F5F5F5' }]}>
        {activeFilter === 'all'
          ? 'No Outpasses Yet'
          : `No ${activeFilter} outpasses`}
      </Text>
      <Text style={[styles.emptyText, { color: '#D1D5DB' }]}>
        {activeFilter === 'all'
          ? 'Create your first outpass request to get started'
          : `You don't have any ${activeFilter} outpasses`}
      </Text>
    </View>
  );

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <ImageBackground
      source={require('../assets/images/iiita2.jpeg')}
      style={{ flex: 1, width: '100%', height: '100%' }}
      blurRadius={3}
      resizeMode="cover"
    >
      <View style={[styles.container, { backgroundColor: 'transparent' }]}>
        <View
          style={[
            styles.header,
            {
              backgroundColor: 'transparent',
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              borderBottomColor: colors.border,
              paddingHorizontal: 14,
              paddingVertical: 10,
            },
          ]}
        >
          <Text
            style={[
              styles.headerTitle,
              {
                color: '#FFFFFF',
                fontWeight: 'bold',
                textAlign: 'left',
                flex: 1,
                marginLeft: 6,
                fontSize: 24,
              },
            ]}
          >
            Outpass Management
          </Text>

          <TouchableOpacity
            onPress={toggleTheme}
            style={{
              padding: 10,
              borderRadius: 14,
              backgroundColor: colors.cardElevated,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <Ionicons
              name={isDarkMode ? 'sunny' : 'moon'}
              size={24}
              color={colors.text}
            />
          </TouchableOpacity>
        </View>

        <FilterTabs
          options={filterOptions}
          activeFilter={activeFilter}
          onFilterChange={setActiveFilter}
        />

        <FlatList
          data={filteredOutpasses}
          renderItem={renderOutpassCard}
          keyExtractor={(item) => item._id}
          contentContainerStyle={styles.listContainer}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          ListEmptyComponent={renderEmptyState}
          showsVerticalScrollIndicator={false}
        />

        <TouchableOpacity
          style={[
            styles.floatingCreateButton,
            {
              backgroundColor: colors.primary,
              shadowColor: colors.shadowStrong,
            },
          ]}
          onPress={handleCreateOutpass}
          activeOpacity={0.85}
        >
          <Ionicons name="add" size={28} color={colors.onPrimary} />
          <Text
            style={[styles.floatingCreateLabel, { color: colors.onPrimary }]}
          >
            Create Outpass
          </Text>
        </TouchableOpacity>
      </View>
    </ImageBackground>
  );
}
