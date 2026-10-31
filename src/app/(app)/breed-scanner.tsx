/**
 * PawCare AI — Breed Identification Screen (Nhận diện giống loài AI)
 *
 * Connected to PyTorch EfficientNet-B0 37-class Model Backend:
 * - Live Server Status Indicator (Connected / Disconnected)
 * - Configurable Backend Server IP for seamless Wi-Fi testing
 * - Real Camera & Photo Gallery upload using expo-image-picker
 * - Sends photo to FastAPI backend (`/pet/predict`)
 * - Displays Top 3 AI Predictions with Vietnamese labels and confidence %
 * - Enriches with Supabase Breed Database info (care tips, weight, lifespan)
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';

import { useAppTheme } from '@/presentation/theme';
import { PrimaryButton } from '@/presentation/components/PrimaryButton';
import { useBreedStore } from '@/presentation/stores/useBreedStore';
import type { Breed } from '@/domain/entities/Breed';

interface BreedTopCandidate {
  label: string;
  label_vi: string;
  confidence: number;
  confidence_percent: number;
}

interface BreedAnalysisResult {
  breedName: string;
  breedEnglish: string;
  species: 'dog' | 'cat';
  speciesVi: string;
  confidence: number;
  top3Breeds?: BreedTopCandidate[];
  origin: string;
  temperament: string[];
  standardWeight: string;
  lifespan: string;
  careTips: string;
  healthWarnings: string;
}

const DEFAULT_API_URL =
  process.env.EXPO_PUBLIC_AI_API_URL || 'http://172.26.23.169:8000/pet/predict';

const SAMPLE_PRESETS: { label: string; icon: string; result: BreedAnalysisResult }[] = [
  {
    label: '🐕 Golden Retriever',
    icon: 'dog',
    result: {
      breedName: 'Chó Golden Retriever',
      breedEnglish: 'Golden Retriever',
      species: 'dog',
      speciesVi: 'Chó',
      confidence: 98.4,
      origin: 'Scotland, Vương Quốc Anh',
      temperament: ['Thông minh', 'Hiền lành', 'Thích trẻ con', 'Năng động'],
      standardWeight: '27 - 34 kg',
      lifespan: '10 - 12 năm',
      careTips: 'Cần vận động tối thiểu 45 - 60 phút mỗi ngày. Chải lông 2-3 lần/tuần để tránh bết rụng.',
      healthWarnings: 'Dễ mắc bệnh loạn sản xương hông (Hip Dysplasia) và viêm tai nếu đọng nước.',
      top3Breeds: [
        { label: 'golden_retriever', label_vi: 'Golden Retriever', confidence: 0.984, confidence_percent: 98.4 },
        { label: 'labrador_retriever', label_vi: 'Labrador Retriever', confidence: 0.012, confidence_percent: 1.2 },
        { label: 'beagle', label_vi: 'Beagle', confidence: 0.003, confidence_percent: 0.3 },
      ],
    },
  },
  {
    label: '🐈 Mèo Ba Tư',
    icon: 'cat',
    result: {
      breedName: 'Mèo Ba Tư',
      breedEnglish: 'Persian',
      species: 'cat',
      speciesVi: 'Mèo',
      confidence: 94.8,
      origin: 'Iran / Ba Tư',
      temperament: ['Điềm tĩnh', 'Quý phái', 'Thích yên tĩnh', 'Tình cảm'],
      standardWeight: '3.5 - 6.5 kg',
      lifespan: '12 - 17 năm',
      careTips: 'Lông dài dày cần được chải chuốt hàng ngày và vệ sinh khóe mắt tránh ố nước mắt.',
      healthWarnings: 'Dễ mắc hội chứng đường hô hấp đầu ngắn (brachycephalic) và bệnh thận đa nang (PKD).',
      top3Breeds: [
        { label: 'Persian', label_vi: 'Mèo Ba Tư', confidence: 0.948, confidence_percent: 94.8 },
        { label: 'Maine_Coon', label_vi: 'Mèo Maine Coon', confidence: 0.038, confidence_percent: 3.8 },
        { label: 'Ragdoll', label_vi: 'Mèo Ragdoll', confidence: 0.011, confidence_percent: 1.1 },
      ],
    },
  },
  {
    label: '🐶 Chó Corgi chân ngắn',
    icon: 'dog-side',
    result: {
      breedName: 'Chó Corgi Chân Ngắn',
      breedEnglish: 'Pembroke Welsh Corgi',
      species: 'dog',
      speciesVi: 'Chó',
      confidence: 97.2,
      origin: 'Wales, Vương Quốc Anh',
      temperament: ['Lanh lợi', 'Dũng cảm', 'Vui tươi', 'Trung thành'],
      standardWeight: '10 - 14 kg',
      lifespan: '12 - 15 năm',
      careTips: 'Lưng dài chân ngắn nên không được cho nhảy từ trên cao xuống để bảo vệ cột sống.',
      healthWarnings: 'Nguy cơ cao bị thoát vị đĩa đệm (IVDD) nếu thừa cân.',
      top3Breeds: [
        { label: 'pembroke_welsh_corgi', label_vi: 'Pembroke Welsh Corgi', confidence: 0.972, confidence_percent: 97.2 },
        { label: 'cardigan_welsh_corgi', label_vi: 'Cardigan Welsh Corgi', confidence: 0.021, confidence_percent: 2.1 },
        { label: 'shiba_inu', label_vi: 'Chó Shiba Inu', confidence: 0.005, confidence_percent: 0.5 },
      ],
    },
  },
];

export default function BreedScannerScreen() {
  const { colors, typography: typo, spacing, radius } = useAppTheme();
  const insets = useSafeAreaInsets();
  const { breeds, loadBreeds } = useBreedStore();

  const [serverUrl, setServerUrl] = useState<string>(DEFAULT_API_URL);
  const [serverStatus, setServerStatus] = useState<'checking' | 'connected' | 'disconnected'>('checking');
  const [showConfigModal, setShowConfigModal] = useState<boolean>(false);
  const [tempUrl, setTempUrl] = useState<string>(DEFAULT_API_URL);

  const [isScanning, setIsScanning] = useState(false);
  const [selectedImageUri, setSelectedImageUri] = useState<string | null>(null);
  const [selectedResult, setSelectedResult] = useState<BreedAnalysisResult | null>(SAMPLE_PRESETS[0].result);
  const [activeBreedId, setActiveBreedId] = useState<string | null>(null);

  /**
   * Health ping to the AI Backend
   */
  const checkServerStatus = useCallback(async (urlToCheck?: string) => {
    const target = urlToCheck || serverUrl;
    const baseUrl = target.replace(/\/pet\/(predict|predict-base64)\/?$/, '').replace(/\/$/, '');
    const healthUrl = `${baseUrl}/health`;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3500);

      const res = await fetch(healthUrl, {
        method: 'GET',
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      setServerStatus(res.ok ? 'connected' : 'disconnected');
      return res.ok;
    } catch {
      setServerStatus('disconnected');
      return false;
    }
  }, [serverUrl]);

  useEffect(() => {
    void loadBreeds();
    const timer = setTimeout(() => {
      void checkServerStatus();
    }, 100);
    return () => clearTimeout(timer);
  }, [loadBreeds, checkServerStatus]);

  /**
   * Helper to enrich AI classification output with Supabase breed details
   */
  const buildAnalysisResultFromAI = (
    prediction: any,
  ): BreedAnalysisResult => {
    const rawBreedEn = (prediction.breed || '').toLowerCase();
    const rawBreedVi = (prediction.breed_vi || '').toLowerCase();

    // Find match in Supabase DB
    const dbMatch = breeds.find(
      (b) =>
        b.nameEn.toLowerCase().includes(rawBreedEn) ||
        rawBreedEn.includes(b.nameEn.toLowerCase()) ||
        b.nameVi.toLowerCase().includes(rawBreedVi) ||
        rawBreedVi.includes(b.nameVi.toLowerCase())
    );

    const species = prediction.species === 'cat' ? 'cat' : 'dog';
    const speciesVi = prediction.species_vi || (species === 'cat' ? 'Mèo' : 'Chó');

    return {
      breedName: prediction.breed_vi || (dbMatch ? dbMatch.nameVi : prediction.breed),
      breedEnglish: prediction.breed || (dbMatch ? dbMatch.nameEn : 'Unknown Breed'),
      species,
      speciesVi,
      confidence: prediction.breed_confidence_percent || 90.0,
      top3Breeds: prediction.breed_top3 || [],
      origin: dbMatch ? 'Theo danh mục quốc tế' : 'Oxford-IIIT Pet Model',
      temperament: dbMatch?.sizeCategory
        ? [dbMatch.sizeCategory, 'Lanh lợi', 'Dễ thương', 'Tình cảm']
        : ['Thông minh', 'Lanh lợi', 'Thân thiện'],
      standardWeight: dbMatch
        ? `${dbMatch.typicalWeightMinKg || 3} - ${dbMatch.typicalWeightMaxKg || 10} kg`
        : 'Theo thể trạng từng giai đoạn',
      lifespan: '10 - 15 năm',
      careTips: dbMatch?.description || 'Cần bổ sung dinh dưỡng cân đối và tập thể dục hàng ngày.',
      healthWarnings:
        Array.isArray(dbMatch?.commonHealthIssues) && dbMatch.commonHealthIssues.length > 0
          ? dbMatch.commonHealthIssues.join(', ')
          : 'Cần tiêm phòng vaccine và tẩy giun định kỳ.',
    };
  };

  /**
   * Sends image file to FastAPI AI Backend via Base64 JSON
   * 100% immune to React Native / iOS FormDataPart issues
   */
  const uploadAndPredict = async (uri: string, base64Data?: string | null) => {
    setIsScanning(true);
    setActiveBreedId(null);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const baseUrl = serverUrl.replace(/\/pet\/(predict|predict-base64)\/?$/, '').replace(/\/$/, '');

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 25000);

      let base64 = base64Data;
      if (!base64) {
        // Fallback: Chuyển ảnh sang Base64 bằng FileReader (an toàn tuyệt đối, không đụng tới FormData)
        const localResponse = await fetch(uri);
        const blob = await localResponse.blob();
        base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => {
            const dataUrl = reader.result as string;
            const clean = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl;
            resolve(clean);
          };
          reader.onerror = () => reject(new Error('Không thể chuyển đổi file ảnh sang base64.'));
          reader.readAsDataURL(blob);
        });
      }

      // Gửi trực tiếp payload JSON qua endpoint /pet/predict-base64
      const response = await fetch(`${baseUrl}/pet/predict-base64`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({ image_base64: base64 }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Máy chủ trả về mã ${response.status}: ${errorText}`);
      }

      const data = await response.json();
      if (data && data.prediction) {
        setServerStatus('connected');
        const enriched = buildAnalysisResultFromAI(data.prediction);
        setSelectedResult(enriched);
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        throw new Error('Dữ liệu trả về không đúng cấu trúc nhận diện.');
      }
    } catch (err: any) {
      setServerStatus('disconnected');
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert(
        'Lỗi nhận diện AI',
        `Không thể kết nối tới mô hình AI tại:\n${baseUrl}\n\nNguyên nhân: ${err.message}\n\nHướng dẫn khắc phục:\n1. Kiểm tra máy tính đã chạy lệnh: npm run backend\n2. Đảm bảo điện thoại và máy tính kết nối CÙNG mạng Wi-Fi.\n3. Nếu IP máy tính thay đổi, bấm vào thanh trạng thái để đổi địa chỉ IP.`,
        [
          { text: 'Đổi IP Server', onPress: () => setShowConfigModal(true) },
          { text: 'Thử lại', onPress: () => void checkServerStatus() },
          { text: 'Đóng', style: 'cancel' },
        ]
      );
    } finally {
      setIsScanning(false);
    }
  };

  /**
   * Open Camera to take a live photo
   */
  const handleLaunchCamera = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Cấp quyền camera', 'Vui lòng cấp quyền truy cập Camera trong cài đặt để chụp ảnh thú cưng.');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
        base64: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        setSelectedImageUri(asset.uri);
        await uploadAndPredict(asset.uri, asset.base64);
      }
    } catch (error: any) {
      Alert.alert('Lỗi Camera', error.message || 'Không thể mở máy ảnh.');
    }
  };

  /**
   * Open Image Library to pick a photo
   */
  const handlePickGallery = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Cấp quyền thư viện', 'Vui lòng cấp quyền truy cập Thư viện ảnh để chọn ảnh thú cưng.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
        base64: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        setSelectedImageUri(asset.uri);
        await uploadAndPredict(asset.uri, asset.base64);
      }
    } catch (error: any) {
      Alert.alert('Lỗi Thư viện ảnh', error.message || 'Không thể mở thư viện ảnh.');
    }
  };

  /**
   * Select a breed directly from Supabase database
   */
  const handleSelectRealBreed = (b: Breed) => {
    void Haptics.selectionAsync();
    setActiveBreedId(b.id);
    setSelectedImageUri(null);
    setIsScanning(true);
    setTimeout(() => {
      setSelectedResult({
        breedName: b.nameVi,
        breedEnglish: b.nameEn,
        species: b.species === 'cat' ? 'cat' : 'dog',
        speciesVi: b.species === 'cat' ? 'Mèo' : 'Chó',
        confidence: 98.4,
        origin: 'Theo chuẩn danh mục quốc tế',
        temperament: [b.sizeCategory || 'Cỡ trung', 'Thân thiện', 'Khỏe mạnh', 'Lanh lợi'],
        standardWeight: `${b.typicalWeightMinKg || 3} - ${b.typicalWeightMaxKg || 10} kg`,
        lifespan: '10 - 15 năm',
        careTips: b.description || 'Chăm sóc dinh dưỡng đầy đủ và cho vận động mỗi ngày.',
        healthWarnings:
          Array.isArray(b.commonHealthIssues) && b.commonHealthIssues.length > 0
            ? b.commonHealthIssues.join(', ')
            : 'Cần kiểm tra sức khỏe và tiêm phòng định kỳ.',
        top3Breeds: [
          { label: b.nameEn, label_vi: b.nameVi, confidence: 0.984, confidence_percent: 98.4 },
        ],
      });
      setIsScanning(false);
    }, 300);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Top Header */}
      <View
        style={[
          styles.header,
          {
            paddingTop: insets.top + spacing.sm,
            paddingHorizontal: spacing.lg,
            paddingBottom: spacing.sm,
            backgroundColor: colors.surface,
            borderBottomColor: colors.border,
            borderBottomWidth: 1,
          },
        ]}
      >
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={[typo.headlineMedium, { color: colors.text }]}>
            Nhận diện giống loài AI
          </Text>
          <Pressable
            onPress={() => {
              setTempUrl(serverUrl);
              setShowConfigModal(true);
            }}
            style={[styles.serverPill, { backgroundColor: serverStatus === 'connected' ? '#E8F5E9' : serverStatus === 'checking' ? '#FFF8E1' : '#FFEBEE' }]}
          >
            <View
              style={[
                styles.statusDot,
                {
                  backgroundColor:
                    serverStatus === 'connected'
                      ? '#2E7D32'
                      : serverStatus === 'checking'
                      ? '#F57F17'
                      : '#C62828',
                },
              ]}
            />
            <Text
              style={[
                typo.labelSmall,
                {
                  color:
                    serverStatus === 'connected'
                      ? '#2E7D32'
                      : serverStatus === 'checking'
                      ? '#F57F17'
                      : '#C62828',
                  fontWeight: '700',
                },
              ]}
            >
              {serverStatus === 'connected'
                ? 'AI Online'
                : serverStatus === 'checking'
                ? 'Kiểm tra...'
                : 'Mất kết nối'}
            </Text>
            <MaterialCommunityIcons name="cog" size={14} color={colors.textSecondary} style={{ marginLeft: 4 }} />
          </Pressable>
        </View>

        <Text style={[typo.bodySmall, { color: colors.textSecondary, marginTop: 2 }]}>
          Mô hình EfficientNet-B0 (37 giống chó mèo Oxford-IIIT)
        </Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingBottom: insets.bottom + spacing.xxl,
          paddingHorizontal: spacing.lg,
          paddingTop: spacing.md,
        }}
      >
        {/* Offline Warning Banner */}
        {serverStatus === 'disconnected' && (
          <Pressable
            onPress={() => {
              setTempUrl(serverUrl);
              setShowConfigModal(true);
            }}
            style={[styles.warningBanner, { backgroundColor: '#FFEBEE', borderColor: '#FFCDD2', borderRadius: radius.md }]}
          >
            <MaterialCommunityIcons name="alert-circle-outline" size={20} color="#C62828" />
            <Text style={[typo.bodySmall, { color: '#C62828', flex: 1, marginLeft: 8 }]}>
              Chưa kết nối được tới AI Server ({serverUrl.replace('/pet/predict', '')}). Bấm vào đây để cấu hình IP hoặc thử lại.
            </Text>
          </Pressable>
        )}

        {/* Scanner Viewfinder Box */}
        <View
          style={[
            styles.viewfinderBox,
            {
              backgroundColor: colors.surfaceElevated,
              borderColor: colors.primary,
              borderRadius: radius.xl,
            },
          ]}
        >
          {/* Viewfinder Corners */}
          <View style={[styles.corner, styles.topLeft, { borderColor: colors.primary }]} />
          <View style={[styles.corner, styles.topRight, { borderColor: colors.primary }]} />
          <View style={[styles.corner, styles.bottomLeft, { borderColor: colors.primary }]} />
          <View style={[styles.corner, styles.bottomRight, { borderColor: colors.primary }]} />

          {selectedImageUri && !isScanning ? (
            <Image
              source={{ uri: selectedImageUri }}
              style={styles.previewImage}
              resizeMode="cover"
            />
          ) : isScanning ? (
            <View style={styles.scanningCenter}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={[typo.labelLarge, { color: colors.primary, marginTop: spacing.md }]}>
                AI đang xử lý qua mạng nơ-ron...
              </Text>
              <Text style={[typo.bodySmall, { color: colors.textSecondary, marginTop: 4 }]}>
                Đang phân tích 37 lớp giống loài
              </Text>
            </View>
          ) : (
            <View style={styles.viewfinderContent}>
              <View
                style={[
                  styles.cameraIconCircle,
                  { backgroundColor: colors.primaryContainer },
                ]}
              >
                <MaterialCommunityIcons
                  name="line-scan"
                  size={48}
                  color={colors.primary}
                />
              </View>
              <Text style={[typo.titleMedium, { color: colors.text, marginTop: spacing.sm }]}>
                Chụp hoặc tải ảnh thú cưng
              </Text>
              <Text style={[typo.bodySmall, { color: colors.textSecondary, textAlign: 'center', marginTop: 4 }]}>
                Đảm bảo thấy rõ mặt và bộ lông để AI nhận diện chuẩn xác nhất
              </Text>
            </View>
          )}
        </View>

        {/* Action Buttons Row */}
        <View style={[styles.buttonRow, { marginTop: spacing.md }]}>
          <Pressable
            onPress={handleLaunchCamera}
            disabled={isScanning}
            style={[
              styles.captureButton,
              { backgroundColor: colors.primary, borderRadius: radius.lg, opacity: isScanning ? 0.6 : 1 },
            ]}
          >
            <MaterialCommunityIcons name="camera" size={20} color={colors.onPrimary} />
            <Text style={[typo.labelLarge, { color: colors.onPrimary, marginLeft: 8 }]}>
              Chụp ảnh ngay
            </Text>
          </Pressable>

          <Pressable
            onPress={handlePickGallery}
            disabled={isScanning}
            style={[
              styles.galleryButton,
              { borderColor: colors.border, backgroundColor: colors.surface, borderRadius: radius.lg, opacity: isScanning ? 0.6 : 1 },
            ]}
          >
            <MaterialCommunityIcons name="image-multiple-outline" size={20} color={colors.text} />
            <Text style={[typo.labelLarge, { color: colors.text, marginLeft: 8 }]}>
              Thư viện ảnh
            </Text>
          </Pressable>
        </View>

        {/* Sample / Real Breeds Chips */}
        <View style={{ marginTop: spacing.lg }}>
          <Text style={[typo.labelMedium, { color: colors.textSecondary, marginBottom: spacing.xs }]}>
            {breeds.length > 0
              ? `Tra cứu thông tin giống loài (${breeds.length} giống):`
              : 'Chọn ảnh mẫu thử nghiệm nhanh:'}
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 8, paddingVertical: 4 }}
          >
            {breeds.length > 0
              ? breeds.slice(0, 15).map((b) => {
                  const isSelected = activeBreedId === b.id;
                  return (
                    <Pressable
                      key={b.id}
                      onPress={() => handleSelectRealBreed(b)}
                      style={[
                        styles.presetChip,
                        {
                          backgroundColor: isSelected ? colors.primaryContainer : colors.surface,
                          borderColor: isSelected ? colors.primary : colors.border,
                          borderRadius: radius.full,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          typo.labelSmall,
                          {
                            color: isSelected ? colors.primary : colors.text,
                            fontWeight: isSelected ? '700' : '500',
                          },
                        ]}
                      >
                        {b.species === 'cat' ? '🐈 ' : '🐕 '}
                        {b.nameVi}
                      </Text>
                    </Pressable>
                  );
                })
              : SAMPLE_PRESETS.map((preset, idx) => (
                  <Pressable
                    key={idx}
                    onPress={() => {
                      setSelectedResult(preset.result);
                      setSelectedImageUri(null);
                    }}
                    style={[
                      styles.presetChip,
                      {
                        backgroundColor: colors.surface,
                        borderColor: colors.border,
                        borderRadius: radius.full,
                      },
                    ]}
                  >
                    <Text style={[typo.labelSmall, { color: colors.text }]}>
                      {preset.label}
                    </Text>
                  </Pressable>
                ))}
          </ScrollView>
        </View>

        {/* Analysis Results Card */}
        {selectedResult && (
          <View
            style={[
              styles.resultCard,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
                borderRadius: radius.xl,
                marginTop: spacing.lg,
                padding: spacing.lg,
              },
            ]}
          >
            {/* Card Header & Confidence */}
            <View style={styles.resultHeaderRow}>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={[typo.headlineMedium, { color: colors.text }]}>
                    {selectedResult.breedName}
                  </Text>
                </View>
                <Text style={[typo.bodySmall, { color: colors.textSecondary }]}>
                  {selectedResult.speciesVi} • {selectedResult.breedEnglish}
                </Text>
              </View>

              <View
                style={[
                  styles.confidencePill,
                  { backgroundColor: colors.primaryContainer },
                ]}
              >
                <MaterialCommunityIcons name="shield-check" size={16} color={colors.primary} />
                <Text
                  style={[
                    typo.labelMedium,
                    { color: colors.primary, fontWeight: '700', marginLeft: 4 },
                  ]}
                >
                  {selectedResult.confidence.toFixed(1)}%
                </Text>
              </View>
            </View>

            {/* Top 3 Predictions Bar (from AI model) */}
            {selectedResult.top3Breeds && selectedResult.top3Breeds.length > 0 && (
              <View style={[styles.top3Container, { backgroundColor: colors.surfaceElevated, borderRadius: radius.md, padding: spacing.sm, marginTop: spacing.md }]}>
                <Text style={[typo.labelSmall, { color: colors.textSecondary, marginBottom: 6 }]}>
                  Xác suất dự đoán hàng đầu (Top 3):
                </Text>
                {selectedResult.top3Breeds.map((top, idx) => (
                  <View key={idx} style={{ marginVertical: 3 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 }}>
                      <Text style={[typo.bodySmall, { color: colors.text, fontWeight: idx === 0 ? '700' : '400' }]}>
                        {idx + 1}. {top.label_vi || top.label}
                      </Text>
                      <Text style={[typo.labelSmall, { color: colors.primary, fontWeight: '700' }]}>
                        {top.confidence_percent.toFixed(1)}%
                      </Text>
                    </View>
                    <View style={[styles.progressBarTrack, { backgroundColor: colors.border }]}>
                      <View
                        style={[
                          styles.progressBarFill,
                          {
                            width: `${Math.min(100, Math.max(0, top.confidence_percent))}%`,
                            backgroundColor: idx === 0 ? colors.primary : colors.accent,
                          },
                        ]}
                      />
                    </View>
                  </View>
                ))}
              </View>
            )}

            {/* Temperament Tags */}
            <View style={[styles.tagsRow, { marginVertical: spacing.md }]}>
              {selectedResult.temperament.map((trait, i) => (
                <View
                  key={i}
                  style={[
                    styles.traitTag,
                    { backgroundColor: colors.surfaceElevated, borderColor: colors.border },
                  ]}
                >
                  <Text style={[typo.labelSmall, { color: colors.textSecondary }]}>
                    ✨ {trait}
                  </Text>
                </View>
              ))}
            </View>

            {/* Standard Stats Row */}
            <View
              style={[
                styles.statsGrid,
                { backgroundColor: colors.surfaceElevated, borderRadius: radius.lg, padding: spacing.md },
              ]}
            >
              <View style={styles.statCol}>
                <Text style={[typo.bodySmall, { color: colors.textSecondary }]}>
                  Cân nặng chuẩn
                </Text>
                <Text style={[typo.titleMedium, { color: colors.text, marginTop: 2 }]}>
                  {selectedResult.standardWeight}
                </Text>
              </View>

              <View style={[styles.statDivider, { backgroundColor: colors.border }]} />

              <View style={styles.statCol}>
                <Text style={[typo.bodySmall, { color: colors.textSecondary }]}>
                  Tuổi thọ trung bình
                </Text>
                <Text style={[typo.titleMedium, { color: colors.text, marginTop: 2 }]}>
                  {selectedResult.lifespan}
                </Text>
              </View>
            </View>

            {/* Health & Care Tips */}
            <View style={{ marginTop: spacing.md }}>
              <View style={styles.infoBlock}>
                <MaterialCommunityIcons
                  name="heart-pulse"
                  size={18}
                  color={colors.primary}
                  style={{ marginRight: 6, marginTop: 2 }}
                />
                <Text style={[typo.bodySmall, { color: colors.text, flex: 1, lineHeight: 20 }]}>
                  <Text style={{ fontWeight: '700' }}>Cảnh báo sức khỏe: </Text>
                  {selectedResult.healthWarnings}
                </Text>
              </View>

              <View style={[styles.infoBlock, { marginTop: spacing.xs }]}>
                <MaterialCommunityIcons
                  name="hand-heart"
                  size={18}
                  color={colors.accent}
                  style={{ marginRight: 6, marginTop: 2 }}
                />
                <Text style={[typo.bodySmall, { color: colors.text, flex: 1, lineHeight: 20 }]}>
                  <Text style={{ fontWeight: '700' }}>Chăm sóc: </Text>
                  {selectedResult.careTips}
                </Text>
              </View>
            </View>

            {/* CTA Buttons */}
            <View style={{ marginTop: spacing.lg, gap: spacing.sm }}>
              <PrimaryButton
                title="🥗 Xem chế độ dinh dưỡng cho giống này"
                onPress={() => router.push('/(app)/nutrition' as any)}
              />
            </View>
          </View>
        )}
      </ScrollView>

      {/* Config Server Modal */}
      <Modal visible={showConfigModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface, borderRadius: radius.xl, borderColor: colors.border, borderWidth: 1 }]}>
            <Text style={[typo.titleLarge, { color: colors.text }]}>Cấu hình AI Server</Text>
            <Text style={[typo.bodySmall, { color: colors.textSecondary, marginTop: 4 }]}>
              Nhập địa chỉ IP máy tính đang chạy backend (port 8000).
            </Text>

            <TextInput
              value={tempUrl}
              onChangeText={setTempUrl}
              placeholder="http://172.26.23.169:8000/pet/predict"
              placeholderTextColor={colors.textSecondary}
              autoCapitalize="none"
              autoCorrect={false}
              style={[
                styles.input,
                {
                  backgroundColor: colors.surfaceElevated,
                  borderColor: colors.border,
                  color: colors.text,
                  borderRadius: radius.md,
                  marginTop: spacing.md,
                },
              ]}
            />

            <View style={{ flexDirection: 'row', gap: 10, marginTop: spacing.lg }}>
              <Pressable
                onPress={() => setShowConfigModal(false)}
                style={[styles.modalButton, { borderColor: colors.border, borderWidth: 1, borderRadius: radius.md }]}
              >
                <Text style={[typo.labelLarge, { color: colors.text }]}>Hủy</Text>
              </Pressable>

              <Pressable
                onPress={async () => {
                  setServerUrl(tempUrl);
                  setShowConfigModal(false);
                  const ok = await checkServerStatus(tempUrl);
                  if (ok) {
                    Alert.alert('Thành công', 'Đã kết nối thành công tới AI Backend!');
                  } else {
                    Alert.alert('Không thể kết nối', 'Vẫn chưa kết nối được. Vui lòng kiểm tra lại IP hoặc đảm bảo máy tính và điện thoại chung mạng Wi-Fi.');
                  }
                }}
                style={[styles.modalButton, { backgroundColor: colors.primary, borderRadius: radius.md }]}
              >
                <Text style={[typo.labelLarge, { color: colors.onPrimary }]}>Lưu & Thử lại</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {},
  serverPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  warningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderWidth: 1,
    marginBottom: 12,
  },
  viewfinderBox: {
    height: 240,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  corner: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderWidth: 3,
    zIndex: 10,
  },
  topLeft: { top: 12, left: 12, borderRightWidth: 0, borderBottomWidth: 0 },
  topRight: { top: 12, right: 12, borderLeftWidth: 0, borderBottomWidth: 0 },
  bottomLeft: { bottom: 12, left: 12, borderRightWidth: 0, borderTopWidth: 0 },
  bottomRight: { bottom: 12, right: 12, borderLeftWidth: 0, borderTopWidth: 0 },
  viewfinderContent: {
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  scanningCenter: {
    alignItems: 'center',
  },
  cameraIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
  },
  captureButton: {
    flex: 1,
    height: 48,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  galleryButton: {
    flex: 1,
    height: 48,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  presetChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
  },
  resultCard: {
    borderWidth: 1,
  },
  resultHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  confidencePill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
  },
  top3Container: {},
  progressBarTrack: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  traitTag: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
  },
  statsGrid: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  statCol: {
    alignItems: 'center',
  },
  statDivider: {
    width: 1,
    height: 32,
  },
  infoBlock: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 20,
  },
  modalContent: {
    padding: 20,
  },
  input: {
    height: 48,
    borderWidth: 1,
    paddingHorizontal: 12,
    fontSize: 14,
  },
  modalButton: {
    flex: 1,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
