/**
 * PawCare AI — Notification Service
 *
 * Manages local push notifications for vaccination reminders, preventive care,
 * and upcoming deadlines.
 *
 * Schedule rule:
 * 1. 1 day before due date (at 09:00 AM)
 * 2. On the exact due date (at 08:00 AM)
 */
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { AndroidImportance } from 'expo-notifications';
import type { VaccinationType } from '@/domain/entities/Vaccination';

// Configure notification behavior when app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

const TYPE_VIETNAMESE: Record<VaccinationType, string> = {
  vaccine: 'tiêm vắc-xin',
  deworming: 'uống thuốc tẩy giun',
  flea_tick: 'phòng ngừa ve rận & giun tim',
};

export class NotificationService {
  /**
   * Request push notification permissions from user
   */
  static async requestPermissions(): Promise<boolean> {
    if (Platform.OS === 'web') return false;

    try {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('vaccinations', {
          name: 'Nhắc lịch tiêm chủng & Phòng bệnh',
          importance: AndroidImportance.HIGH,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#10B981',
          sound: 'default',
        });
      }

      return finalStatus === 'granted';
    } catch {
      return false;
    }
  }

  /**
   * Schedule 2 notifications for a vaccination reminder:
   * 1. One day before at 09:00 AM
   * 2. On the due date at 08:00 AM
   */
  static async scheduleVaccinationAlerts(params: {
    recordId: string;
    petId: string;
    petName: string;
    vaccinationName: string;
    type: VaccinationType;
    dueDate: string; // YYYY-MM-DD
  }): Promise<void> {
    if (Platform.OS === 'web') return;

    try {
      const hasPermission = await this.requestPermissions();
      if (!hasPermission) return;

      const [yearStr, monthStr, dayStr] = params.dueDate.split('-');
      const year = parseInt(yearStr, 10);
      const month = parseInt(monthStr, 10) - 1; // 0-indexed
      const day = parseInt(dayStr, 10);

      const typeVi = TYPE_VIETNAMESE[params.type] || 'tiêm phòng';
      const nowMs = Date.now();

      // 1. Alert 1 DAY BEFORE (at 09:00 AM)
      const oneDayBefore = new Date(year, month, day - 1, 9, 0, 0);
      if (oneDayBefore.getTime() > nowMs) {
        await Notifications.scheduleNotificationAsync({
          identifier: `vaccine_${params.recordId}_day_before`,
          content: {
            title: `🔔 Nhắc lịch ngày mai: ${params.petName}`,
            body: `Bé ${params.petName} có lịch ${typeVi} "${params.vaccinationName}" vào ngày mai (${params.dueDate}). Bạn hãy chuẩn bị sổ sức khỏe nhé!`,
            data: {
              recordId: params.recordId,
              petId: params.petId,
              type: 'vaccine_day_before',
            },
            sound: true,
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date: oneDayBefore,
            channelId: 'vaccinations',
          },
        });
      }

      // 2. Alert ON THE DUE DATE (at 08:00 AM)
      const dueDayMorning = new Date(year, month, day, 8, 0, 0);
      if (dueDayMorning.getTime() > nowMs) {
        await Notifications.scheduleNotificationAsync({
          identifier: `vaccine_${params.recordId}_due_today`,
          content: {
            title: `🚨 Hôm nay là lịch tiêm: ${params.petName}!`,
            body: `Hôm nay là hạn ${typeVi} "${params.vaccinationName}" của bé ${params.petName}. Đừng quên đưa bé đến phòng khám nhé!`,
            data: {
              recordId: params.recordId,
              petId: params.petId,
              type: 'vaccine_due_today',
            },
            sound: true,
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date: dueDayMorning,
            channelId: 'vaccinations',
          },
        });
      }
    } catch {
      // Notification scheduling fails gracefully without blocking UX
    }
  }

  /**
   * Cancel scheduled notifications for a given record
   */
  static async cancelVaccinationAlerts(recordId: string): Promise<void> {
    if (Platform.OS === 'web') return;

    try {
      await Notifications.cancelScheduledNotificationAsync(`vaccine_${recordId}_day_before`);
      await Notifications.cancelScheduledNotificationAsync(`vaccine_${recordId}_due_today`);
    } catch {
      // Ignore cancellation errors
    }
  }
}
