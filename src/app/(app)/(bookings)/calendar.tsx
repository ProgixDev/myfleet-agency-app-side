import React, { useState, useCallback, useMemo } from 'react';
import { View, Pressable, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import {
  AlertTriangle,
  CalendarDays,
  Car,
  ChevronLeft,
  ChevronRight,
  Clock,
  MapPin,
} from 'lucide-react-native';

import { ScreenWrapper } from '@/components/ui/ScreenWrapper';
import { Text } from '@/components/ui/Text';
import { Badge, type BadgeProps } from '@/components/ui/Badge';
import { IconButton } from '@/components/ui/IconButton';
import { useTheme } from '@/hooks/useTheme';
import { useBookingStore } from '@/stores/useBookingStore';
import type { Booking, BookingStatus } from '@/types/booking';

type ViewMode = 'today' | 'upcoming' | 'calendar';
type OperationType = 'pickup' | 'return' | 'inProgress';
type BadgeVariant = NonNullable<BadgeProps['variant']>;

interface CalendarDay {
  date: Date | null;
  dayNumber: number;
  isToday: boolean;
  count: number;
  urgent: boolean;
}

interface OperationItem {
  id: string;
  booking: Booking;
  date: Date;
  time: string;
  type: OperationType;
}

const WEEKDAY_LABELS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

const MONTH_NAMES = [
  'Janvier',
  'F\u00E9vrier',
  'Mars',
  'Avril',
  'Mai',
  'Juin',
  'Juillet',
  'Ao\u00FBt',
  'Septembre',
  'Octobre',
  'Novembre',
  'D\u00E9cembre',
];

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

function toDayKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseDate(date: string): Date {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function isSameDay(a: Date, b: Date): boolean {
  return toDayKey(a) === toDayKey(b);
}

function isWithinBooking(date: Date, booking: Booking): boolean {
  const key = toDayKey(date);
  return key >= booking.startDate && key <= booking.endDate;
}

function formatLongDate(date: Date): string {
  return `${date.getDate()} ${MONTH_NAMES[date.getMonth()]} ${date.getFullYear()}`;
}

function statusBadge(status: BookingStatus): { label: string; variant: BadgeVariant } {
  switch (status) {
    case 'active':
      return { label: 'En cours', variant: 'success' };
    case 'confirmed':
      return { label: 'Confirm\u00E9e', variant: 'info' };
    case 'pending':
      return { label: 'En attente', variant: 'warning' };
    case 'completed':
      return { label: 'Termin\u00E9e', variant: 'neutral' };
    case 'cancelled':
      return { label: 'Annul\u00E9e', variant: 'danger' };
  }
}

function operationMeta(type: OperationType): {
  label: string;
  variant: BadgeVariant;
} {
  switch (type) {
    case 'pickup':
      return { label: 'Départ', variant: 'info' };
    case 'return':
      return { label: 'Retour', variant: 'warning' };
    case 'inProgress':
      return { label: 'En location', variant: 'success' };
  }
}

function hasUrgency(booking: Booking): boolean {
  return Boolean(
    booking.conflict ||
      booking.status === 'pending' ||
      booking.paymentStatus === 'expired' ||
      booking.paymentStatus === 'failed' ||
      booking.paymentStatus === 'pending' ||
      booking.paymentStatus === 'link_sent' ||
      (booking.status === 'confirmed' && !booking.workflow?.contractId),
  );
}

function getUrgencyLabels(booking: Booking): string[] {
  const labels: string[] = [];
  if (booking.conflict) labels.push('Conflit');
  if (booking.status === 'pending') labels.push('Validation');
  if (
    booking.paymentStatus === 'expired' ||
    booking.paymentStatus === 'failed' ||
    booking.paymentStatus === 'pending' ||
    booking.paymentStatus === 'link_sent'
  ) {
    labels.push('Paiement');
  }
  if (booking.status === 'confirmed' && !booking.workflow?.contractId) {
    labels.push('Contrat');
  }
  return labels;
}

function operationsForDate(date: Date, bookings: Booking[]): OperationItem[] {
  const key = toDayKey(date);

  return bookings
    .filter((booking) => booking.status !== 'cancelled' && isWithinBooking(date, booking))
    .flatMap((booking) => {
      const operations: OperationItem[] = [];

      if (booking.startDate === key) {
        operations.push({
          id: `${booking.id}-pickup`,
          booking,
          date,
          time: booking.pickupTime,
          type: 'pickup',
        });
      }

      if (booking.endDate === key) {
        operations.push({
          id: `${booking.id}-return`,
          booking,
          date,
          time: booking.returnTime,
          type: 'return',
        });
      }

      if (booking.startDate !== key && booking.endDate !== key) {
        operations.push({
          id: `${booking.id}-active`,
          booking,
          date,
          time: '--:--',
          type: 'inProgress',
        });
      }

      return operations;
    })
    .sort((a, b) => {
      if (a.time === '--:--') return 1;
      if (b.time === '--:--') return -1;
      return a.time.localeCompare(b.time);
    });
}

function upcomingOperations(today: Date, bookings: Booking[]): OperationItem[] {
  const todayKey = toDayKey(today);

  return bookings
    .filter((booking) => booking.status !== 'cancelled')
    .flatMap((booking) => {
      const operations: OperationItem[] = [];
      if (booking.startDate >= todayKey) {
        operations.push({
          id: `${booking.id}-pickup`,
          booking,
          date: parseDate(booking.startDate),
          time: booking.pickupTime,
          type: 'pickup',
        });
      }
      if (booking.endDate >= todayKey) {
        operations.push({
          id: `${booking.id}-return`,
          booking,
          date: parseDate(booking.endDate),
          time: booking.returnTime,
          type: 'return',
        });
      }
      return operations;
    })
    .sort((a, b) => {
      const dateDiff = a.date.getTime() - b.date.getTime();
      if (dateDiff !== 0) return dateDiff;
      return a.time.localeCompare(b.time);
    });
}

function generateCalendarDays(
  year: number,
  month: number,
  bookings: Booking[],
  today: Date,
): CalendarDay[] {
  const firstOfMonth = new Date(year, month, 1);
  const startDow = (firstOfMonth.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const days: CalendarDay[] = [];

  for (let i = 0; i < startDow; i++) {
    days.push({ date: null, dayNumber: 0, isToday: false, count: 0, urgent: false });
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, month, d);
    const dayBookings = bookings.filter(
      (booking) => booking.status !== 'cancelled' && isWithinBooking(date, booking),
    );
    days.push({
      date,
      dayNumber: d,
      isToday: isSameDay(date, today),
      count: dayBookings.length,
      urgent: dayBookings.some(hasUrgency),
    });
  }

  return days;
}

function SegmentControl({
  mode,
  onChange,
}: {
  mode: ViewMode;
  onChange: (mode: ViewMode) => void;
}) {
  const { t } = useTranslation();
  const theme = useTheme();
  const items: { key: ViewMode; label: string }[] = [
    { key: 'today', label: t('bookings.calendar.tabs.today', 'Aujourd\u2019hui') },
    { key: 'upcoming', label: t('bookings.calendar.tabs.upcoming', '\u00C0 venir') },
    { key: 'calendar', label: t('bookings.calendar.tabs.calendar', 'Calendrier') },
  ];

  return (
    <View
      className="flex-row p-1 rounded-full mb-4"
      style={{ backgroundColor: theme.surfaceSecondary }}
    >
      {items.map((item) => {
        const selected = mode === item.key;
        return (
          <Pressable
            key={item.key}
            onPress={() => onChange(item.key)}
            className="flex-1 items-center justify-center rounded-full"
            style={{
              minHeight: 38,
              backgroundColor: selected ? theme.accent : 'transparent',
            }}
          >
            <Text
              variant="labelSmall"
              color={selected ? '#FFFFFF' : theme.textSecondary}
              numberOfLines={1}
            >
              {item.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function OperationCard({
  operation,
  index,
  onPress,
}: {
  operation: OperationItem;
  index: number;
  onPress: () => void;
}) {
  const theme = useTheme();
  const meta = operationMeta(operation.type);
  const bookingStatus = statusBadge(operation.booking.status);
  const urgencyLabels = getUrgencyLabels(operation.booking);
  const isReturn = operation.type === 'return';
  const location = isReturn
    ? operation.booking.returnLocation
    : operation.booking.pickupLocation;

  const handlePress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress();
  }, [onPress]);

  return (
    <AnimatedPressable
      entering={FadeInDown.delay(index * 45).duration(300).springify()}
      onPress={handlePress}
      className="rounded-2xl overflow-hidden mb-3"
      style={{ backgroundColor: theme.surface }}
    >
      <View className="flex-row">
        <View
          style={{
            width: 4,
            backgroundColor: hasUrgency(operation.booking)
              ? theme.danger
              : meta.variant === 'warning'
                ? theme.warning
                : theme.accent,
          }}
        />
        <View className="flex-1 p-4">
          <View className="flex-row items-start justify-between gap-3">
            <View className="flex-row items-center gap-3 flex-1">
              <View
                className="rounded-xl items-center justify-center"
                style={{
                  width: 46,
                  height: 46,
                  backgroundColor: theme.surfaceTertiary,
                }}
              >
                <Car size={21} color={theme.textSecondary} />
              </View>
              <View className="flex-1">
                <View className="flex-row items-center gap-2 mb-1">
                  <Text variant="titleMedium">{operation.time}</Text>
                  <Badge variant={meta.variant} size="sm">
                    {meta.label}
                  </Badge>
                </View>
                <Text variant="titleSmall" numberOfLines={1}>
                  {operation.booking.vehicleName}
                </Text>
                <Text variant="bodySmall" color={theme.textSecondary} numberOfLines={1}>
                  {operation.booking.clientName}
                </Text>
              </View>
            </View>
            {hasUrgency(operation.booking) && (
              <AlertTriangle size={18} color={theme.danger} />
            )}
          </View>

          <View className="flex-row items-center gap-2 mt-3">
            <MapPin size={14} color={theme.textTertiary} />
            <Text variant="bodySmall" color={theme.textTertiary} numberOfLines={1}>
              {location}
            </Text>
          </View>

          <View className="flex-row flex-wrap mt-3" style={{ gap: 6 }}>
            <Badge variant={bookingStatus.variant} size="sm">
              {bookingStatus.label}
            </Badge>
            {urgencyLabels.map((label) => (
              <Badge key={label} variant="danger" size="sm">
                {label}
              </Badge>
            ))}
          </View>
        </View>
      </View>
    </AnimatedPressable>
  );
}

function GroupedOperations({
  operations,
  emptyLabel,
  onBookingPress,
  showDateHeaders = false,
}: {
  operations: OperationItem[];
  emptyLabel: string;
  onBookingPress: (id: string) => void;
  showDateHeaders?: boolean;
}) {
  const theme = useTheme();
  let lastKey = '';

  if (operations.length === 0) {
    return (
      <View className="rounded-2xl p-5 items-center" style={{ backgroundColor: theme.surface }}>
        <CalendarDays size={24} color={theme.textTertiary} />
        <Text variant="bodySmall" color={theme.textTertiary} className="mt-2">
          {emptyLabel}
        </Text>
      </View>
    );
  }

  return (
    <View>
      {operations.map((operation, index) => {
        const key = toDayKey(operation.date);
        const showHeader = showDateHeaders && key !== lastKey;
        lastKey = key;

        return (
          <View key={operation.id}>
            {showHeader && (
              <View className="flex-row items-center mt-2 mb-3">
                <Text variant="titleMedium">{formatLongDate(operation.date)}</Text>
                <Badge variant="neutral" size="sm" className="ml-2">
                  {operations.filter((item) => toDayKey(item.date) === key).length}
                </Badge>
              </View>
            )}
            <OperationCard
              operation={operation}
              index={index}
              onPress={() => onBookingPress(operation.booking.id)}
            />
          </View>
        );
      })}
    </View>
  );
}

export default function CalendarScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const theme = useTheme();
  const bookings = useBookingStore((s) => s.bookings);

  const today = useMemo(() => new Date(), []);
  const [mode, setMode] = useState<ViewMode>('today');
  const [currentMonth, setCurrentMonth] = useState<Date>(
    () => new Date(today.getFullYear(), today.getMonth(), 1),
  );
  const [selectedDate, setSelectedDate] = useState<Date>(today);

  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();

  const todayOperations = useMemo(
    () => operationsForDate(today, bookings),
    [bookings, today],
  );

  const upcoming = useMemo(
    () => upcomingOperations(today, bookings).slice(0, 60),
    [bookings, today],
  );

  const calendarDays = useMemo(
    () => generateCalendarDays(year, month, bookings, today),
    [year, month, bookings, today],
  );

  const selectedDayOperations = useMemo(
    () => operationsForDate(selectedDate, bookings),
    [bookings, selectedDate],
  );

  const todayUrgentCount = useMemo(
    () => todayOperations.filter((operation) => hasUrgency(operation.booking)).length,
    [todayOperations],
  );

  const goToPrevMonth = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setCurrentMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  }, []);

  const goToNextMonth = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setCurrentMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  }, []);

  const handleDayPress = useCallback((date: Date) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedDate(date);
  }, []);

  const handleBookingPress = useCallback(
    (id: string) => {
      router.push(`/(app)/(bookings)/${id}` as never);
    },
    [router],
  );

  const handleModeChange = useCallback((nextMode: ViewMode) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setMode(nextMode);
  }, []);

  return (
    <ScreenWrapper scroll={false}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ flexGrow: 1, paddingBottom: 32 }}
      >
        <View className="flex-row items-center pt-4 pb-4">
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.back();
            }}
            className="mr-3 p-1"
          >
            <ChevronLeft size={24} color={theme.textPrimary} />
          </Pressable>
          <View className="flex-1">
            <Text variant="headlineLarge">
              {t('bookings.calendar.agendaTitle', 'R\u00E9servations')}
            </Text>
            <Text variant="bodySmall" color={theme.textSecondary}>
              {t(
                'bookings.calendar.agendaSubtitle',
                'Pickups, retours et actions \u00E0 traiter',
              )}
            </Text>
          </View>
        </View>

        <SegmentControl mode={mode} onChange={handleModeChange} />

        {mode === 'today' && (
          <Animated.View entering={FadeInDown.duration(300)}>
            <View className="flex-row mb-4" style={{ gap: 10 }}>
              <View
                className="flex-1 rounded-2xl p-4"
                style={{ backgroundColor: theme.surface }}
              >
                <Text variant="bodySmall" color={theme.textTertiary}>
                  {t('bookings.calendar.todayOps', 'Op\u00E9rations')}
                </Text>
                <Text variant="headlineMedium" className="mt-1">
                  {todayOperations.length}
                </Text>
              </View>
              <View
                className="flex-1 rounded-2xl p-4"
                style={{ backgroundColor: todayUrgentCount > 0 ? theme.dangerSoft : theme.surface }}
              >
                <Text
                  variant="bodySmall"
                  color={todayUrgentCount > 0 ? theme.danger : theme.textTertiary}
                >
                  {t('bookings.calendar.toHandle', '\u00C0 traiter')}
                </Text>
                <Text
                  variant="headlineMedium"
                  color={todayUrgentCount > 0 ? theme.danger : theme.textPrimary}
                  className="mt-1"
                >
                  {todayUrgentCount}
                </Text>
              </View>
            </View>

            <View className="flex-row items-center mb-3">
              <Clock size={16} color={theme.textSecondary} />
              <Text variant="titleMedium" className="ml-2">
                {formatLongDate(today)}
              </Text>
            </View>

            <GroupedOperations
              operations={todayOperations}
              emptyLabel={t(
                'bookings.calendar.noTodayBookings',
                'Aucune op\u00E9ration pr\u00E9vue aujourd\u2019hui',
              )}
              onBookingPress={handleBookingPress}
            />
          </Animated.View>
        )}

        {mode === 'upcoming' && (
          <Animated.View entering={FadeInDown.duration(300)}>
            <GroupedOperations
              operations={upcoming}
              emptyLabel={t(
                'bookings.calendar.noUpcomingBookings',
                'Aucune r\u00E9servation \u00E0 venir',
              )}
              onBookingPress={handleBookingPress}
              showDateHeaders
            />
          </Animated.View>
        )}

        {mode === 'calendar' && (
          <Animated.View entering={FadeInDown.duration(300)}>
            <View className="flex-row items-center justify-between mb-4">
              <IconButton
                icon={ChevronLeft}
                variant="ghost"
                size="sm"
                onPress={goToPrevMonth}
              />
              <Text variant="titleMedium">
                {MONTH_NAMES[month]} {year}
              </Text>
              <IconButton
                icon={ChevronRight}
                variant="ghost"
                size="sm"
                onPress={goToNextMonth}
              />
            </View>

            <View className="flex-row mb-2">
              {WEEKDAY_LABELS.map((label) => (
                <View key={label} className="flex-1 items-center">
                  <Text variant="labelSmall" color={theme.textTertiary}>
                    {label}
                  </Text>
                </View>
              ))}
            </View>

            <View className="flex-row flex-wrap">
              {calendarDays.map((day, idx) => {
                if (day.date === null) {
                  return <View key={`empty-${idx}`} style={{ width: '14.285%', height: 58 }} />;
                }

                const selected = isSameDay(day.date, selectedDate);
                return (
                  <Pressable
                    key={`day-${day.dayNumber}`}
                    onPress={() => handleDayPress(day.date as Date)}
                    style={{ width: '14.285%', height: 58 }}
                    className="items-center justify-center"
                  >
                    <View
                      className="items-center justify-center"
                      style={{
                        width: 42,
                        height: 42,
                        borderRadius: 16,
                        backgroundColor: selected
                          ? theme.accent
                          : day.isToday
                            ? theme.accentSoft
                            : 'transparent',
                        borderWidth: day.urgent && !selected ? 1 : 0,
                        borderColor: day.urgent ? theme.danger : 'transparent',
                      }}
                    >
                      <Text
                        variant="bodySmall"
                        color={
                          selected
                            ? '#FFFFFF'
                            : day.isToday
                              ? theme.accent
                              : theme.textPrimary
                        }
                      >
                        {day.dayNumber}
                      </Text>
                      {day.count > 0 && (
                        <View
                          className="rounded-full items-center justify-center"
                          style={{
                            minWidth: 18,
                            height: 18,
                            paddingHorizontal: 4,
                            marginTop: 2,
                            backgroundColor: day.urgent
                              ? theme.danger
                              : selected
                                ? 'rgba(255,255,255,0.22)'
                                : theme.surfaceSecondary,
                          }}
                        >
                          <Text
                            variant="labelSmall"
                            color={day.urgent || selected ? '#FFFFFF' : theme.textSecondary}
                            style={{ fontSize: 10 }}
                          >
                            {day.count}
                          </Text>
                        </View>
                      )}
                    </View>
                  </Pressable>
                );
              })}
            </View>

            <View className="mt-6">
              <View className="flex-row items-center mb-3">
                <Text variant="titleMedium">{formatLongDate(selectedDate)}</Text>
                <Badge variant="accent" size="sm" className="ml-2">
                  {selectedDayOperations.length}
                </Badge>
              </View>
              <GroupedOperations
                operations={selectedDayOperations}
                emptyLabel={t(
                  'bookings.calendar.noBookings',
                  'Aucune r\u00E9servation pour ce jour',
                )}
                onBookingPress={handleBookingPress}
              />
            </View>
          </Animated.View>
        )}
      </ScrollView>
    </ScreenWrapper>
  );
}
