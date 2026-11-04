/**
 * PawCare AI — Care History Modal (Lịch sử & Nhật ký chăm sóc thú cưng)
 *
 * Allows pet owners to look back at any date in the past:
 * - What the pet ate (meals, dry food, wet food, treats)
 * - Daily exercise and walks
 * - Medications, supplements & vitamins
 * - Grooming & hygiene records
 * - Daily completion progress with quick category filtering
 */
import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StatusBar as RNStatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { useAppTheme } from '@/presentation/theme';
import { useCareScheduleStore } from '@/presentation/stores/useCareScheduleStore';
import { usePetStore } from '@/presentation/stores/usePetStore';
import { CATEGORY_COLORS, type CareCategory, type CareReminder } from '@/domain/entities/CareReminder';
import { AddCareScheduleModal } from './AddCareScheduleModal';

const DAY_NAMES_VI = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];

function formatDateVi(dateStr: string): string {
  try {
    const [y, m, d] = dateStr.split('-');
    const date = new Date(parseInt(y, 10), parseInt(m, 10) - 1, parseInt(d, 10));
    const dayName = DAY_NAMES_VI[date.getDay()];
    return `${dayName}, ${d}/${m}/${y}`;
  } catch {
    return dateStr;
  }
}

export function CareHistoryModal() {
  const { colors, typography: typo, spacing, radius } = useAppTheme();
  const insets = useSafeAreaInsets();
  const { selectedPet } = usePetStore();

  // Dynamic Island on iPhone extends down to 54pt.
  // React Native Modal presentationStyle="fullScreen" can fail to receive SafeAreaView top inset.
  // We enforce a rock-solid minimum top padding of 62pt to guarantee 0% obstruction by Dynamic Island/Status Bar.
  const headerTopPadding = Platform.OS === 'ios'
    ? Math.max(insets.top, 58) + 4
    : (RNStatusBar.currentHeight || 24) + 12;
  const bottomPadding = Math.max(insets.bottom, 20) + 16;

  const {
    isCareHistoryModalOpen,
    closeCareHistoryModal,
    selectedHistoryDate,
    setSelectedHistoryDate,
    historyReminders,
    allHistoryRecords,
    isHistoryLoading,
    toggleReminder,
    deleteReminder,
  } = useCareScheduleStore();

  const [filterCategory, setFilterCategory] = useState<CareCategory | 'all'>('all');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // Generate 14-day strip (7 days ago to today + 3 days ahead)
  const dateStrip = useMemo(() => {
    const list: { dateStr: string; dayNum: string; dayName: string; isToday: boolean }[] = [];
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    for (let i = -10; i <= 3; i++) {
      const d = new Date();
      d.setDate(today.getDate() + i);
      const str = d.toISOString().split('T')[0];
      list.push({
        dateStr: str,
        dayNum: String(d.getDate()).padStart(2, '0'),
        dayName: DAY_NAMES_VI[d.getDay()],
        isToday: str === todayStr,
      });
    }
    return list;
  }, []);

  // Filter items by category
  const filteredList = useMemo(() => {
    if (filterCategory === 'all') return historyReminders;
    return historyReminders.filter((r) => r.category === filterCategory);
  }, [historyReminders, filterCategory]);

  // Statistics for selected day
  const stats = useMemo(() => {
    const total = historyReminders.length;
    const completed = historyReminders.filter((r) => r.isDone).length;
    const feeding = historyReminders.filter((r) => r.category === 'feeding').length;
    const exercise = historyReminders.filter((r) => r.category === 'exercise').length;
    const medication = historyReminders.filter((r) => r.category === 'medication').length;
    const hygiene = historyReminders.filter((r) => r.category === 'hygiene' || r.category === 'grooming').length;

    return { total, completed, feeding, exercise, medication, hygiene };
  }, [historyReminders]);

  // Set of dates with recorded data
  const datesWithData = useMemo(() => {
    return new Set(allHistoryRecords.map((r) => r.date));
  }, [allHistoryRecords]);

  return (
    <Modal
      visible={isCareHistoryModalOpen}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={closeCareHistoryModal}
    >
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        {/* Top Header — Guarantees 0% Dynamic Island overlap */}
        <View
          style={[
            styles.header,
            {
              backgroundColor: colors.surface,
              borderBottomColor: colors.border,
              paddingTop: headerTopPadding,
            },
          ]}
        >
          <Pressable
            onPress={() => {
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              closeCareHistoryModal();
            }}
            hitSlop={12}
            style={[styles.backBtn, { backgroundColor: colors.surfaceElevated }]}
          >
            <MaterialCommunityIcons name="arrow-left" size={22} color={colors.text} />
          </Pressable>

          <View style={{ flex: 1, marginLeft: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={[typo.titleMedium, { color: colors.text, fontWeight: '700' }]}>
                Lịch sử chăm sóc
              </Text>
              {selectedPet && (
                <View style={[styles.petTag, { backgroundColor: colors.primaryContainer }]}>
                  <Text style={[typo.labelSmall, { color: colors.primary, fontWeight: '700' }]}>
                    {selectedPet.name}
                  </Text>
                </View>
              )}
            </View>
            <Text style={[typo.caption, { color: colors.textSecondary }]}>
              Theo dõi bữa ăn & hoạt động theo ngày
            </Text>
          </View>

          <Pressable
            onPress={() => {
              const todayStr = new Date().toISOString().split('T')[0];
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              void setSelectedHistoryDate(todayStr);
            }}
            style={[styles.todayBtn, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}
          >
            <Text style={[typo.labelSmall, { color: colors.primary, fontWeight: '700' }]}>Hôm nay</Text>
          </Pressable>
        </View>

        <ScrollView
          style={{ flex: 1 }}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: bottomPadding }}
        >
          {/* Horizontal Date Selector Strip */}
          <View style={[styles.dateStripContainer, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 12, gap: 8 }}>
              {dateStrip.map((item) => {
                const isSelected = item.dateStr === selectedHistoryDate;
                const hasData = datesWithData.has(item.dateStr);

                return (
                  <Pressable
                    key={item.dateStr}
                    onPress={() => {
                      void Haptics.selectionAsync();
                      void setSelectedHistoryDate(item.dateStr);
                    }}
                    style={[
                      styles.dateCard,
                      {
                        backgroundColor: isSelected ? colors.primary : colors.surfaceElevated,
                        borderColor: isSelected ? colors.primary : colors.border,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        typo.caption,
                        {
                          color: isSelected ? colors.onPrimary : item.isToday ? colors.primary : colors.textSecondary,
                          fontWeight: item.isToday ? '700' : '500',
                          fontSize: 11,
                        },
                      ]}
                    >
                      {item.isToday ? 'Hôm nay' : item.dayName}
                    </Text>
                    <Text
                      style={[
                        typo.titleMedium,
                        {
                          color: isSelected ? colors.onPrimary : colors.text,
                          fontWeight: '700',
                          marginVertical: 2,
                        },
                      ]}
                    >
                      {item.dayNum}
                    </Text>

                    {/* Activity Indicator Dot */}
                    {hasData && (
                      <View
                        style={[
                          styles.dataDot,
                          {
                            backgroundColor: isSelected ? '#FFFFFF' : colors.primary,
                          },
                        ]}
                      />
                    )}
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>

          {/* Day Overview Banner */}
          <View style={{ paddingHorizontal: 16, marginTop: 14 }}>
            <View
              style={[
                styles.daySummaryCard,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                },
              ]}
            >
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <View>
                  <Text style={[typo.titleSmall, { color: colors.text, fontWeight: '700' }]}>
                    {formatDateVi(selectedHistoryDate)}
                  </Text>
                  <Text style={[typo.caption, { color: colors.textSecondary, marginTop: 2 }]}>
                    Tổng số: {stats.total} hoạt động chăm sóc
                  </Text>
                </View>

                {stats.total > 0 && (
                  <View
                    style={[
                      styles.progressBadge,
                      {
                        backgroundColor: stats.completed === stats.total ? '#DCFCE7' : colors.primaryContainer,
                      },
                    ]}
                  >
                    <Text
                      style={{
                        fontSize: 12,
                        fontWeight: '700',
                        color: stats.completed === stats.total ? '#16A34A' : colors.primary,
                      }}
                    >
                      {stats.completed}/{stats.total} xong
                    </Text>
                  </View>
                )}
              </View>

              {/* Mini Highlights Grid: Food, Exercise, Meds */}
              <View style={styles.miniStatsRow}>
                <View style={[styles.miniStatBox, { backgroundColor: colors.surfaceElevated }]}>
                  <MaterialCommunityIcons name="food-drumstick" size={18} color="#EA580C" />
                  <Text style={[typo.labelSmall, { color: colors.text, fontWeight: '700', marginTop: 4 }]}>
                    {stats.feeding} bữa
                  </Text>
                  <Text style={[typo.caption, { color: colors.textTertiary, fontSize: 10 }]}>Ăn uống</Text>
                </View>

                <View style={[styles.miniStatBox, { backgroundColor: colors.surfaceElevated }]}>
                  <MaterialCommunityIcons name="run-fast" size={18} color="#16A34A" />
                  <Text style={[typo.labelSmall, { color: colors.text, fontWeight: '700', marginTop: 4 }]}>
                    {stats.exercise} lần
                  </Text>
                  <Text style={[typo.caption, { color: colors.textTertiary, fontSize: 10 }]}>Vận động</Text>
                </View>

                <View style={[styles.miniStatBox, { backgroundColor: colors.surfaceElevated }]}>
                  <MaterialCommunityIcons name="pill" size={18} color="#8B5CF6" />
                  <Text style={[typo.labelSmall, { color: colors.text, fontWeight: '700', marginTop: 4 }]}>
                    {stats.medication} liều
                  </Text>
                  <Text style={[typo.caption, { color: colors.textTertiary, fontSize: 10 }]}>Thuốc/Men</Text>
                </View>

                <View style={[styles.miniStatBox, { backgroundColor: colors.surfaceElevated }]}>
                  <MaterialCommunityIcons name="shower-head" size={18} color="#DB2777" />
                  <Text style={[typo.labelSmall, { color: colors.text, fontWeight: '700', marginTop: 4 }]}>
                    {stats.hygiene} lần
                  </Text>
                  <Text style={[typo.caption, { color: colors.textTertiary, fontSize: 10 }]}>Vệ sinh</Text>
                </View>
              </View>
            </View>
          </View>

          {/* Category Filter Chips */}
          <View style={{ marginTop: 12, paddingHorizontal: 16 }}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {[
                { key: 'all', label: 'Tất cả', icon: 'view-grid-outline' },
                { key: 'feeding', label: 'Ăn uống', icon: 'food-drumstick' },
                { key: 'exercise', label: 'Vận động', icon: 'run-fast' },
                { key: 'medication', label: 'Thuốc/Men', icon: 'pill' },
                { key: 'hygiene', label: 'Vệ sinh', icon: 'shower-head' },
              ].map((tab) => {
                const isSelected = filterCategory === tab.key;
                return (
                  <Pressable
                    key={tab.key}
                    onPress={() => {
                      void Haptics.selectionAsync();
                      setFilterCategory(tab.key as any);
                    }}
                    style={[
                      styles.filterChip,
                      {
                        backgroundColor: isSelected ? colors.primary : colors.surfaceElevated,
                        borderColor: isSelected ? colors.primary : colors.border,
                      },
                    ]}
                  >
                    <MaterialCommunityIcons
                      name={tab.icon as any}
                      size={14}
                      color={isSelected ? colors.onPrimary : colors.textSecondary}
                      style={{ marginRight: 4 }}
                    />
                    <Text
                      style={[
                        typo.labelSmall,
                        {
                          color: isSelected ? colors.onPrimary : colors.text,
                          fontWeight: isSelected ? '700' : '500',
                        },
                      ]}
                    >
                      {tab.label}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>

          {/* Activities List for Selected Day */}
          <View style={{ paddingHorizontal: 16, marginTop: 14, marginBottom: 30 }}>
            {isHistoryLoading ? (
              <View style={[styles.emptyCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={[typo.bodySmall, { color: colors.textSecondary, marginTop: 8 }]}>
                  Đang tải nhật ký chăm sóc...
                </Text>
              </View>
            ) : filteredList.length === 0 ? (
              <View style={[styles.emptyCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <MaterialCommunityIcons name="clipboard-text-clock-outline" size={44} color={colors.textTertiary} />
                <Text style={[typo.titleSmall, { color: colors.text, fontWeight: '700', marginTop: 10 }]}>
                  Chưa có nhật ký hoạt động
                </Text>
                <Text style={[typo.bodySmall, { color: colors.textSecondary, textAlign: 'center', marginTop: 4, paddingHorizontal: 16 }]}>
                  {selectedPet
                    ? `Chưa có thông tin ăn uống hoặc vận động của bé ${selectedPet.name} cho ngày này.`
                    : 'Chưa có thông tin chăm sóc cho ngày này.'}
                </Text>

                <Pressable
                  onPress={() => {
                    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setIsAddModalOpen(true);
                  }}
                  style={[styles.addHistoryBtn, { backgroundColor: colors.primary, borderRadius: radius.full }]}
                >
                  <MaterialCommunityIcons name="plus" size={16} color={colors.onPrimary} />
                  <Text style={[typo.labelMedium, { color: colors.onPrimary, fontWeight: '700', marginLeft: 4 }]}>
                    Ghi lại hoạt động cho ngày này
                  </Text>
                </Pressable>
              </View>
            ) : (
              <View style={[styles.historyListCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                {filteredList.map((item, idx) => {
                  const catColor = CATEGORY_COLORS[item.category] || colors.primary;

                  return (
                    <View
                      key={item.id}
                      style={[
                        styles.historyItemRow,
                        {
                          borderBottomColor: colors.border,
                          borderBottomWidth: idx < filteredList.length - 1 ? 1 : 0,
                        },
                      ]}
                    >
                      <Pressable
                        onPress={() => {
                          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                          void toggleReminder(item.id);
                        }}
                        style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}
                      >
                        <View style={[styles.catIconCircle, { backgroundColor: catColor + '18' }]}>
                          <MaterialCommunityIcons name={(item.icon as any) || 'clock-check-outline'} size={20} color={catColor} />
                        </View>

                        <View style={{ flex: 1, marginLeft: 12 }}>
                          <Text
                            style={[
                              typo.bodyMedium,
                              {
                                color: item.isDone ? colors.textTertiary : colors.text,
                                fontWeight: '600',
                                textDecorationLine: item.isDone ? 'line-through' : 'none',
                              },
                            ]}
                          >
                            {item.title}
                          </Text>
                          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 3 }}>
                            <Text style={[typo.caption, { color: colors.primary, fontWeight: '700' }]}>
                              {item.time}
                            </Text>
                            <Text style={[typo.caption, { color: colors.textTertiary, marginLeft: 8 }]}>
                              {item.category === 'feeding'
                                ? 'Bữa ăn'
                                : item.category === 'exercise'
                                ? 'Vận động'
                                : item.category === 'medication'
                                ? 'Thuốc/Men'
                                : item.category === 'water'
                                ? 'Nước uống'
                                : 'Chăm sóc'}
                            </Text>
                          </View>
                        </View>
                      </Pressable>

                      {/* Status Checkbox */}
                      <Pressable
                        onPress={() => {
                          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                          void toggleReminder(item.id);
                        }}
                        hitSlop={8}
                        style={[
                          styles.statusBox,
                          {
                            borderColor: item.isDone ? colors.success : colors.border,
                            backgroundColor: item.isDone ? colors.success : 'transparent',
                          },
                        ]}
                      >
                        {item.isDone && <MaterialCommunityIcons name="check" size={14} color="#FFFFFF" />}
                      </Pressable>

                      {/* Delete */}
                      <Pressable
                        onPress={() => {
                          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
                          void deleteReminder(item.id);
                        }}
                        hitSlop={8}
                        style={{ padding: 6, marginLeft: 6 }}
                      >
                        <MaterialCommunityIcons name="trash-can-outline" size={16} color={colors.textTertiary} />
                      </Pressable>
                    </View>
                  );
                })}

                {/* Add more item for this date */}
                <Pressable
                  onPress={() => {
                    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setIsAddModalOpen(true);
                  }}
                  style={[styles.addMoreRow, { borderTopColor: colors.border }]}
                >
                  <MaterialCommunityIcons name="plus-circle-outline" size={18} color={colors.primary} />
                  <Text style={[typo.labelMedium, { color: colors.primary, fontWeight: '700', marginLeft: 6 }]}>
                    Thêm hoạt động cho ngày này
                  </Text>
                </Pressable>
              </View>
            )}
          </View>
        </ScrollView>

        {/* Add Care Schedule Modal preset to selected date */}
        <AddCareScheduleModal
          visible={isAddModalOpen}
          pet={selectedPet}
          targetDate={selectedHistoryDate}
          onClose={() => setIsAddModalOpen(false)}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  petTag: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    marginLeft: 6,
  },
  todayBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
  },
  dateStripContainer: {
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  dateCard: {
    width: 58,
    height: 72,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    position: 'relative',
  },
  dataDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    marginTop: 2,
  },
  daySummaryCard: {
    padding: 16,
    borderRadius: 18,
    borderWidth: 1,
  },
  progressBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  miniStatsRow: {
    flexDirection: 'row',
    marginTop: 14,
    gap: 8,
  },
  miniStatBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 12,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 18,
    borderWidth: 1,
  },
  emptyCard: {
    padding: 24,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addHistoryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginTop: 16,
  },
  historyListCard: {
    borderRadius: 18,
    borderWidth: 1,
    overflow: 'hidden',
  },
  historyItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  catIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusBox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addMoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderTopWidth: 1,
  },
});
