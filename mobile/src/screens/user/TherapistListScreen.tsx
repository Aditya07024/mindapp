import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Text, FlatList, TextInput, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Search, SlidersHorizontal, Star } from 'lucide-react-native';
import API from '../../lib/api';
import { Theme } from '../../theme';
import { TherapistCard, TherapistData } from '../../components/TherapistCard';

interface TherapistListScreenProps {
  navigation: any;
}

export const TherapistListScreen: React.FC<TherapistListScreenProps> = ({ navigation }) => {
  const [search, setSearch] = useState('');
  const [selectedSpecialty, setSelectedSpecialty] = useState('All');
const [selectedLanguage, setSelectedLanguage] = useState('All');
const [selectedGender, setSelectedGender] = useState('All');
const [city, setCity] = useState('');
const [state, setState] = useState('');
const [showFilters, setShowFilters] = useState(false);
const specialtyFilters = [
  'All',
  'CBT',
  'Anxiety',
  'Depression',
  'Relationships',
  'ADHD',
  'Career',
  'Others',
];
const languageFilters = [
  'All',
  'English',
  'Hindi',
  'Spanish',
  'French',
];

const genderFilters = [
  'All',
  'Male',
  'Female',
  'Other',
];
  // Query backend therapists
const { data: remoteTherapists, isLoading } = useQuery({
  queryKey: ['therapistsList'],
  queryFn: () => API.therapist.list(),
  retry: false,
});

const [therapists, setTherapists] = useState<TherapistData[]>([]);

  useEffect(() => {
  console.log("Therapist API Response:", remoteTherapists);

  if (Array.isArray(remoteTherapists)) {
    setTherapists(remoteTherapists);
  } else if (Array.isArray(remoteTherapists?.data)) {
    setTherapists(remoteTherapists.data);
  } else if (Array.isArray(remoteTherapists?.therapists)) {
    setTherapists(remoteTherapists.therapists);
  } else {
    setTherapists([]);
  }
}, [remoteTherapists]);

  // Filter local state based on search query
  const filteredTherapists = therapists.filter((t) => {
  const searchMatch =
  t?.name?.toLowerCase()?.includes(search.toLowerCase()) ||
  t?.specialty?.toLowerCase()?.includes(search.toLowerCase()) ||
  t?.specialties?.some((s: string) =>
    s.toLowerCase().includes(search.toLowerCase())
  );
  const specialtyMatch =
    selectedSpecialty === 'All' ||
    t?.specialty === selectedSpecialty ||
    t?.specialties?.includes(selectedSpecialty);

  const languageMatch =
    selectedLanguage === 'All' ||
       t?.languages?.includes(selectedLanguage);
  const genderMatch =
    selectedGender === 'All' ||
    t?.gender === selectedGender;

  const cityMatch =
    !city ||
    t?.city?.toLowerCase().includes(city.toLowerCase());

  const stateMatch =
    !state ||
    t?.state?.toLowerCase().includes(state.toLowerCase());

  return (
    searchMatch &&
    specialtyMatch &&
    languageMatch &&
    genderMatch &&
    cityMatch &&
    stateMatch
  );
});

  return (
    <View style={styles.container}>
      {/* Marketplace Search Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Find Your Therapist</Text>
        <Text style={styles.subtitle}>Book private sessions with vetted human professionals</Text>

        {/* Input Bar */}
        <View style={styles.searchBar}>
          <Search size={18} color={Theme.colors.outline} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search specialties, names, languages…"
            placeholderTextColor={Theme.colors.outline}
            style={styles.searchInput}
          />
          <TouchableOpacity
  style={styles.filterBtn}
  onPress={() => setShowFilters(!showFilters)}
>
  <SlidersHorizontal size={18} color={Theme.colors.primary} />
</TouchableOpacity>
        </View>
      </View>

      {/* Specialty Filter Chips Row */}
{showFilters && (
  <>
    <View style={styles.advancedFilters}>
      <TextInput
        placeholder="Filter by city (e.g. Mumbai)"
        value={city}
        onChangeText={setCity}
        style={styles.filterInput}
      />

      <TextInput
        placeholder="Filter by state (e.g. Maharashtra)"
        value={state}
        onChangeText={setState}
        style={styles.filterInput}
      />
    </View>

    <View style={{ marginVertical: 6 }}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        {languageFilters.map(language => (
          <TouchableOpacity
            key={language}
            onPress={() => setSelectedLanguage(language)}
            style={[
              styles.chip,
              selectedLanguage === language && styles.chipActive,
            ]}
          >
            <Text
              style={[
                styles.chipText,
                selectedLanguage === language && styles.chipTextActive,
              ]}
            >
              {language}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>

    <View style={{ marginVertical: 6 }}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        {specialtyFilters.map(filter => (
          <TouchableOpacity
            key={filter}
            onPress={() => setSelectedSpecialty(filter)}
            style={[
              styles.chip,
              selectedSpecialty === filter && styles.chipActive,
            ]}
          >
            <Text
              style={[
                styles.chipText,
                selectedSpecialty === filter && styles.chipTextActive,
              ]}
            >
              {filter}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>

    <View style={{ marginVertical: 6 }}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        {genderFilters.map(gender => (
          <TouchableOpacity
            key={gender}
            onPress={() => setSelectedGender(gender)}
            style={[
              styles.chip,
              selectedGender === gender && styles.chipActive,
            ]}
          >
            <Text
              style={[
                styles.chipText,
                selectedGender === gender && styles.chipTextActive,
              ]}
            >
              {gender}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  </>
)}
      {/* Therapist List */}
      {isLoading ? (
        <ActivityIndicator size="large" color={Theme.colors.primary} style={styles.loader} />
      ) : (
        <FlatList
          data={filteredTherapists}
          keyExtractor={(item: any, index) =>
  item?._id?.toString() ||
  item?.id?.toString() ||
  index.toString()
}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <TherapistCard
              therapist={item}
              onPress={() => navigation.navigate('TherapistDetail', { therapist: item })}
              onBookPress={() => navigation.navigate('Booking', { therapist: item })}
            />
          )}
          ListEmptyComponent={
            <View style={styles.emptyView}>
              <Text style={styles.emptyText}>No practitioners matching your search query.</Text>
            </View>
          }
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Theme.colors.background,
  },
  header: {
    backgroundColor: '#FFF',
    paddingHorizontal: Theme.spacing.margin,
    paddingTop: 50,
    paddingBottom: Theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Theme.colors.surfaceHigh,
  },
  title: {
    fontFamily: Theme.fonts.display,
    fontSize: 24,
    color: Theme.colors.primary,
  },
  subtitle: {
    fontFamily: Theme.fonts.body,
    fontSize: 13,
    color: Theme.colors.onSurfaceVariant,
    marginTop: 2,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Theme.colors.surfaceHigh,
    borderRadius: Theme.radius.full,
    paddingHorizontal: 12,
    height: 48,
    backgroundColor: Theme.colors.surfaceLow,
    marginTop: Theme.spacing.sm,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    fontFamily: Theme.fonts.body,
    color: Theme.colors.onSurface,
  },
  filterBtn: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterWrapper: {
    paddingVertical: Theme.spacing.xs,
    backgroundColor: Theme.colors.background,
  },
  filterContent: {
    paddingHorizontal: Theme.spacing.margin,
    gap: 8,
  },
advancedFilters: {
  paddingHorizontal: Theme.spacing.margin,
  paddingVertical: 10,
  gap: 10,
},

filterInput: {
  height: 48,
  borderWidth: 1,
  borderColor: Theme.colors.surfaceHigh,
  borderRadius: 12,
  paddingHorizontal: 12,
  backgroundColor: '#FFF',
  color: Theme.colors.onSurface,
},
  chip: {
    backgroundColor: '#FFF',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: Theme.radius.full,
    borderWidth: 1,
    borderColor: Theme.colors.surfaceHigh,
  },
  chipActive: {
    backgroundColor: Theme.colors.primary,
    borderColor: Theme.colors.primary,
  },
  chipText: {
    fontFamily: Theme.fonts.bodyMedium,
    fontSize: 12,
    color: Theme.colors.onSurfaceVariant,
  },
  chipTextActive: {
    color: '#FFF',
  },
  listContent: {
    padding: Theme.spacing.margin,
    paddingBottom: 60,
  },
  loader: {
    marginTop: Theme.spacing.xl,
  },
  emptyView: {
    alignItems: 'center',
    paddingTop: Theme.spacing.xl,
  },
  emptyText: {
    fontFamily: Theme.fonts.body,
    fontSize: 14,
    color: Theme.colors.textMuted,
  },
});
export default TherapistListScreen;

