import { useEffect, useState } from 'react';
import { UnreadCounters } from '@/lib/firebase/types';
import { listenToUnreadCounters } from '@/lib/firebase/index';
import { Timestamp } from 'firebase/firestore';

const DEFAULT_COUNTERS: UnreadCounters = {
  id: '',
  userId: '',
  childId: '',
  chatUnreadCount: 0,
  logUnreadCount: 0,
  logUnreadByLogId: {},
  totalUnreadCount: 0,
  lastUpdated: Timestamp.now()
};

export function useUnreadCounters(userId: string | null, childId: string | null) {
  const [counters, setCounters] = useState<UnreadCounters>(DEFAULT_COUNTERS);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!userId || !childId) {
      setCounters(DEFAULT_COUNTERS);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    
    // Set up real-time listener
    const unsubscribe = listenToUnreadCounters(
      userId,
      childId,
      (newCounters) => {
        setCounters(newCounters);
        setIsLoading(false);
      }
    );

    // Cleanup on unmount or when userId/childId changes
    return () => {
      unsubscribe();
    };
  }, [userId, childId]);

  return { counters, isLoading };
}