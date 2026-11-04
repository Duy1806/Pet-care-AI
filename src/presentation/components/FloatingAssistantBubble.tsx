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
 * - Question History Drawer / Modal (Lưu trữ và xem lại các câu hỏi đã hỏi)
 * - Calibrated top & bottom safe insets (No clipping with Dynamic Island / Home Indicator)
 * - Rounded capsule input bar lifted up with plenty of breathing room
 * - Persistent chat message storage via SQLite (pawcare.db)
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
  StatusBar as RNStatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';

import { useAppTheme } from '@/presentation/theme';
import { useChatStore } from '@/presentation/stores/useChatStore';
import { usePetStore } from '@/presentation/stores/usePetStore';
import type { ChatMessage } from '@/domain/entities/ChatMessage';
import type { QuestionHistoryItem } from '@/data/local/ChatHistoryDao';

const BUBBLE_SIZE = 60;

// Device-calibrated safe insets for Modal windows
const MODAL_TOP_PADDING = Platform.OS === 'ios' ? 58 : (RNStatusBar.currentHeight || 24) + 12;
const MODAL_BOTTOM_PADDING = Platform.OS === 'ios' ? 44 : 22;

export function FloatingAssistantBubble() {
  const { colors, typography: typo, spacing, radius } = useAppTheme();
  const flatListRef = useRef<FlatList>(null);

  const {
    messages,
    questionHistory,
    isLoading,
    apiKey,
    sendMessage,
    clearHistory,
    setApiKey,
    setActivePetContext,
    activePetContext,
    isChatModalOpen,
    isHistoryModalOpen,
    openChatModal,
    closeChatModal,
    openHistoryModal,
    closeHistoryModal,
    deleteQuestion,
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

  const handleSelectPastQuestion = (item: QuestionHistoryItem) => {
    void Haptics.selectionAsync();
    closeHistoryModal();
    setInputText(item.question);
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
        presentationStyle="fullScreen"
        onRequestClose={closeChatModal}
      >
        <View style={[styles.modalContainer, { backgroundColor: colors.background }]}>
          {/* Top Header with safe inset from Dynamic Island / Status Bar */}
          <View
            style={[
              styles.header,
              {
                backgroundColor: colors.surface,
                borderBottomColor: colors.border,
                paddingTop: MODAL_TOP_PADDING,
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
                    {'Bác sĩ '}
                    <Text style={{ color: colors.primary }}>{'Thú y AI'}</Text>
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

              {/* Action buttons: Question History, API Key, Clear History */}
              <Pressable
                onPress={() => {
                  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  openHistoryModal();
                }}
                hitSlop={8}
                style={[styles.headerBtn, { backgroundColor: colors.surfaceElevated }]}
              >
                <MaterialCommunityIcons name="history" size={20} color={colors.primary} />
                {questionHistory.length > 0 && (
                  <View style={[styles.badgeNumber, { backgroundColor: colors.primary }]}>
                    <Text style={{ color: '#FFFFFF', fontSize: 9, fontWeight: '700' }}>
                      {questionHistory.length > 9 ? '9+' : questionHistory.length}
                    </Text>
                  </View>
                )}
              </Pressable>

              <Pressable
                onPress={() => setShowConfigModal(true)}
                hitSlop={8}
                style={[styles.headerBtn, { backgroundColor: colors.surfaceElevated, marginLeft: 8 }]}
              >
                <MaterialCommunityIcons name="key-variant" size={18} color={colors.textSecondary} />
              </Pressable>

              <Pressable
                onPress={() => {
                  void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
                  void clearHistory();
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
            contentContainerStyle={styles.messageList}
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

          {/* Floating Bottom Input Bar — Rounded capsule pill & lifted with breathing room */}
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
            style={[
              styles.inputContainer,
              {
                backgroundColor: colors.surface,
                borderTopColor: colors.border,
                paddingBottom: MODAL_BOTTOM_PADDING,
              },
            ]}
          >
            <View
              style={[
                styles.inputRow,
                {
                  backgroundColor: colors.surfaceElevated,
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

          {/* Question History Modal */}
          <Modal visible={isHistoryModalOpen} transparent animationType="slide" onRequestClose={closeHistoryModal}>
            <View style={styles.historyModalOverlay}>
              <View
                style={[
                  styles.historyModalCard,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                    borderRadius: radius.xl,
                  },
                ]}
              >
                <View style={styles.historyHeader}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <MaterialCommunityIcons name="history" size={24} color={colors.primary} />
                    <Text style={[typo.titleMedium, { color: colors.text, marginLeft: 8, fontWeight: '700' }]}>
                      Lịch sử câu hỏi đã hỏi
                    </Text>
                  </View>
                  <Pressable onPress={closeHistoryModal} hitSlop={10}>
                    <MaterialCommunityIcons name="close" size={22} color={colors.textSecondary} />
                  </Pressable>
                </View>

                <Text style={[typo.caption, { color: colors.textSecondary, marginTop: 4, marginBottom: 12 }]}>
                  Chạm vào câu hỏi để điền lại vào khung chat và tiếp tục hỏi đáp:
                </Text>

                {questionHistory.length === 0 ? (
                  <View style={styles.emptyHistoryBox}>
                    <MaterialCommunityIcons name="chat-question-outline" size={40} color={colors.textTertiary} />
                    <Text style={[typo.bodyMedium, { color: colors.textTertiary, marginTop: 8 }]}>
                      Chưa có câu hỏi nào được lưu
                    </Text>
                  </View>
                ) : (
                  <FlatList
                    data={questionHistory}
                    keyExtractor={(item) => item.id}
                    style={{ maxHeight: 380 }}
                    renderItem={({ item }) => (
                      <View
                        style={[
                          styles.historyItemCard,
                          {
                            backgroundColor: colors.surfaceElevated,
                            borderColor: colors.border,
                          },
                        ]}
                      >
                        <Pressable
                          style={{ flex: 1 }}
                          onPress={() => handleSelectPastQuestion(item)}
                        >
                          <Text style={[typo.bodyMedium, { color: colors.text, fontWeight: '600' }]} numberOfLines={2}>
                            {item.question}
                          </Text>
                          <View style={styles.historyMetaRow}>
                            {item.petName && (
                              <View style={[styles.historyPetTag, { backgroundColor: colors.primaryContainer }]}>
                                <Text style={[typo.caption, { color: colors.primary, fontWeight: '700' }]}>
                                  {item.petName}
                                </Text>
                              </View>
                            )}
                            <Text style={[typo.caption, { color: colors.textTertiary, marginLeft: 6 }]}>
                              {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}{' '}
                              • {new Date(item.timestamp).toLocaleDateString()}
                            </Text>
                          </View>
                        </Pressable>
                        <Pressable
                          onPress={() => void deleteQuestion(item.id)}
                          hitSlop={10}
                          style={styles.deleteQuestionBtn}
                        >
                          <MaterialCommunityIcons name="trash-can-outline" size={18} color={colors.error} />
                        </Pressable>
                      </View>
                    )}
                  />
                )}
              </View>
            </View>
          </Modal>

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
    paddingBottom: 10,
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
    position: 'relative',
  },
  badgeNumber: {
    position: 'absolute',
    top: -2,
    right: -2,
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
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
    paddingBottom: 20,
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
    paddingTop: 10,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: 28,
    paddingLeft: 18,
    paddingRight: 6,
    paddingVertical: Platform.OS === 'ios' ? 6 : 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  textInput: {
    flex: 1,
    minHeight: 40,
    maxHeight: 110,
    paddingVertical: 6,
    fontSize: 15,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 6,
  },
  historyModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'flex-end',
  },
  historyModalCard: {
    maxHeight: '80%',
    padding: 20,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
  },
  historyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  emptyHistoryBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  historyItemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8,
  },
  historyMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  historyPetTag: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  deleteQuestionBtn: {
    padding: 6,
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
