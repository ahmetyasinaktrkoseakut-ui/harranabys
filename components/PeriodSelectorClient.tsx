'use client';

import { usePeriod } from '@/contexts/PeriodContext';
import { Calendar, ChevronDown, Lock } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';

export default function PeriodSelectorClient() {
  const { periods, selectedPeriod, setSelectedPeriod, isLoading } = usePeriod();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (isLoading || !selectedPeriod) {
    return (
      <div className="h-9 w-24 bg-slate-100 animate-pulse rounded-lg"></div>
    );
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all text-sm font-semibold ${
          selectedPeriod.is_active 
            ? 'bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100' 
            : 'bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100'
        }`}
      >
        {!selectedPeriod.is_active && <Lock className="w-3.5 h-3.5" />}
        <Calendar className="w-4 h-4" />
        <span>{selectedPeriod.donem_adi}</span>
        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute top-full mt-1 left-0 w-48 bg-white border border-slate-200 rounded-xl shadow-xl z-50 py-1 animate-in fade-in slide-in-from-top-1 duration-200">
          <div className="px-3 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Dönem Seçimi</div>
          {periods.map((period) => (
            <button
              key={period.id}
              onClick={() => {
                setSelectedPeriod(period);
                setIsOpen(false);
              }}
              className={`w-full text-left px-3 py-2 text-sm flex items-center justify-between hover:bg-slate-50 transition-colors ${
                selectedPeriod.id === period.id ? 'bg-blue-50/50 text-blue-700 font-bold' : 'text-slate-600'
              }`}
            >
              <div className="flex items-center gap-2">
                <span>{period.donem_adi}</span>
                {!period.is_active && <Lock className="w-3 h-3 text-slate-400" />}
              </div>
              {period.is_active && <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full font-bold">Aktif</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
