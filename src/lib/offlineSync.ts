import { supabase } from './supabaseClient';

type PendingItem = {
  table: string;
  data: any;
  timestamp: number;
};

const QUEUE_KEY = 'ilertren_offline_queue';

export const offlineSync = {
  // Add item to offline queue
  enqueue: (table: string, data: any) => {
    const queue: PendingItem[] = JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]');
    queue.push({ table, data, timestamp: Date.now() });
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
    console.warn(`📦 Data queued locally for table [${table}]`);
  },

  // Sync all pending items
  sync: async () => {
    if (!navigator.onLine) return;
    
    const queue: PendingItem[] = JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]');
    if (queue.length === 0) return;

    console.log(`📡 Attempting to sync ${queue.length} pending items...`);
    const remainingItems: PendingItem[] = [];

    for (const item of queue) {
      try {
        const { error } = await supabase.from(item.table).insert(item.data);
        if (error) throw error;
        console.log(`✅ Synced item for [${item.table}]`);
      } catch (err) {
        console.error(`❌ Sync failed for [${item.table}]:`, err);
        remainingItems.push(item);
      }
    }

    localStorage.setItem(QUEUE_KEY, JSON.stringify(remainingItems));
    return remainingItems.length === 0;
  },

  // Initialize online listener
  init: () => {
    window.addEventListener('online', () => {
      console.log('🌐 Connection restored. Syncing...');
      offlineSync.sync();
    });
  }
};
