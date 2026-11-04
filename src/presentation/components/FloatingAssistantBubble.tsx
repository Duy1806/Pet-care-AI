/**
 * PawCare AI — Floating AI Veterinary Assistant Bubble
 *
 * A persistent, draggable floating chat head (bubble) that appears on all screens.
 * Features:
 * - Floating bubble with cute AI robot icon & active online indicator
 * - Smooth drag-and-drop / PanResponder positioning
 * - Slides open full interactive AI Veterinary Consultation Modal
 * - Seamless pet context injection (Milo, Luna, etc.)
 * - Suggested action chips & quick veterinary questions
 * - Minimize / Close button to return to the active screen instantly
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  PanResponder,
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

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const BUBBLE_SIZE = 60;

export function FloatingAssistantBubble() {
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
    isChatModalOpen,
    openChatModal,
    closeChatModal,
  } = useChatStore();

  const { pets, selectedPet } = usePetStore();

  const [inputText, setInputText] = useState('');
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [tempApiKey, setTempApiKey] = useState(apiKey);

  // Initial position: Bottom right above the navigation tab bar
  const defaultBottom = Platform.OS === 'ios' ? 95 : 80;
  const pan = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const isDragging = useRef(false);

  // PanResponder to make bubble draggable
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gesture) => {
        return Math.abs(gesture.dx) > 6 || Math.abs(gesture.dy) > 6;
      },
      onPanResponderGrant: () => {
        isDragging.current = false;
        pan.extractOffset();
      },
      onPanResponderMove: (_, gesture) => {
        isDragging.current = true;
        pan.setValue({ x: gesture.dx, y: gesture.dy });
      },
      onPanResponderRelease: () => {
        pan.flattenOffset();
        // If not dragged significantly, treat as tap
        if (!isDragging.current) {
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          openChatModal();
        }
      },
    })
  ).current;

  // Auto-sync pet context if selectedPet is present
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
      closeChatModal();
      router.push('/(app)/nutrition' as any);
    } else if (action.includes('tiêm') || action.includes('sổ tiêm')) {
      closeChatModal();
      router.push('/vaccinations' as any);
    } else if (action.includes('nhận diện') || action.includes('Quét')) {
      closeChatModal();
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

            {/* Bubble Body */}
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
    <>
      {/* Floating Draggable Bubble */}
      <Animated.View
        style={[
          styles.floatingContainer,
          {
            bottom: defaultBottom,
            transform: [{ translateX: pan.x }, { translateY: pan.y }],
          },
        ]}
        {...panResponder.panHandlers}
      >
        <View
          style={[
            styles.bubbleCircle,
            {
              backgroundColor: colors.primary,
              shadowColor: colors.primary,
            },
          ]}
        >
          <MaterialCommunityIcons name="robot-happy" size={32} color="#FFFFFF" />
          {/* Active Status Badge */}
          <View style={styles.statusBadge}>
            <View style={styles.statusDot} />
          </View>
        </View>
      </Animated.View>

      {/* AI Assistant Chat Modal */}
      <Modal
        visible={isChatModalOpen}
        animationType="slide"
        presentationStyle={Platform.OS === 'ios' ? 'pageSheet' : 'fullScreen'}
        onRequestClose={closeChatModal}
      >
        <View style={[styles.modalContainer, { backgroundColor: colors.background }]}>
          {/* Top Header */}
          <View
            style={[
              styles.header,
              {
                backgroundColor: colors.surface,
                borderBottomColor: colors.border,
                paddingTop: insets.top + (Platform.OS === 'ios' ? spacing.xs : spacing.sm),
              },
            ]}
          >
            <View style={styles.headerTitleRow}>
              {/* Minimize / Close Button */}
              <Pressable
                onPress={() => {
                  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  closeChatModal();
                }}
                hitSlop={12}
                style={[styles.closeIconCircle, { backgroundColor: colors.surfaceElevated }]}
              >
                <MaterialCommunityIcons name="chevron-down" size={26} color={colors.text} />
              </Pressable>

              <View style={[styles.headerIconCircle, { backgroundColor: colors.primaryContainer, marginLeft: 8 }]}>
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
                  Hỗ trợ 24/7 • Bấm ▼ để thu nhỏ
                </Text>
              </View>

              {/* Action buttons */}
              <Pressable
                onPress={() => setShowConfigModal(true)}
                hitSlop={8}
                style={[styles.headerBtn, { backgroundColor: colors.surfaceElevated }]}
              >
                <MaterialCommunityIcons name="key-variant" size={18} color={colors.textSecondary} />
              </Pressable>

              <Pressable
                onPress={() => {
                  void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
                  clearHistory();
                }}
                hitSlop={8}
                style={[styles.headerBtn, { backgroundColor: colors.surfaceElevated, marginLeft: 8 }]}
              >
                <MaterialCommunityIcons name="delete-sweep-outline" size={18} color={colors.error} />
              </Pressable>
            </View>

            {/* Pet Context Selector */}
            {pets.length > 0 && (
              <View style={styles.petSelectorContainer}>
                <Text style={[typo.caption, { color: colors.textSecondary, marginBottom: 6 }]}>
                  Tư vấn chuyên sâu theo hồ sơ của:
                </Text>
                <FlatList
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  data={[{ id: 'all', name: 'Tất cả' }, ...pets]}
                  keyExtractor={(item) => item.id}
                  renderItem={({ item }) => {
                    const isSelected =
                      item.id === 'all'
                        ? activePetContext === null
                        : activePetContext?.id === item.id;

                    return (
                      <Pressable
                        onPress={() => handleSelectPet(item.id === 'all' ? null : item.id)}
                        style={[
                          styles.petChip,
                          {
                            backgroundColor: isSelected ? colors.primaryContainer : colors.surfaceElevated,
                            borderColor: isSelected ? colors.primary : colors.border,
                          },
                        ]}
                      >
                        {item.id !== 'all' && (
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
                    Bác sĩ AI đang chuẩn đoán y khoa...
                  </Text>
                </View>
              ) : undefined
            }
          />

          {/* Floating Bottom Input Bar */}
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 20 : 0}
            style={[
              styles.inputContainer,
              {
                backgroundColor: colors.surface,
                borderTopColor: colors.border,
                paddingBottom: insets.bottom > 0 ? insets.bottom : spacing.sm,
              },
            ]}
          >
            <View
              style={[
                styles.inputRow,
                {
                  backgroundColor: colors.surfaceElevated,
                  borderRadius: radius.full,
                  borderColor: colors.border,
                },
              ]}
            >
              <TextInput
                value={inputText}
                onChangeText={setInputText}
                placeholder={
                  activePetContext
                    ? `Hỏi về tình trạng sức khỏe của ${activePetContext.name}...`
                    : 'Nhập thắc mắc hoặc triệu chứng của bé...'
                }
                placeholderTextColor={colors.textTertiary}
                style={[
                  styles.textInput,
                  typo.bodyMedium,
                  { color: colors.text },
                ]}
                multiline
                maxLength={500}
                editable={!isLoading}
              />
              <Pressable
                onPress={() => void handleSend()}
                disabled={!inputText.trim() || isLoading}
                style={[
                  styles.sendButton,
                  {
                    backgroundColor: inputText.trim() && !isLoading ? colors.primary : colors.border,
                    borderRadius: radius.full,
                  },
                ]}
              >
                {isLoading ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <MaterialCommunityIcons name="send" size={18} color="#FFFFFF" />
                )}
              </Pressable>
            </View>
          </KeyboardAvoidingView>

          {/* API Key Configuration Modal */}
          <Modal visible={showConfigModal} transparent animationType="fade">
            <View style={styles.configModalOverlay}>
              <View
                style={[
                  styles.configModalCard,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                    borderRadius: radius.xl,
                  },
                ]}
              >
                <View style={styles.configModalHeader}>
                  <MaterialCommunityIcons name="key-chain" size={24} color={colors.primary} />
                  <Text style={[typo.titleMedium, { color: colors.text, marginLeft: 8, fontWeight: '700' }]}>
                    Google Gemini API Key
                  </Text>
                </View>

                <Text style={[typo.bodySmall, { color: colors.textSecondary, marginTop: 8 }]}>
                  Ứng dụng đã được tích hợp sẵn API Key mặc định của bạn. Bạn có thể cập nhật key mới tại đây nếu cần:
                </Text>

                <TextInput
                  value={tempApiKey}
                  onChangeText={setTempApiKey}
                  placeholder="Nhập API key mới..."
                  placeholderTextColor={colors.textTertiary}
                  style={[
                    styles.configInput,
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

                <View style={styles.configModalActions}>
                  <Pressable
                    onPress={() => setShowConfigModal(false)}
                    style={[styles.configCancelBtn, { borderColor: colors.border, borderRadius: radius.md }]}
                  >
                    <Text style={[typo.labelMedium, { color: colors.textSecondary }]}>Hủy</Text>
                  </Pressable>

                  <Pressable
                    onPress={handleSaveApiKey}
                    style={[styles.configSaveBtn, { backgroundColor: colors.primary, borderRadius: radius.md }]}
                  >
                    <Text style={[typo.labelMedium, { color: colors.onPrimary, fontWeight: '700' }]}>Lưu Key</Text>
                  </Pressable>
                </View>
              </View>
            </View>
          </Modal>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  floatingContainer: {
    position: 'absolute',
    right: 20,
    zIndex: 99999,
    elevation: 99999,
  },
  bubbleCircle: {
    width: BUBBLE_SIZE,
    height: BUBBLE_SIZE,
    borderRadius: BUBBLE_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 10,
  },
  statusBadge: {
    position: 'absolute',
    top: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 2,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#22C55E',
  },
  modalContainer: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  closeIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  onlineBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    marginLeft: 6,
  },
  headerBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  petSelectorContainer: {
    marginTop: 10,
  },
  petChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    marginRight: 8,
  },
  messageList: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  messageRow: {
    flexDirection: 'row',
    marginBottom: 16,
    maxWidth: '85%',
  },
  messageRowUser: {
    alignSelf: 'flex-end',
    justifyContent: 'flex-end',
  },
  messageRowAssistant: {
    alignSelf: 'flex-start',
  },
  assistantAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
    marginTop: 2,
  },
  bubbleWrapper: {
    flex: 1,
  },
  bubbleWrapperUser: {
    alignItems: 'flex-end',
  },
  petContextTag: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    marginBottom: 4,
    alignSelf: 'flex-end',
  },
  bubble: {
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  bubbleUser: {
    borderBottomRightRadius: 4,
  },
  bubbleAssistant: {
    borderTopLeftRadius: 4,
    borderWidth: 1,
  },
  suggestedActionsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 8,
    gap: 6,
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
    paddingLeft: 40,
  },
  inputContainer: {
    borderTopWidth: 1,
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  textInput: {
    flex: 1,
    maxHeight: 100,
    paddingVertical: 4,
  },
  sendButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  configModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  configModalCard: {
    width: '100%',
    maxWidth: 400,
    padding: 20,
    borderWidth: 1,
  },
  configModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  configInput: {
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 12,
    fontSize: 14,
  },
  configModalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 18,
    gap: 10,
  },
  configCancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderWidth: 1,
  },
  configSaveBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
});
