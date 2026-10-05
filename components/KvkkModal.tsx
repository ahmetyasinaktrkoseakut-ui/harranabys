'use client';

import React from 'react';
import { X, ShieldCheck } from 'lucide-react';

interface KvkkModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function KvkkModal({ isOpen, onClose }: KvkkModalProps) {
  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div 
        className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                KVKK Aydınlatma ve Gizlilik Bildirimi
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                Akreditasyon Bilgi Yönetim Sistemi (ABYS)
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-4 text-sm text-slate-600 leading-relaxed">
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 space-y-1">
            <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider">
              1. Veri Sorumlusu ve Amacı
            </h4>
            <p className="text-xs text-slate-600">
              6698 sayılı Kişisel Verilerin Korunması Kanunu (KVKK) uyarınca, bu platform üzerinde işlenen kişisel veriler (ad, soyad, akademik unvan, kurumsal e-posta, ders izlenceleri ve akreditasyon kanıtları); İlahiyat Fakültesi bünyesinde <strong>İlahiyat Akreditasyon Ajansı (İAA)</strong> standartlarına uygun olarak yürütülen kalite güvencesi, özdeğerlendirme raporları (ÖDR) ve program akreditasyonu süreçlerinin yürütülmesi amacıyla işlenmektedir.
            </p>
          </div>

          <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 space-y-1">
            <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider">
              2. Verilerin İşlenme ve Aktarım Kapsamı
            </h4>
            <p className="text-xs text-slate-600">
              Sisteme yüklenen bilgi, belge ve kanıtlar; yalnızca fakülte akreditasyon komisyonu, başlık koordinatörleri ve resmi değerlendirme dönemlerinde <strong>İAA Değerlendirme Takımı</strong> tarafından incelenmek üzere kullanılır. Veriler hiçbir şekilde ticari amaçla kullanılamaz veya yetkisiz üçüncü taraflarla paylaşılamaz.
            </p>
          </div>

          <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 space-y-1">
            <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider">
              3. Veri Güvenliği ve Saklama
            </h4>
            <p className="text-xs text-slate-600">
              Kullanıcı hesapları ve sistem kayıtları yetkisiz erişime karşı şifreli altyapıda korunmaktadır. Akreditasyon kanıtları ve rapor verileri, İAA akreditasyon periyotları ve kurumsal arşivleme mevzuatına uygun süre boyunca sistemde güvenle muhafaza edilir.
            </p>
          </div>

          <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 space-y-1">
            <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider">
              4. İlgili Kişi Hakları
            </h4>
            <p className="text-xs text-slate-600">
              Kullanıcılar, KVKK’nın 11. maddesi kapsamında sisteme işlenen kişisel verilerine ilişkin bilgi alma, verilerini güncelleme ve düzeltme talep etme hakkına sahiptir.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end px-6 py-3.5 border-t border-slate-100 bg-slate-50/50">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs rounded-xl shadow-sm transition-all cursor-pointer"
          >
            Anladım / Kapat
          </button>
        </div>
      </div>
    </div>
  );
}
