/**
 * PawCare AI — Generative AI Veterinary Assistant (Gemini) Screen
 *
 * Screen for real-time AI veterinary consultation powered by Google Gemini API.
 * Features:
 * - Real-time chat with streaming/instant LLM response
 * - Pet context injection (Milo, Luna, etc.)
 * - Veterinary clinical prompts & emergency warnings
 * - API Key management modal
 * - Suggested action chips & quick shortcuts
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';

import { useAppTheme } from '@/presentation/theme';
import { useChatStore } from '@/presentation/stores/useChatStore';
import { usePetStore } from '@/presentation/stores/usePetStore';
import type { ChatMessage } from '@/domain/entities/ChatMessage';

export default function AssistantScreen() {
  const { colors, typography: typo, spacing, radius } = useAppTheme();
  const insets = useSafeAreaInsets();
  const flatListRef = useRef<FlatList>(null);

  const {
    messages,
    isLoading,
    apiKey,
    sendMessage,
    clearHistory,
    setApiKey,
    setActivePetContext,
    activePetContext,
  } = useChatStore();

  const { pets, selectedPet } = usePetStore();

  const [inputText, setInputText] = useState('');
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [tempApiKey, setTempApiKey] = useState(apiKey);

  // Synchronize active pet with global pet store on initial mount
  useEffect(() => {
    if (selectedPet && !activePetContext) {
      setActivePetContext({
        id: selectedPet.id,
        name: selectedPet.name,
        species: selectedPet.species === 'cat' ? 'cat' : 'dog',
        breed: selectedPet.breedName || selectedPet.breed,
        weightKg: selectedPet.weightKg,
        isNeutered: selectedPet.isNeutered,
      });
    }
  }, [selectedPet, activePetContext, setActivePetContext]);

  const handleSelectPet = (petId: string | null) => {
    void Haptics.selectionAsync();
    if (!petId) {
      setActivePetContext(null);
      return;
    }
    const found = pets.find((p) => p.id === petId);
    if (found) {
      setActivePetContext({
        id: found.id,
        name: found.name,
        species: found.species === 'cat' ? 'cat' : 'dog',
        breed: found.breedName || found.breed,
        weightKg: found.weightKg,
        isNeutered: found.isNeutered,
      });
    }
  };

  const handleSend = async (textToSend?: string) => {
    const text = (textToSend || inputText).trim();
    if (!text || isLoading) return;

    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setInputText('');
    await sendMessage(text);
  };

  const handleSaveApiKey = () => {
    setApiKey(tempApiKey);
    setShowConfigModal(false);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const handleActionClick = (action: string) => {
    if (action.includes('dinh dưỡng') || action.includes('khẩu phần')) {
      router.push('/(app)/nutrition' as any);
    } else if (action.includes('tiêm') || action.includes('sổ tiêm')) {
      router.push('/vaccinations' as any);
    } else if (action.includes('nhận diện') || action.includes('Quét')) {
      router.push('/(app)/breed-scanner' as any);
    } else {
      void handleSend(action);
    }
  };

  const renderMessageItem = useCallback(
    ({ item }: { item: ChatMessage }) => {
      const isUser = item.sender === 'user';

      return (
        <View
          style={[
            styles.messageRow,
            isUser ? styles.messageRowUser : styles.messageRowAssistant,
          ]}
        >
          {!isUser && (
            <View
              style={[
                styles.assistantAvatar,
                { backgroundColor: colors.primaryContainer },
              ]}
            >
              <MaterialCommunityIcons name="doctor" size={20} color={colors.primary} />
            </View>
          )}

          <View style={[styles.bubbleWrapper, isUser ? styles.bubbleWrapperUser : {}]}>
            {/* Pet Context tag on user message */}
            {isUser && item.petContext?.petName && (
              <View style={[styles.petContextTag, { backgroundColor: colors.primary + '20' }]}>
                <MaterialCommunityIcons
                  name={item.petContext.species === 'cat' ? 'cat' : 'dog'}
                  size={12}
                  color={colors.primary}
                />
                <Text style={[typo.caption, { color: colors.primary, marginLeft: 4, fontWeight: '700' }]}>
                  Dành cho: {item.petContext.petName}
                </Text>
              </View>
            )}

            {/* Bubble */}
            <View
              style={[
                styles.bubble,
                isUser
                  ? [styles.bubbleUser, { backgroundColor: colors.primary }]
                  : [
                      styles.bubbleAssistant,
                      {
                        backgroundColor: item.isError ? colors.errorContainer : colors.surface,
                        borderColor: item.isError ? colors.error : colors.border,
                      },
                    ],
                { borderRadius: radius.lg },
              ]}
            >
              <Text
                style={[
                  typo.bodyMedium,
                  {
                    color: isUser ? colors.onPrimary : item.isError ? colors.error : colors.text,
                    lineHeight: 22,
                  },
                ]}
                selectable
              >
                {item.text}
              </Text>
            </View>

            {/* Suggested Action Chips */}
            {!isUser && item.suggestedActions && item.suggestedActions.length > 0 && (
              <View style={styles.suggestedActionsContainer}>
                {item.suggestedActions.map((action, idx) => (
                  <Pressable
                    key={idx}
                    onPress={() => handleActionClick(action)}
                    style={[
                      styles.suggestionChip,
                      {
                        backgroundColor: colors.surfaceElevated,
                        borderColor: colors.primary,
                        borderRadius: radius.full,
                      },
                    ]}
                  >
                    <Text style={[typo.labelSmall, { color: colors.primary, fontWeight: '600' }]}>
                      {action}
                    </Text>
                  </Pressable>
                ))}
              </View>
            )}
          </View>
        </View>
      );
    },
    [colors, typo, radius]
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Top Header */}
      <View
        style={[
          styles.header,
          {
            backgroundColor: colors.surface,
            borderBottomColor: colors.border,
            paddingTop: insets.top + spacing.xs,
          },
        ]}
      >
        <View style={styles.headerTitleRow}>
          <View style={[styles.headerIconCircle, { backgroundColor: colors.primaryContainer }]}>
            <MaterialCommunityIcons name="robot-happy-outline" size={24} color={colors.primary} />
          </View>
          <View style={{ flex: 1, marginLeft: spacing.sm }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={[typo.titleMedium, { color: colors.text, fontWeight: '700' }]}>
                Bác sĩ Thú y AI
              </Text>
              <View style={[styles.onlineBadge, { backgroundColor: '#DCFCE7' }]}>
                <Text style={{ fontSize: 10, color: '#16A34A', fontWeight: '700' }}>
                  Gemini LLM
                </Text>
              </View>
            </View>
            <Text style={[typo.caption, { color: colors.textSecondary }]}>
              Hỗ trợ 24/7 • Chuẩn đoán & Lời khuyên lâm sàng
            </Text>
          </View>

          {/* Action buttons */}
          <Pressable
            onPress={() => {
              setTempApiKey(apiKey);
              setShowConfigModal(true);
            }}
            hitSlop={8}
            style={[styles.headerActionBtn, { backgroundColor: colors.surfaceElevated }]}
          >
            <MaterialCommunityIcons name="key-outline" size={20} color={colors.textSecondary} />
          </Pressable>

          <Pressable
            onPress={clearHistory}
            hitSlop={8}
            style={[styles.headerActionBtn, { backgroundColor: colors.surfaceElevated, marginLeft: 6 }]}
          >
            <MaterialCommunityIcons name="delete-outline" size={20} color={colors.textSecondary} />
          </Pressable>
        </View>

        {/* Pet Context Selector */}
        {pets.length > 0 && (
          <View style={[styles.petSelectorBar, { borderTopColor: colors.border }]}>
            <Text style={[typo.caption, { color: colors.textSecondary, marginRight: 8 }]}>
              Tư vấn cho:
            </Text>
            <FlatList
              horizontal
              showsHorizontalScrollIndicator={false}
              data={[{ id: null, name: 'Chung' }, ...pets]}
              keyExtractor={(item) => item.id || 'all'}
              contentContainerStyle={{ gap: 6 }}
              renderItem={({ item }) => {
                const isSelected = item.id
                  ? activePetContext?.id === item.id
                  : activePetContext === null;

                return (
                  <Pressable
                    onPress={() => handleSelectPet(item.id)}
                    style={[
                      styles.petChip,
                      {
                        backgroundColor: isSelected ? colors.primaryContainer : colors.surfaceElevated,
                        borderColor: isSelected ? colors.primary : colors.border,
                        borderRadius: radius.full,
                      },
                    ]}
                  >
                    {item.id && (
                      <MaterialCommunityIcons
                        name={(item as any).species === 'cat' ? 'cat' : 'dog'}
                        size={14}
                        color={isSelected ? colors.primary : colors.textSecondary}
                        style={{ marginRight: 4 }}
                      />
                    )}
                    <Text
                      style={[
                        typo.labelSmall,
                        {
                          color: isSelected ? colors.primary : colors.text,
                          fontWeight: isSelected ? '700' : '500',
                        },
                      ]}
                    >
                      {item.name}
                    </Text>
                  </Pressable>
                );
              }}
            />
          </View>
        )}
      </View>

      {/* Chat Messages */}
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={renderMessageItem}
        contentContainerStyle={[
          styles.messageList,
          { paddingBottom: insets.bottom + 90 },
        ]}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
        ListFooterComponent={
          isLoading ? (
            <View style={styles.loadingFooter}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={[typo.caption, { color: colors.textSecondary, marginLeft: 8 }]}>
                Bác sĩ AI đang tổng hợp câu trả lời y khoa...
              </Text>
            </View>
          ) : undefined
        }
      />

      {/* Floating Bottom Input Bar */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}
        style={[
          styles.inputContainer,
          {
            backgroundColor: colors.surface,
            borderTopColor: colors.border,
            paddingBottom: insets.bottom > 0 ? insets.bottom : spacing.sm,
          },
        ]}
      >
        <View style={[styles.inputRow, { backgroundColor: colors.surfaceElevated, borderRadius: radius.full, borderColor: colors.border }]}>
          <TextInput
            style={[styles.textInput, typo.bodyMedium, { color: colors.text }]}
            placeholder={
              activePetContext
                ? `Hỏi về tình trạng của bé ${activePetContext.name}...`
                : 'Nhập câu hỏi triệu chứng, ăn uống, tiêm chủng...'
            }
            placeholderTextColor={colors.textTertiary}
            value={inputText}
            onChangeText={setInputText}
            multiline
            maxLength={1000}
          />

          <Pressable
            onPress={() => handleSend()}
            disabled={!inputText.trim() || isLoading}
            style={[
              styles.sendBtn,
              {
                backgroundColor: inputText.trim() && !isLoading ? colors.primary : colors.border,
                borderRadius: radius.full,
              },
            ]}
          >
            <MaterialCommunityIcons
              name="arrow-up"
              size={22}
              color={inputText.trim() && !isLoading ? colors.onPrimary : colors.textTertiary}
            />
          </Pressable>
        </View>
      </KeyboardAvoidingView>

      {/* Gemini API Key Configuration Modal */}
      <Modal visible={showConfigModal} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View
            style={[
              styles.modalBox,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
                borderRadius: radius.xl,
              },
            ]}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm }}>
              <MaterialCommunityIcons name="google" size={24} color={colors.primary} />
              <Text style={[typo.titleLarge, { color: colors.text, fontWeight: '700', marginLeft: 8 }]}>
                Cấu hình Google Gemini AI
              </Text>
            </View>

            <Text style={[typo.bodySmall, { color: colors.textSecondary, marginBottom: spacing.md }]}>
              Tính năng Generative AI sử dụng mô hình Google Gemini 1.5 Flash để tư vấn y khoa thú y chuẩn xác theo thời gian thực.
            </Text>

            <Text style={[typo.labelMedium, { color: colors.text, marginBottom: spacing.xs }]}>
              Gemini API Key:
            </Text>
            <TextInput
              value={tempApiKey}
              onChangeText={setTempApiKey}
              placeholder="Dán mã AIzaSy... vào đây"
              placeholderTextColor={colors.textTertiary}
              style={[
                styles.keyInput,
                {
                  backgroundColor: colors.surfaceElevated,
                  borderColor: colors.border,
                  borderRadius: radius.md,
                  color: colors.text,
                },
              ]}
              autoCapitalize="none"
              autoCorrect={false}
            />

            <Text style={[typo.caption, { color: colors.textTertiary, marginTop: 4, marginBottom: spacing.lg }]}>
              💡 Mẹo: Bạn có thể lấy API Key miễn phí từ Google AI Studio (ai.google.dev). Nếu để trống, app sẽ kích hoạt bộ tri thức thú y offline tích hợp sẵn.
            </Text>

            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.sm }}>
              <Pressable
                onPress={() => setShowConfigModal(false)}
                style={[styles.modalBtn, { backgroundColor: colors.surfaceElevated, borderRadius: radius.md }]}
              >
                <Text style={[typo.labelMedium, { color: colors.text }]}>Đóng</Text>
              </Pressable>
              <Pressable
                onPress={handleSaveApiKey}
                style={[styles.modalBtn, { backgroundColor: colors.primary, borderRadius: radius.md }]}
              >
                <Text style={[typo.labelMedium, { color: colors.onPrimary, fontWeight: '700' }]}>
                  Lưu cấu hình
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    borderBottomWidth: 1,
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerIconCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: 'center',
    alignItems: 'center',
  },
  onlineBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    marginLeft: 6,
  },
  headerActionBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  petSelectorBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
  },
  petChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderWidth: 1,
  },
  messageList: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  messageRow: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  messageRowUser: {
    justifyContent: 'flex-end',
  },
  messageRowAssistant: {
    justifyContent: 'flex-start',
  },
  assistantAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
    marginTop: 4,
  },
  bubbleWrapper: {
    maxWidth: '82%',
  },
  bubbleWrapperUser: {
    alignItems: 'flex-end',
  },
  petContextTag: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    marginBottom: 4,
  },
  bubble: {
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  bubbleUser: {},
  bubbleAssistant: {
    borderWidth: 1,
  },
  suggestedActionsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
  },
  suggestionChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
  },
  loadingFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  inputContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopWidth: 1,
    paddingHorizontal: 12,
    paddingTop: 8,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 4,
    minHeight: 46,
  },
  textInput: {
    flex: 1,
    maxHeight: 100,
    paddingVertical: 8,
  },
  sendBtn: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 6,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalBox: {
    width: '100%',
    maxWidth: 420,
    borderWidth: 1,
    padding: 20,
  },
  keyInput: {
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  modalBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
});
