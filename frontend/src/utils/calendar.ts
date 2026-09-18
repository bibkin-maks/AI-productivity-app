import { Event } from '../types';

const DAY_MS = 1000 * 60 * 60 * 24;

// Generates recurring event instances for the current calendar view window only (lazy generation).
export const generateRecurringEvents = (baseEvent: Event, viewStart: Date, viewEnd: Date): Event[] => {
    if (!baseEvent.recurrence || baseEvent.recurrence === 'none') return [];

    const instances: Event[] = [];
    const recurrenceEnd = baseEvent.recurrenceEnd ? new Date(baseEvent.recurrenceEnd) : null;
    const eventStart = new Date(baseEvent.start);
    const duration = new Date(baseEvent.end).getTime() - eventStart.getTime();
    const interval = Math.max(1, baseEvent.recurrenceInterval ?? 1);
    const recurrenceDays: number[] = baseEvent.recurrenceDays ?? [];

    if (!viewStart || !viewEnd) return [];
    if (eventStart > viewEnd) return [];
    if (recurrenceEnd && recurrenceEnd < viewStart) return [];

    const MAX_VIEW_INSTANCES = 200;

    // ----------------------------------------------------------------
    // 'weekdays' mode — iterate day-by-day from base start
    // ----------------------------------------------------------------
    if (baseEvent.recurrence === 'weekdays') {
        if (recurrenceDays.length === 0) return [];

        // Start scanning from eventStart+1 (base event rendered separately)
        const cursor = new Date(eventStart);
        cursor.setDate(cursor.getDate() + 1);

        // Jump ahead to viewStart if cursor is far behind
        if (cursor < viewStart) {
            const daysBehind = Math.floor((viewStart.getTime() - cursor.getTime()) / DAY_MS);
            cursor.setDate(cursor.getDate() + Math.max(0, daysBehind - 7));
        }

        let safety = 0;
        while (instances.length <= MAX_VIEW_INSTANCES && safety++ < 5000) {
            if (recurrenceEnd && cursor > recurrenceEnd) break;
            if (cursor > viewEnd) break;

            const dow = cursor.getDay(); // 0=Sun…6=Sat
            if (recurrenceDays.includes(dow) && cursor >= viewStart) {
                const dateStr = cursor.toISOString().split('T')[0];
                const isExcepted = (baseEvent.exceptDates || []).includes(dateStr);
                if (!isExcepted) {
                    instances.push({
                        ...baseEvent,
                        id: `${baseEvent.id}_recur_${cursor.getTime()}`,
                        start: new Date(cursor),
                        end: new Date(cursor.getTime() + duration),
                        isInstance: true,
                    } as Event);
                }
            }
            cursor.setDate(cursor.getDate() + 1);
        }
        return instances;
    }

    // ----------------------------------------------------------------
    // All other interval-based modes
    // ----------------------------------------------------------------
    let i = 1; // Start at 1 to skip base event

    // Jump ahead for daily / every_n_weeks / weekly / biweekly
    if ((baseEvent.recurrence === 'daily' || baseEvent.recurrence === 'weekly' ||
        baseEvent.recurrence === 'biweekly' || baseEvent.recurrence === 'every_n_weeks') &&
        eventStart < viewStart) {
        let stepDays = 1;
        if (baseEvent.recurrence === 'weekly') stepDays = 7;
        else if (baseEvent.recurrence === 'biweekly') stepDays = 14;
        else if (baseEvent.recurrence === 'every_n_weeks') stepDays = interval * 7;

        const daysDiff = Math.floor((viewStart.getTime() - eventStart.getTime()) / DAY_MS);
        if (daysDiff > 0) i = Math.max(1, Math.floor(daysDiff / stepDays));
    }

    while (instances.length <= MAX_VIEW_INSTANCES) {
        const next = new Date(eventStart);

        if (baseEvent.recurrence === 'daily') {
            next.setDate(next.getDate() + i);
        } else if (baseEvent.recurrence === 'weekly') {
            next.setDate(next.getDate() + i * 7);
        } else if (baseEvent.recurrence === 'biweekly') {
            next.setDate(next.getDate() + i * 14);
        } else if (baseEvent.recurrence === 'every_n_weeks') {
            next.setDate(next.getDate() + i * interval * 7);
        } else if (baseEvent.recurrence === 'monthly') {
            next.setMonth(next.getMonth() + i);
        } else if (baseEvent.recurrence === 'yearly') {
            next.setFullYear(next.getFullYear() + i);
        }

        // Stop conditions
        if (recurrenceEnd && next > recurrenceEnd) break;
        if (next > viewEnd) break;

        if (next >= viewStart) {
            const nextDateStr = next.toISOString().split('T')[0];
            const isExcepted = (baseEvent.exceptDates || []).includes(nextDateStr);

            if (!isExcepted) {
                instances.push({
                    ...baseEvent,
                    id: `${baseEvent.id}_recur_${next.getTime()}`,
                    start: new Date(next),
                    end: new Date(next.getTime() + duration),
                    isInstance: true,
                } as Event);
            }
        }

        i++;
        if (i > 5000) break;
    }

    return instances;
};
