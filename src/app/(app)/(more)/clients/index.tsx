import React, { useState, useCallback, useMemo } from 'react';
import { View, Pressable, FlatList, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { ChevronLeft, UserPlus, Users } from 'lucide-react-native';

import { ScreenWrapper } from '@/components/ui/ScreenWrapper';
import { Text } from '@/components/ui/Text';
import { SearchBar } from '@/components/ui/SearchBar';
import { Chip, ChipGroup } from '@/components/ui/Chip';
import { Badge } from '@/components/ui/Badge';
import { Avatar } from '@/components/ui/Avatar';
import { EmptyState } from '@/components/ui/EmptyState';
import { IconButton } from '@/components/ui/IconButton';
import { useTheme } from '@/hooks/useTheme';
import { useClients } from '@/hooks/useClients';
import type { Client, ClientTag } from '@/types/client';

// ── Sort options ───────────────────────────────────────────────────────────

type SortKey = 'alpha' | 'recent' | 'loyalty' | 'revenue';

interface SortOption {
  key: SortKey;
  label: string;
}

const SORT_OPTIONS: SortOption[] = [
  { key: 'alpha', label: 'Alphabétique' },
  { key: 'recent', label: 'Plus récent' },
  { key: 'loyalty', label: 'Fidélité' },
  { key: 'revenue', label: 'Revenus' },
];

// ── Tag badge helpers ──────────────────────────────────────────────────────

function getTagVariant(
  tag: ClientTag,
): 'accent' | 'info' | 'success' | 'neutral' | 'danger' {
  switch (tag) {
    case 'vip':
      return 'accent';
    case 'corporate':
      return 'info';
    case 'frequent':
      return 'success';
    case 'new':
      return 'neutral';
    case 'flagged':
      return 'danger';
  }
}

function getTagLabel(tag: ClientTag): string {
  switch (tag) {
    case 'vip':
      return 'VIP';
    case 'corporate':
      return 'Corporate';
    case 'frequent':
      return 'Fréquent';
    case 'new':
      return 'Nouveau';
    case 'flagged':
      return 'Signalé';
  }
}

// ── Animated wrapper ───────────────────────────────────────────────────────

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

// ── Client Card ────────────────────────────────────────────────────────────

interface ClientCardProps {
  client: Client;
  index: number;
  onPress: () => void;
}

function ClientCard({ client, index, onPress }: ClientCardProps) {
  const theme = useTheme();

  const handlePress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress();
  }, [onPress]);

  const fullName = `${client.firstName} ${client.lastName}`;

  return (
    <AnimatedPressable
      testID={`clients-client-card-${client.id}`}
      accessibilityRole="button"
      accessibilityLabel={fullName}
      entering={FadeInDown.delay(index * 50).duration(400).springify()}
      onPress={handlePress}
      className="rounded-2xl p-4 mb-3"
      style={{ backgroundColor: theme.surface }}
    >
      <View className="flex-row items-center">
        <Avatar name={fullName} size="md" />
        <View className="flex-1 ml-3">
          <Text variant="titleMedium" numberOfLines={1}>
            {fullName}
          </Text>
          <Text
            variant="bodySmall"
            color={theme.textSecondary}
            numberOfLines={1}
            className="mt-0.5"
          >
            {client.phone || client.email}
          </Text>
        </View>
      </View>

      {/* Stats */}
      <Text
        variant="bodySmall"
        color={theme.textTertiary}
        className="mt-2"
      >
        {client.totalBookings} locations {'\u00B7'} {'\u20AC'}{client.totalSpent}
      </Text>

      {/* Tags row */}
      {client.tags.length > 0 && (
        <View className="flex-row flex-wrap gap-1.5 mt-2">
          {client.tags.map((tag) => (
            <Badge key={tag} variant={getTagVariant(tag)} size="sm">
              {getTagLabel(tag)}
            </Badge>
          ))}
        </View>
      )}
    </AnimatedPressable>
  );
}

// ── Main Screen ────────────────────────────────────────────────────────────

export default function ClientsScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const router = useRouter();

  const { data: clients = [], isLoading, refetch } = useClients();

  const [searchQuery, setSearchQuery] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('alpha');
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    refetch().finally(() => setRefreshing(false));
  }, [refetch]);

  // Filter by search
  const searchFiltered = useMemo(() => {
    if (searchQuery.trim().length === 0) return clients;
    const q = searchQuery.trim().toLowerCase();
    return clients.filter(
      (c) =>
        c.firstName.toLowerCase().includes(q) ||
        c.lastName.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q) ||
        c.phone.includes(searchQuery),
    );
  }, [clients, searchQuery]);

  // Sort
  const sortedClients = useMemo(() => {
    const arr = [...searchFiltered];
    switch (sortKey) {
      case 'alpha':
        return arr.sort((a, b) => a.lastName.localeCompare(b.lastName));
      case 'recent':
        return arr.sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        );
      case 'loyalty':
        return arr.sort((a, b) => b.totalBookings - a.totalBookings);
      case 'revenue':
        return arr.sort((a, b) => b.totalSpent - a.totalSpent);
    }
  }, [searchFiltered, sortKey]);

  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);
  }, []);

  const handleSortPress = useCallback((key: SortKey) => {
    setSortKey(key);
  }, []);

  const handleCardPress = useCallback(
    (id: string) => {
      router.push(`/(app)/(more)/clients/${id}`);
    },
    [router],
  );

  const renderItem = useCallback(
    ({ item, index }: { item: Client; index: number }) => (
      <ClientCard
        client={item}
        index={index}
        onPress={() => handleCardPress(item.id)}
      />
    ),
    [handleCardPress],
  );

  const keyExtractor = useCallback((item: Client) => item.id, []);

  const ListHeaderComponent = useMemo(
    () => (
      <View>
        {/* Header */}
        <View className="flex-row items-center pt-6 pb-4">
          <Pressable
            testID="clients-back-button"
            accessibilityRole="button"
            accessibilityLabel="Retour"
            onPress={() => router.back()}
            className="mr-3"
          >
            <ChevronLeft size={24} color={theme.textPrimary} strokeWidth={2} />
          </Pressable>
          <Text variant="headlineLarge" className="flex-1">
            {t('clients.title', { defaultValue: 'Clients' })}
          </Text>
          <Badge variant="neutral" size="md" className="mr-3">
            {clients.length}
          </Badge>
          <IconButton
            icon={UserPlus}
            variant="filled"
            size="md"
            onPress={() => router.push('/(app)/(more)/clients/new')}
          />
        </View>

        {/* Search */}
        <SearchBar
          placeholder={t(
            'clients.search',
            'Rechercher par nom, email, téléphone...',
          )}
          onSearch={handleSearch}
          className="mb-3"
        />

        {/* Sort Chips */}
        <ChipGroup className="mb-4">
          {SORT_OPTIONS.map((opt) => (
            <Chip
              key={opt.key}
              label={opt.label}
              selected={sortKey === opt.key}
              onPress={() => handleSortPress(opt.key)}
            />
          ))}
        </ChipGroup>
      </View>
    ),
    [t, theme, clients.length, sortKey, handleSearch, handleSortPress, router],
  );

  const ListEmptyComponent = useMemo(
    () => (
      <EmptyState
        icon={Users}
        title={t('clients.emptyTitle', 'Aucun client trouvé')}
        subtitle={t(
          'clients.emptySubtitle',
          'Essayez de modifier votre recherche.',
        )}
        className="mt-16"
      />
    ),
    [t],
  );

  return (
    <ScreenWrapper>
      <FlatList
        data={sortedClients}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        ListHeaderComponent={ListHeaderComponent}
        ListEmptyComponent={ListEmptyComponent}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ flexGrow: 1, paddingBottom: 32 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={theme.accent}
          />
        }
      />
    </ScreenWrapper>
  );
}
