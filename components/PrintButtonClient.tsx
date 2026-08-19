'use client';

import { Printer } from 'lucide-react';

export default function PrintButtonClient() {
  return (
    <button 
      onClick={() => typeof window !== 'undefined' && window.print()} 
      className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-black px-6 py-3 rounded-xl shadow-lg transition-all active:scale-95"
    >
      <Printer className="w-4 h-4" /> YAZDIR / PDF KAYDET
    </button>
  );
}
