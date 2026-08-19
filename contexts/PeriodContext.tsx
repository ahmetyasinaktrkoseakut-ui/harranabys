'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { supabase } from '@/lib/supabase/client';

interface Period {
  id: string;
  donem_adi: string;
  is_active: boolean;
  is_sealed?: boolean;
}

interface PeriodContextType {
  periods: Period[];
  selectedPeriod: Period | null;
  setSelectedPeriod: (period: Period) => void;
  isLoading: boolean;
  refreshPeriods: () => Promise<void>;
}

const PeriodContext = createContext<PeriodContextType | undefined>(undefined);

export function PeriodProvider({ children }: { children: ReactNode }) {
  const [periods, setPeriods] = useState<Period[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState<Period | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchPeriods = useCallback(async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('donemler')
        .select('*')
        .order('donem_adi', { ascending: false });

      if (error) {
        console.error('Error fetching periods:', error);
        return;
      }

      setPeriods(data || []);
      
      // Select the active period by default if not already set
      setSelectedPeriod(prev => {
        if (!prev && data && data.length > 0) {
          const savedPeriodId = localStorage.getItem('selectedPeriodId');
          let periodToSelect = null;
          if (savedPeriodId) {
            periodToSelect = data.find(p => p.id === savedPeriodId);
          }
          
          if (!periodToSelect) {
            periodToSelect = data.find(p => p.is_active) || data[0];
          }
          
          return periodToSelect || null;
        }
        return prev;
      });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPeriods();
  }, [fetchPeriods]);

  const handleSetSelectedPeriod = (period: Period) => {
    setSelectedPeriod(period);
    localStorage.setItem('selectedPeriodId', period.id);
  };

  return (
    <PeriodContext.Provider value={{ 
      periods, 
      selectedPeriod, 
      setSelectedPeriod: handleSetSelectedPeriod, 
      isLoading,
      refreshPeriods: fetchPeriods
    }}>
      {children}
    </PeriodContext.Provider>
  );
}

export function usePeriod() {
  const context = useContext(PeriodContext);
  if (context === undefined) {
    throw new Error('usePeriod must be used within a PeriodProvider');
  }
  return context;
}
