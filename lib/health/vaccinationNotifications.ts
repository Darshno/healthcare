import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { VaccinationRecord, VACCINES } from './types';

// We map vaccine ID to a human readable label
const getVaccineLabel = (id: string) => {
  const v = VACCINES.find(v => v.id === id);
  return v ? v.label : id;
};

// Web fallback via service worker
const scheduleWebNotification = (record: VaccinationRecord, patientName: string, daysBefore: number, fireAt: Date) => {
  if (Platform.OS !== 'web') return;
  if (!('serviceWorker' in navigator)) return;

  const msUntilFire = fireAt.getTime() - Date.now();
  if (msUntilFire < 0) return; // Already passed

  navigator.serviceWorker.ready.then(registration => {
    // Send a message to the SW to schedule this
    registration.active?.postMessage({
      type: 'SCHEDULE_VACCINE',
      payload: {
        recordId: record.id,
        patientName,
        vaccineName: getVaccineLabel(record.vaccineId),
        daysBefore,
        fireAtMs: fireAt.getTime()
      }
    });
  });
};

const cancelWebNotification = (recordId: string) => {
  if (Platform.OS !== 'web') return;
  if (!('serviceWorker' in navigator)) return;

  navigator.serviceWorker.ready.then(registration => {
    registration.active?.postMessage({
      type: 'CANCEL_VACCINE',
      payload: { recordId }
    });
  });
};

export const scheduleVaccineReminders = async (record: VaccinationRecord, patientName: string) => {
  if (record.administered) return;

  const due = new Date(record.dueDate);
  // We want to fire at 9:00 AM local time
  due.setHours(9, 0, 0, 0);

  const targets = [3, 1]; // 3 days before, 1 day before

  for (const days of targets) {
    if (record.notifiedDays?.includes(days)) continue;

    const fireAt = new Date(due);
    fireAt.setDate(fireAt.getDate() - days);

    if (fireAt.getTime() <= Date.now()) continue; // Past

    const title = `Vaccination Reminder: ${patientName}`;
    const body = `${getVaccineLabel(record.vaccineId)} is due in ${days} day${days > 1 ? 's' : ''}. Please contact the parents.`;

    if (Platform.OS === 'web') {
      scheduleWebNotification(record, patientName, days, fireAt);
    } else {
      await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          data: { recordId: record.id, type: 'vaccine' },
        },
        trigger: { date: fireAt } as Notifications.NotificationTriggerInput,
        identifier: `vac-${record.id}-${days}`
      });
    }
  }
};

export const cancelVaccineReminder = async (recordId: string) => {
  if (Platform.OS === 'web') {
    cancelWebNotification(recordId);
  } else {
    await Notifications.cancelScheduledNotificationAsync(`vac-${recordId}-3`);
    await Notifications.cancelScheduledNotificationAsync(`vac-${recordId}-1`);
  }
};

export const refreshAllPendingReminders = async (records: VaccinationRecord[], patients: { id: string; name: string }[]) => {
  for (const record of records) {
    if (!record.administered) {
      const patient = patients.find(p => p.id === record.patientId);
      if (patient) {
        await scheduleVaccineReminders(record, patient.name);
      }
    }
  }
};
