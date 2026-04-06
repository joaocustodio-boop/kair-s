import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { store, today } from './store.js';

function isNativePlatform() {
  return Capacitor.getPlatform() !== 'web';
}

function parseEventDateTime(dateStr, timeStr) {
  const safeDate = String(dateStr || '').trim();
  const safeTime = String(timeStr || '').trim() || '09:00';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(safeDate)) return null;
  if (!/^\d{2}:\d{2}$/.test(safeTime)) return null;
  const d = new Date(`${safeDate}T${safeTime}:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function nextMorningAt(hour = 9, minute = 0) {
  const now = new Date();
  const target = new Date(now);
  target.setHours(hour, minute, 0, 0);
  if (target <= now) {
    target.setDate(target.getDate() + 1);
  }
  return target;
}

export async function syncMobileNotifications() {
  if (!isNativePlatform()) return;

  const permission = await LocalNotifications.checkPermissions();
  if (permission.display !== 'granted') {
    const requested = await LocalNotifications.requestPermissions();
    if (requested.display !== 'granted') {
      return;
    }
  }

  const now = new Date();
  const scheduled = [];

  const { events = [] } = store.get('agenda');
  events
    .slice(0, 200)
    .forEach((event, index) => {
      const startAt = parseEventDateTime(event.date, event.startTime);
      if (!startAt || startAt <= now) return;

      const notifyAt = new Date(startAt.getTime() - (30 * 60 * 1000));
      const scheduleTime = notifyAt > now ? notifyAt : startAt;
      if (scheduleTime <= now) return;

      scheduled.push({
        id: 10000 + index,
        title: 'Compromisso da familia',
        body: `${String(event.title || 'Compromisso')} as ${String(event.startTime || '--:--')}`,
        schedule: { at: scheduleTime, allowWhileIdle: true },
      });
    });

  const { tasks = [] } = store.get('lembretes');
  const pending = tasks.filter((task) => !task.completed);
  if (pending.length > 0) {
    scheduled.push({
      id: 20001,
      title: 'Tarefas pendentes',
      body: `Voce tem ${pending.length} tarefa(s) pendente(s) da familia.`,
      schedule: { at: nextMorningAt(9, 0), allowWhileIdle: true },
    });
  }

  const todayEvents = events.filter((event) => event.date === today());
  if (todayEvents.length > 0) {
    scheduled.push({
      id: 20002,
      title: 'Agenda de hoje',
      body: `${todayEvents.length} compromisso(s) marcado(s) para hoje.`,
      schedule: { at: nextMorningAt(8, 0), allowWhileIdle: true },
    });
  }

  const pendingExisting = await LocalNotifications.getPending();
  const existingNotifications = Array.isArray(pendingExisting?.notifications)
    ? pendingExisting.notifications
    : [];

  if (existingNotifications.length > 0) {
    await LocalNotifications.cancel({
      notifications: existingNotifications.map((item) => ({ id: item.id })),
    });
  }

  if (scheduled.length > 0) {
    await LocalNotifications.schedule({ notifications: scheduled.slice(0, 32) });
  }
}
