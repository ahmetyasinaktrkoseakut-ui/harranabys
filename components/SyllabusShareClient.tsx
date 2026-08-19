'use client';

import { useState } from 'react';
import { Copy, Check } from 'lucide-react';

export default function SyllabusShareClient() {
  const [copied, setCopied] = useState(false);
  const [link] = useState(() =>
    typeof window !== 'undefined' ? `${window.location.origin}/tr/izlenceler` : '/tr/izlenceler'
  );

  const handleCopy = () => {
    if (!link) return;
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-indigo-900 rounded-3xl p-6 text-white shadow-2xl flex flex-col md:flex-row items-center justify-between gap-6 border border-white/10 relative overflow-hidden">
      <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
      <div className="relative z-10">
        <h2 className="text-xl font-black mb-1">Öğrenci Paylaşım Linki</h2>
        <p className="text-indigo-200 text-sm font-medium">Bu linki öğrencilerle paylaşarak sisteme giriş yapmadan planları görmelerini sağlayabilirsiniz.</p>
      </div>
      <div className="flex items-center gap-3 bg-white/10 p-2 rounded-2xl border border-white/20 w-full md:w-auto relative z-10 backdrop-blur-sm">
        <code className="px-4 font-mono text-sm font-bold text-indigo-100 truncate max-w-[300px]">
          {link || '/tr/izlenceler'}
        </code>
        <button 
          onClick={handleCopy}
          className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-black text-xs transition-all shadow-lg active:scale-95 ${
            copied ? 'bg-emerald-500 text-white' : 'bg-white text-indigo-900 hover:bg-indigo-50'
          }`}
        >
          {copied ? (
            <>KOPYALANDI <Check className="w-4 h-4" /></>
          ) : (
            <>LİNKİ KOPYALA <Copy className="w-4 h-4" /></>
          )}
        </button>
      </div>
    </div>
  );
}
