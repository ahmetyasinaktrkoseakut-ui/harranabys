'use client';

import { useState, useEffect, use } from 'react';
import { supabase } from '@/lib/supabase/client';
import { Loader2, Save, Settings, Plus, Trash2, Link as LinkIcon, Edit3, BarChart2, ChevronDown, ChevronUp, FileSpreadsheet } from 'lucide-react';
import StepPanel from '@/components/StepPanel';
import RichTextEditor from '@/components/RichTextEditor';
import { useLocale, useTranslations } from 'next-intl';
import { getLocalizedField } from '@/lib/i18n-utils';
import { usePeriod } from '@/contexts/PeriodContext';
import DOMPurify from 'dompurify';
import { logAction } from '@/lib/logger';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Cell } from 'recharts';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface KontrolEtmeClientProps {
  params: Promise<{ id: string }>;
}

type SoruTipi = 
  | 'kisa_yanit' 
  | 'uzun_yanit' 
  | 'coktan_secmeli' 
  | 'coklu_secim' 
  | 'acilir_menu' 
  | 'likert' 
  | 'coklu_metin' 
  | 'bilgi_kutusu'
  | 'bolum_basligi';

interface Secenek {
  id: string;
  metin: string;
}

interface Soru {
  id: string;
  tip: SoruTipi;
  soru: string; // Soru metni veya Bilgi Kutusu başlığı
  aciklama?: string; // Detaylı açıklama veya RichText içerik
  secenekler?: Secenek[];
  likert_olcek?: number; // 3, 5, 7
  birimler?: string[]; // Çoklu metin alanları için birim adları
  zorunlu?: boolean;
}

interface Anket {
  id?: string;
  alt_olcut_id?: string;
  baslik: string;
  sorular: Soru[];
  aciklama: string; // Bağımsız değerlendirme raporu
  isExpanded?: boolean;
}

interface AnketCevapOzeti {
  soru_id: string;
  cevaplar: any[];
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#FF6666'];

function SortableSoru({ id, children }: { id: string; children: React.ReactNode }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="relative group">
      <div 
        {...attributes} 
        {...listeners} 
        className="absolute left-[-30px] top-1/2 -translate-y-1/2 p-2 cursor-grab active:cursor-grabbing text-slate-300 hover:text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity"
        title="Sürükle"
      >
        <svg width="12" height="18" viewBox="0 0 12 18" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="2" cy="2" r="2" fill="currentColor"/>
          <circle cx="2" cy="9" r="2" fill="currentColor"/>
          <circle cx="2" cy="16" r="2" fill="currentColor"/>
          <circle cx="10" cy="2" r="2" fill="currentColor"/>
          <circle cx="10" cy="9" r="2" fill="currentColor"/>
          <circle cx="10" cy="16" r="2" fill="currentColor"/>
        </svg>
      </div>
      {children}
    </div>
  );
}

export default function KontrolEtmeClient({ params }: KontrolEtmeClientProps) {
  const resolvedParams = use(params);
  const [olcutDetay, setOlcutDetay] = useState<any>(null);
  
  // Çoklu Anket State
  const [anketListesi, setAnketListesi] = useState<Anket[]>([]);
  
  // Genel PUKÖ State
  const [pukoId, setPukoId] = useState<string | null>(null);
  
  // Cevap Data: anketId -> soruId -> cevaplar array
  const [cevapOzetleri, setCevapOzetleri] = useState<Record<string, AnketCevapOzeti[]>>({});
  const [toplamCevaplar, setToplamCevaplar] = useState<Record<string, number>>({});

  // Özdeğerlendirme Raporu State (Anket Analizi ve Birim Değerlendirmesi)
  const [ozdegerlendirmeRaporuId, setOzdegerlendirmeRaporuId] = useState<string | null>(null);
  const [yoneticiAnalizi, setYoneticiAnalizi] = useState<string>('');
  const [birimDegerlendirmesi, setBirimDegerlendirmesi] = useState<string>('');

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isReadOnly, setIsReadOnly] = useState(false);
  const [previewAnket, setPreviewAnket] = useState<Anket | null>(null);
  
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (anketIdx: number, event: DragEndEvent) => {
    const { active, over } = event;
    if (active.id !== over?.id) {
      setAnketListesi(prev => prev.map((a, i) => {
        if (i === anketIdx) {
          const oldIndex = a.sorular.findIndex(s => s.id === active.id);
          const newIndex = a.sorular.findIndex(s => s.id === over?.id);
          return { ...a, sorular: arrayMove(a.sorular, oldIndex, newIndex) };
        }
        return a;
      }));
    }
  };

  const locale = useLocale();
  const { selectedPeriod } = usePeriod();
  const t = useTranslations('KontrolEtme');
  const tCommon = useTranslations('Common');

  const fetchData = async () => {
    if (!selectedPeriod) return;
    try {
      setIsLoading(true);
      
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase.from('profiller').select('rol').eq('id', user.id).maybeSingle();
        const role = profile?.rol?.toLowerCase() || '';
        if (role.includes('yonetici') || role.includes('yönetici') || role.includes('admin') || role.includes('gözlemci') || role.includes('gozlemci') || selectedPeriod?.is_active === false) {
          setIsReadOnly(true);
        }
      }
      
      const { data: olcut } = await supabase.from('alt_olcutler').select('*').eq('id', resolvedParams.id).maybeSingle();
      if (olcut) setOlcutDetay(olcut);

      // Fetch PUKO
      const { data: pukoData } = await supabase
        .from('puko_degerlendirmeleri')
        .select('*')
        .eq('alt_olcut_id', resolvedParams.id)
        .eq('puko_asamasi', 'kontrol')
        .eq('donem_id', selectedPeriod?.id)
        .order('id', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (pukoData) {
        setPukoId(pukoData.id.toString());
      }

      // Fetch Özdeğerlendirme Raporu (Analiz ve Değerlendirme için)
      const { data: ozdegerlendirmeData } = await supabase
        .from('ozdegerlendirme_raporlari')
        .select('id, yonetici_anket_analizi, birim_anket_degerlendirmesi')
        .eq('alt_olcut_id', resolvedParams.id)
        .eq('donem_id', selectedPeriod?.id)
        .order('olusturulma_tarihi', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (ozdegerlendirmeData) {
        setOzdegerlendirmeRaporuId(ozdegerlendirmeData.id.toString());
        setYoneticiAnalizi(ozdegerlendirmeData.yonetici_anket_analizi || '');
      }

      setBirimDegerlendirmesi(pukoData?.aciklama || ozdegerlendirmeData?.birim_anket_degerlendirmesi || '');

      // Anketleri Tek Sorguda Çek (Yerel veya Hedeflenen)
      const { data: anketData } = await supabase
        .from('anketler')
        .select('*')
        .eq('donem_id', selectedPeriod.id)
        .or(`alt_olcut_id.eq.${resolvedParams.id},hedef_olcutler.cs.["${resolvedParams.id}"]`)
        .order('id', { ascending: true });

      if (anketData && anketData.length > 0) {
        const mappedAnketler: Anket[] = anketData.map((a: any, idx: number) => ({
          id: a.id.toString(),
          alt_olcut_id: a.alt_olcut_id,
          baslik: a.baslik || 'Yeni Anket',
          sorular: a.sorular || [],
          aciklama: a.aciklama || '',
          isExpanded: idx === 0 // İlk anket açık gelsin
        }));
        
        setAnketListesi(mappedAnketler);
        
        // Fetch Cevaplar
        const anketIds = anketData.map(a => a.id);
        const { data: cevaplarData } = await supabase
          .from('anket_cevaplari')
          .select('anket_id, cevaplar')
          .in('anket_id', anketIds);

        if (cevaplarData) {
          const tCevap: Record<string, number> = {};
          const cOzet: Record<string, AnketCevapOzeti[]> = {};
          
          anketIds.forEach(id => {
            const anketinCevaplari = cevaplarData.filter(c => c.anket_id === id);
            tCevap[id.toString()] = anketinCevaplari.length;
            
            const ozet: Record<string, any[]> = {};
            anketinCevaplari.forEach(c => {
              const yanitlar = c.cevaplar as Record<string, any>;
              if (yanitlar) {
                Object.keys(yanitlar).forEach(sId => {
                  if (!ozet[sId]) ozet[sId] = [];
                  ozet[sId].push(yanitlar[sId]);
                });
              }
            });
            cOzet[id.toString()] = Object.keys(ozet).map(k => ({ soru_id: k, cevaplar: ozet[k] }));
          });

          setToplamCevaplar(tCevap);
          setCevapOzetleri(cOzet);
        }
      } else {
        // Hiç anket yoksa 1 tane boş ekle
        setAnketListesi([{
          id: undefined,
          baslik: 'Değerlendirme Anketi 1',
          sorular: [],
          aciklama: '',
          isExpanded: true
        }]);
      }
    } catch (error) {
      console.error("Fetch Data Error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [resolvedParams.id, selectedPeriod]);

  const handleExportSurveyExcel = async (anket: Anket) => {
    if (!anket.id) return;
    setIsSaving(true);
    try {
      let cevaplarData: any[] = [];
      const { data, error } = await supabase
        .from('anket_cevaplari')
        .select('cevaplar, created_at')
        .eq('anket_id', anket.id);

      if (error) {
        const { data: fallbackData, error: fallbackError } = await supabase
          .from('anket_cevaplari')
          .select('cevaplar')
          .eq('anket_id', anket.id);
        
        if (fallbackError) throw fallbackError;
        cevaplarData = fallbackData || [];
      } else {
        cevaplarData = data || [];
      }

      if (cevaplarData.length === 0) {
        alert("Bu anket için henüz yanıt bulunmuyor.");
        return;
      }

      const questions = anket.sorular.filter(s => s.tip !== 'bilgi_kutusu' && s.tip !== 'bolum_basligi');
      const hasCreatedAt = cevaplarData[0] && 'created_at' in cevaplarData[0];

      let htmlContent = '';
      htmlContent += `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:x='urn:schemas-microsoft-com:office:excel' xmlns='http://www.w3.org/TR/REC-html40'>`;
      htmlContent += `<head><meta charset='utf-8'>`;
      htmlContent += `<!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet><x:Name>Anket Sonuclari</x:Name><x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions></x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]-->`;
      htmlContent += `<style>
        body { font-family: 'Segoe UI', 'Calibri', 'Arial', sans-serif; margin: 0; padding: 20px; color: #1e293b; }
        h1 { text-align: left; color: #1e3a8a; font-size: 16pt; font-weight: bold; margin-bottom: 5px; }
        .subtitle { color: #64748b; font-size: 10pt; margin-bottom: 20px; }
        table { border-collapse: collapse; width: 100%; margin-bottom: 25px; }
        th { background-color: #4f46e5; color: #ffffff; padding: 10px; font-weight: bold; font-size: 11pt; border: 0.5pt solid #cbd5e1; text-align: left; }
        td { padding: 8px 10px; border: 0.5pt solid #cbd5e1; font-size: 10pt; vertical-align: top; mso-number-format: "\\@"; white-space: normal; }
      </style></head><body>`;
      htmlContent += `<h1>` + (anket.baslik || 'Anket Sonuclari') + `</h1>`;
      htmlContent += `<div class="subtitle">İndirilme Tarihi: ` + new Date().toLocaleDateString('tr-TR') + ` | Toplam Yanıt: ` + cevaplarData.length + `</div>`;
      htmlContent += `<table><thead><tr>`;
      htmlContent += `<th style="background-color: #4f46e5; color: #ffffff;">#</th>`;
      if (hasCreatedAt) {
        htmlContent += `<th style="background-color: #4f46e5; color: #ffffff;">Tarih</th>`;
      }
      questions.forEach((soru) => {
        htmlContent += `<th style="background-color: #4f46e5; color: #ffffff;">` + soru.soru + `</th>`;
      });
      htmlContent += `</tr></thead><tbody>`;

      cevaplarData.forEach((row, rIdx) => {
        const cevaplar = row.cevaplar || {};
        htmlContent += `<tr>`;
        htmlContent += `<td>` + (rIdx + 1) + `</td>`;
        if (hasCreatedAt) {
          htmlContent += `<td>` + (row.created_at ? new Date(row.created_at).toLocaleString('tr-TR') : '') + `</td>`;
        }
        questions.forEach((soru) => {
          const answer = cevaplar[soru.id];
          let formattedAnswer = '';
          if (answer !== undefined && answer !== null) {
            if (soru.tip === 'kisa_yanit' || soru.tip === 'uzun_yanit') {
              formattedAnswer = String(answer);
            } else if (soru.tip === 'coktan_secmeli' || soru.tip === 'acilir_menu') {
              formattedAnswer = soru.secenekler?.find((s: any) => s.id === answer)?.metin || String(answer);
            } else if (soru.tip === 'coklu_secim') {
              if (Array.isArray(answer)) {
                formattedAnswer = answer.map((val: any) => soru.secenekler?.find((s: any) => s.id === val)?.metin || String(val)).join(', ');
              } else {
                formattedAnswer = String(answer);
              }
            } else if (soru.tip === 'likert') {
              const birimler = soru.birimler || ['Değerlendirme İfadesi'];
              const subAnswers = birimler.map((ifade: string, iIdx: number) => {
                const rowId = `row_${iIdx}`;
                const val = answer[rowId];
                const optionText = soru.secenekler?.find((s: any) => s.id === val)?.metin || val || '';
                return `[${ifade}]: ${optionText}`;
              });
              formattedAnswer = subAnswers.join('\n');
            } else if (soru.tip === 'coklu_metin') {
              const birimler = soru.birimler || [];
              const subAnswers = birimler.map((birim: string) => {
                const val = answer[birim] || '';
                return `[${birim}]: ${val}`;
              });
              formattedAnswer = subAnswers.join('\n');
            } else {
              formattedAnswer = JSON.stringify(answer);
            }
          }
          const safeText = formattedAnswer
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/\n/g, '<br/>');
          htmlContent += `<td>` + safeText + `</td>`;
        });
        htmlContent += `</tr>`;
      });
      htmlContent += `</tbody></table></body></html>`;

      const blob = new Blob(['\ufeff', htmlContent], { type: 'application/vnd.ms-excel' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${anket.baslik.replace(/[:\/\\\?\*\[\]]/g, '')}_Sonuclari.xls`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      console.error(err);
      alert("Excel oluşturulurken hata oluştu: " + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // 1. Genel PUKÖ Kaydı
      const upsertPuko: Record<string, any> = {
        alt_olcut_id: resolvedParams.id,
        puko_asamasi: 'kontrol',
        donem_id: selectedPeriod?.id,
        aciklama: birimDegerlendirmesi,
        durum: 'Taslak',
        red_nedeni: null
      };
      
      if (pukoId) {
        const { error } = await supabase.from('puko_degerlendirmeleri')
          .update(upsertPuko)
          .eq('id', pukoId)
          .eq('donem_id', selectedPeriod?.id);
        if (error) throw new Error(error.message);

        await logAction({
          supabase,
          islemTipi: 'UPDATE',
          tabloAdi: 'puko_degerlendirmeleri',
          kayitId: pukoId,
          yeniVeri: upsertPuko
        });
      } else {
        const { data: newPuko, error } = await supabase.from('puko_degerlendirmeleri').insert(upsertPuko).select('id').maybeSingle();
        if (error) throw new Error(error.message);
        if (newPuko) {
          setPukoId(newPuko.id.toString());
          await logAction({
            supabase,
            islemTipi: 'INSERT',
            tabloAdi: 'puko_degerlendirmeleri',
            kayitId: newPuko.id,
            yeniVeri: upsertPuko
          });
        }
      }

      // 2. Anketleri Kaydet (Sadece yerel anketler)
      for (const anket of anketListesi) {
        if (anket.alt_olcut_id === 'genel') continue; // Yönetim anketlerini atla

        const upsertAnket: Record<string, any> = {
          alt_olcut_id: resolvedParams.id,
          donem_id: selectedPeriod?.id,
          baslik: anket.baslik,
          sorular: anket.sorular,
          aciklama: anket.aciklama
        };
        if (anket.id && !anket.id.startsWith('temp_')) {
          const { error } = await supabase.from('anketler').update(upsertAnket).eq('id', anket.id);
          if (error) throw new Error(error.message);
        } else {
          const { error } = await supabase.from('anketler').insert(upsertAnket);
          if (error) throw new Error(error.message);
        }
      }

      // 3. Özdeğerlendirme Raporu Kaydı (Birim Değerlendirmesi)
      if (birimDegerlendirmesi || yoneticiAnalizi) {
        const upsertRapor: Record<string, any> = {
          alt_olcut_id: resolvedParams.id,
          donem_id: selectedPeriod?.id,
          birim_anket_degerlendirmesi: birimDegerlendirmesi
        };

        if (ozdegerlendirmeRaporuId) {
          const { error } = await supabase.from('ozdegerlendirme_raporlari')
            .update(upsertRapor)
            .eq('id', ozdegerlendirmeRaporuId);
          if (error) throw new Error(error.message);
        } else {
          // Eğer rapor yoksa içeriği ve kanıtları boş olacak şekilde oluştur
          upsertRapor.icerik = '';
          upsertRapor.kanitlar = [];
          upsertRapor.onay_durumu = 'bekliyor';
          const { data: newRapor, error } = await supabase.from('ozdegerlendirme_raporlari')
            .insert(upsertRapor)
            .select('id')
            .maybeSingle();
          if (error) throw new Error(error.message);
          if (newRapor) setOzdegerlendirmeRaporuId(newRapor.id.toString());
        }
      }

      alert('Değişiklikler başarıyla kaydedildi!');
      fetchData(); 
    } catch (error: any) {
      console.error('Save Error:', error);
      alert(`Kaydetme Hatası: ${error.message || 'Bilinmeyen Hata'}`);
    } finally {
      setIsSaving(false);
    }
  };

  const addNewAnket = () => {
    const tempId = 'temp_' + Math.random().toString(36).substr(2, 9);
    setAnketListesi(prev => [
      ...prev.map(a => ({...a, isExpanded: false})), // Diğerlerini kapat
      {
        id: tempId,
        baslik: `Yeni Anket ${prev.length + 1}`,
        sorular: [],
        aciklama: '',
        isExpanded: true
      }
    ]);
  };

  const toggleAnket = (idx: number) => {
    setAnketListesi(prev => prev.map((a, i) => i === idx ? { ...a, isExpanded: !a.isExpanded } : a));
  };

  const updateAnketField = (idx: number, field: keyof Anket, value: any) => {
    setAnketListesi(prev => prev.map((a, i) => i === idx ? { ...a, [field]: value } : a));
  };

  const deleteAnket = async (idx: number) => {
    const anket = anketListesi[idx];
    if (confirm(`"${anket.baslik}" anketini silmek istediğinize emin misiniz?`)) {
      if (anket.id && !anket.id.startsWith('temp_')) {
        try {
          const { error } = await supabase.from('anketler').delete().eq('id', anket.id);
          if (error) throw error;
        } catch (err: any) {
          console.error("Silme hatası:", err);
          alert("Silme işlemi başarısız oldu: " + err.message);
          return; // Hata varsa ekrandan silme!
        }
      }
      setAnketListesi(prev => prev.filter((_, i) => i !== idx));
    }
  };

  const handleAddSoru = (anketIdx: number, tip: SoruTipi) => {
    const anket = anketListesi[anketIdx];
    const newSoru: Soru = {
      id: Math.random().toString(36).substr(2, 9),
      tip,
      soru: tip === 'bilgi_kutusu' ? 'Bilgi Notu Başlığı' : '',
      aciklama: '',
      zorunlu: true,
      ...(tip === 'coktan_secmeli' || tip === 'coklu_secim' || tip === 'acilir_menu' 
        ? { secenekler: [{ id: Math.random().toString(36).substr(2, 9), metin: 'Seçenek 1' }] } 
        : {}),
      ...(tip === 'likert' ? { likert_olcek: 5 } : {}),
      ...(tip === 'coklu_metin' ? { birimler: ['Birim 1', 'Birim 2'] } : {})
    };
    updateAnketField(anketIdx, 'sorular', [...anket.sorular, newSoru]);
  };

  const handleRemoveSoru = (anketIdx: number, soruId: string) => {
    if (confirm("Bu soruyu silmek istediğinize emin misiniz?")) {
      const anket = anketListesi[anketIdx];
      updateAnketField(anketIdx, 'sorular', anket.sorular.filter(s => s.id !== soruId));
    }
  };

  const updateSoru = (anketIdx: number, soruId: string, updatedFields: Partial<Soru>) => {
    const anket = anketListesi[anketIdx];
    updateAnketField(anketIdx, 'sorular', anket.sorular.map(s => s.id === soruId ? { ...s, ...updatedFields } : s));
  };

  const handleCopyLink = (anketId: string | undefined) => {
    if (!anketId || anketId.startsWith('temp_')) {
      alert("Lütfen link alabilmek için önce anketi kaydedin!");
      return;
    }
    const link = `${window.location.origin}/anket/${anketId}`;
    navigator.clipboard.writeText(link);
    alert("Anket bağlantısı kopyalandı:\n" + link);
  };

  if (isLoading) {
    return <div className="h-full flex items-center justify-center p-20"><Loader2 className="w-10 h-10 animate-spin text-blue-600" /></div>;
  }

  return (
    <div className="p-8 max-w-[1400px] mx-auto animate-in fade-in duration-500">
      <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-col gap-2">
          <div className="text-sm text-slate-700 flex items-center gap-2 font-medium">
            <span className="cursor-pointer hover:text-blue-600">Ana Sayfa</span> &gt; 
            <span className="cursor-pointer hover:text-blue-600">Ölçütler</span> &gt;
            <span className="text-slate-800">{[olcutDetay?.kod, getLocalizedField(olcutDetay, 'olcut_adi', locale)].filter(Boolean).join(' ') || `Ölçüt #${resolvedParams.id}`}</span>
          </div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-bold text-slate-800">
              {[olcutDetay?.kod, getLocalizedField(olcutDetay, 'olcut_adi', locale)].filter(Boolean).join(' ') || `Ölçüt #${resolvedParams.id}`}
            </h2>
          </div>
          <p className="text-sm text-slate-800">Uygulama sonuçlarını ölçmek için dış paydaş anketleri hazırlayın ve bağımsız raporlar oluşturun.</p>
        </div>
      </div>

      <StepPanel activeStepId="kontrol" altOlcutId={resolvedParams.id} />

      <div className="mb-6 flex justify-end">
        {!isReadOnly && (
          <button 
            onClick={addNewAnket}
            className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 rounded-xl text-sm font-bold transition-all shadow-md shadow-purple-500/30 active:scale-[0.98]"
          >
            <Plus className="w-5 h-5" />
            Yeni Anket Ekle
          </button>
        )}
      </div>

      {/* Yönetici Anket Analizi (Varsa Göster) */}
      {yoneticiAnalizi && (
        <div className="mb-8 bg-gradient-to-r from-purple-50 to-white border border-purple-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="bg-purple-600 px-6 py-4 flex items-center gap-3">
            <BarChart2 className="w-6 h-6 text-white" />
            <h3 className="text-lg font-bold text-white">Yönetimden Gelen Anket Analizi</h3>
          </div>
          <div className="p-8 prose prose-slate max-w-none text-sm md:text-base">
            <div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(yoneticiAnalizi) }} />
          </div>
        </div>
      )}

      <div className="space-y-6 mb-8">
        {anketListesi.map((anket, anketIdx) => {
          const isManagementSurvey = anket.alt_olcut_id === 'genel';
          const isSurveyReadOnly = isReadOnly || isManagementSurvey;

          return (
            <div key={anket.id || `temp_${anketIdx}`} className={`bg-white rounded-2xl shadow-sm border ${isManagementSurvey ? 'border-purple-300 shadow-purple-100' : 'border-slate-200'}`}>
              {/* Header / Accordion Toggle */}
              <div 
                className={`p-6 flex items-center justify-between cursor-pointer transition-colors rounded-t-2xl ${anket.isExpanded ? (isManagementSurvey ? 'bg-purple-50 border-b border-purple-200' : 'bg-slate-50 border-b border-slate-200') : (isManagementSurvey ? 'hover:bg-purple-50' : 'hover:bg-slate-50')}`}
                onClick={() => toggleAnket(anketIdx)}
              >
                <div className="flex items-center gap-4">
                  <div className={`p-2 rounded-lg ${anket.isExpanded ? (isManagementSurvey ? 'bg-purple-200 text-purple-700' : 'bg-blue-100 text-blue-600') : 'bg-slate-100 text-slate-400'}`}>
                    {anket.isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                  </div>
                  <div className="flex flex-col">
                    <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                      {anket.baslik}
                      {isManagementSurvey && <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-[10px] uppercase font-black tracking-widest rounded-full border border-purple-200">{t('admin_analysis')}</span>}
                    </h3>
                  </div>
                  {isSurveyReadOnly && !isManagementSurvey && <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-xs rounded border border-amber-200">{tCommon('readOnly')}</span>}
                </div>
                <div className="flex items-center gap-3" onClick={e => e.stopPropagation()}>
                  {anket.id && !anket.id.startsWith('temp_') && (
                    <button 
                      onClick={() => handleCopyLink(anket.id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 text-slate-600 rounded-lg text-xs font-semibold hover:bg-slate-50 transition-colors"
                    >
                      <LinkIcon className="w-3.5 h-3.5" /> Link
                    </button>
                  )}
                  {!isSurveyReadOnly && (
                    <button 
                      onClick={() => deleteAnket(anketIdx)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 text-red-600 rounded-lg text-xs font-semibold hover:bg-red-100 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Sil
                    </button>
                  )}
                </div>
              </div>

            {/* İçerik */}
            {anket.isExpanded && (
              <div className="animate-in slide-in-from-top-4 duration-300">
                {/* 1. Anket Başlığı */}
                <div className="p-8 border-b border-slate-100 bg-white">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block">Anket Başlığı</label>
                  <input 
                    type="text" 
                    disabled={isSurveyReadOnly}
                    value={anket.baslik}
                    onChange={(e) => updateAnketField(anketIdx, 'baslik', e.target.value)}
                    placeholder="Örn: Memnuniyet Anketi 2024"
                    className="w-full text-2xl font-black text-slate-800 border-b border-transparent hover:border-slate-200 focus:border-purple-500 focus:outline-none transition-colors bg-transparent pb-2 disabled:bg-transparent disabled:opacity-100"
                  />
                </div>

                {/* 2. Soru Oluşturucu */}
                <div className="p-8 border-b border-slate-100 bg-[#FAFAFA]">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="flex items-center gap-2 font-bold text-slate-700 text-lg">
                      <Edit3 className="w-5 h-5 text-purple-600" /> {t('question_form')}
                    </h3>
                    {!isSurveyReadOnly && (
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={() => setPreviewAnket(anket)}
                          className="flex items-center gap-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors"
                        >
                          Önizleme
                        </button>
                        <div className="relative group">
                          <button className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors">
                            <Plus className="w-4 h-4" /> Yeni Öğe Ekle
                          </button>
                          <div className="absolute right-0 top-full mt-2 w-64 bg-white rounded-xl shadow-2xl border border-slate-100 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-20 flex flex-col p-2">
                            <div className="px-3 py-1 text-[10px] font-bold text-slate-400 uppercase">Standart Sorular</div>
                            <button onClick={() => handleAddSoru(anketIdx, 'coktan_secmeli')} className="text-left px-3 py-2 text-sm text-slate-700 hover:bg-purple-50 hover:text-purple-700 rounded-lg">🔘 Çoktan Seçmeli (Tekil)</button>
                            <button onClick={() => handleAddSoru(anketIdx, 'coklu_secim')} className="text-left px-3 py-2 text-sm text-slate-700 hover:bg-purple-50 hover:text-purple-700 rounded-lg">☑️ Çoklu Seçim (Çoklu)</button>
                            <button onClick={() => handleAddSoru(anketIdx, 'acilir_menu')} className="text-left px-3 py-2 text-sm text-slate-700 hover:bg-purple-50 hover:text-purple-700 rounded-lg">🔽 Açılır Menü (Dropdown)</button>
                            <button onClick={() => handleAddSoru(anketIdx, 'kisa_yanit')} className="text-left px-3 py-2 text-sm text-slate-700 hover:bg-purple-50 hover:text-purple-700 rounded-lg">📝 Kısa Yanıt</button>
                            <button onClick={() => handleAddSoru(anketIdx, 'uzun_yanit')} className="text-left px-3 py-2 text-sm text-slate-700 hover:bg-purple-50 hover:text-purple-700 rounded-lg">📄 Uzun Yanıt</button>
                            
                            <div className="px-3 py-1 mt-2 text-[10px] font-bold text-slate-400 uppercase border-t pt-2">Gelişmiş Yapılar</div>
                            <button onClick={() => handleAddSoru(anketIdx, 'likert')} className="text-left px-3 py-2 text-sm text-slate-700 hover:bg-purple-50 hover:text-purple-700 rounded-lg">📊 Likert Ölçek (Tablo)</button>
                            <button onClick={() => handleAddSoru(anketIdx, 'bilgi_kutusu')} className="text-left px-3 py-2 text-sm text-slate-700 hover:bg-purple-50 hover:text-purple-700 rounded-lg">ℹ️ Bilgi / Açıklama Kutusu</button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  <DndContext 
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={(e) => handleDragEnd(anketIdx, e)}
                  >
                    <SortableContext 
                      items={anket.sorular.map(s => s.id)}
                      strategy={verticalListSortingStrategy}
                    >
                      <div className="space-y-6">
                        {anket.sorular.map((soru, sIdx) => (
                          <SortableSoru key={soru.id} id={soru.id}>
                            <div className={`bg-white p-6 rounded-2xl border-2 shadow-sm relative group/soru transition-all ${soru.tip === 'bilgi_kutusu' ? 'border-amber-100 bg-amber-50/30' : 'border-slate-100'}`}>
                              <div className="flex items-start justify-between mb-4">
                                <div className="flex items-center gap-3">
                                  <span className="w-8 h-8 rounded-full bg-slate-800 text-white flex items-center justify-center font-bold text-sm">
                                    {sIdx + 1}
                                  </span>
                                  <div className="flex flex-col">
                                    <span className="text-[10px] font-black text-purple-600 uppercase tracking-widest">
                                      {soru.tip.replace('_', ' ')}
                                    </span>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  {!isSurveyReadOnly && (
                                    <>
                                      {soru.tip !== 'bilgi_kutusu' && (
                                        <label className="flex items-center gap-1.5 cursor-pointer mr-4">
                                          <input 
                                            type="checkbox" 
                                            checked={soru.zorunlu}
                                            onChange={(e) => updateSoru(anketIdx, soru.id, { zorunlu: e.target.checked })}
                                            className="w-4 h-4 text-purple-600 rounded border-slate-300 focus:ring-purple-500"
                                          />
                                          <span className="text-xs font-bold text-slate-500 uppercase">Zorunlu</span>
                                        </label>
                                      )}
                                      <button onClick={() => handleRemoveSoru(anketIdx, soru.id)} className="text-slate-300 hover:text-red-500 transition-colors p-1">
                                        <Trash2 className="w-4 h-4" />
                                      </button>
                                    </>
                                  )}
                                </div>
                              </div>

                              <div className="space-y-4">
                                {/* Soru Başlığı / Bilgi Kutusu Başlığı */}
                                <textarea 
                                  rows={1}
                                  disabled={isSurveyReadOnly}
                                  value={soru.soru}
                                  onChange={(e) => {
                                    e.target.style.height = 'auto';
                                    e.target.style.height = e.target.scrollHeight + 'px';
                                    updateSoru(anketIdx, soru.id, { soru: e.target.value });
                                  }}
                                  placeholder={soru.tip === 'bilgi_kutusu' ? "Bölüm Başlığı..." : "Sorunuzu buraya yazın..."}
                                  className="w-full text-lg font-bold text-slate-800 bg-transparent border-b-2 border-slate-100 focus:border-purple-500 focus:outline-none transition-colors resize-none overflow-hidden pb-1 disabled:opacity-100"
                                  onFocus={(e) => {
                                    e.target.style.height = 'auto';
                                    e.target.style.height = e.target.scrollHeight + 'px';
                                  }}
                                />

                                {/* Bilgi Kutusu İçeriği (RichText) */}
                                {soru.tip === 'bilgi_kutusu' && (
                                  <div className="bg-white border rounded-xl overflow-hidden shadow-inner">
                                    <RichTextEditor 
                                      content={soru.aciklama || ''}
                                      readOnly={isSurveyReadOnly}
                                      onChange={(val) => updateSoru(anketIdx, soru.id, { aciklama: val })}
                                      minHeight="120px"
                                    />
                                  </div>
                                )}

                                {/* Likert Seçenekleri */}
                                {soru.tip === 'likert' && (
                                  <div className="flex items-center gap-4 bg-purple-50 p-3 rounded-xl border border-purple-100">
                                    <span className="text-xs font-bold text-purple-700 uppercase">Ölçek Tipi:</span>
                                    <div className="flex gap-2">
                                      {[3, 5, 7].map(v => (
                                        <button 
                                          key={v}
                                          disabled={isSurveyReadOnly}
                                          onClick={() => updateSoru(anketIdx, soru.id, { likert_olcek: v })}
                                          className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${soru.likert_olcek === v ? 'bg-purple-600 text-white' : 'bg-white text-slate-500 border border-slate-200 hover:border-purple-300'}`}
                                        >
                                          {v}'li Likert
                                        </button>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                {/* Çoklu Metin Birimleri */}
                                {soru.tip === 'coklu_metin' && (
                                  <div className="space-y-3">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase">Birimler / Kategoriler</label>
                                    <div className="flex flex-wrap gap-2">
                                      {soru.birimler?.map((birim, bIdx) => (
                                        <div key={bIdx} className="flex items-center gap-2 bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200">
                                          <input 
                                            type="text"
                                            disabled={isSurveyReadOnly}
                                            value={birim}
                                            onChange={(e) => {
                                              const newBirimler = [...(soru.birimler || [])];
                                              newBirimler[bIdx] = e.target.value;
                                              updateSoru(anketIdx, soru.id, { birimler: newBirimler });
                                            }}
                                            className="bg-transparent text-xs font-bold text-slate-700 focus:outline-none w-24 disabled:opacity-100"
                                          />
                                          {!isSurveyReadOnly && <button onClick={() => {
                                            updateSoru(anketIdx, soru.id, { birimler: soru.birimler?.filter((_, i) => i !== bIdx) });
                                          }} className="text-slate-400 hover:text-red-500"><Trash2 className="w-3 h-3" /></button>}
                                        </div>
                                      ))}
                                      {!isSurveyReadOnly && <button 
                                        onClick={() => updateSoru(anketIdx, soru.id, { birimler: [...(soru.birimler || []), `Birim ${soru.birimler?.length || 0 + 1}`] })}
                                        className="px-3 py-1.5 bg-white border border-dashed border-slate-300 text-slate-400 rounded-lg text-xs font-bold hover:border-purple-300 hover:text-purple-600 transition-all"
                                      >
                                        + Birim Ekle
                                      </button>}
                                    </div>
                                  </div>
                                )}

                                {/* Standart Seçenekler (Radio, Checkbox, Dropdown) */}
                                {(soru.tip === 'coktan_secmeli' || soru.tip === 'coklu_secim' || soru.tip === 'acilir_menu') && (
                                  <div className="space-y-3 pl-2">
                                    {soru.secenekler?.map((secenek, secIdx) => (
                                      <div key={secenek.id} className="flex items-center gap-3 group/opt">
                                        <div className={`w-4 h-4 border-2 border-slate-200 ${soru.tip === 'coklu_secim' ? 'rounded' : 'rounded-full'}`}></div>
                                        <textarea 
                                          rows={1}
                                          disabled={isSurveyReadOnly}
                                          value={secenek.metin}
                                          onChange={(e) => {
                                            e.target.style.height = 'auto';
                                            e.target.style.height = e.target.scrollHeight + 'px';
                                            const newSecenekler = soru.secenekler?.map(sec => sec.id === secenek.id ? { ...sec, metin: e.target.value } : sec);
                                            updateSoru(anketIdx, soru.id, { secenekler: newSecenekler });
                                          }}
                                          onFocus={(e) => {
                                            e.target.style.height = 'auto';
                                            e.target.style.height = e.target.scrollHeight + 'px';
                                          }}
                                          className="flex-1 text-sm bg-transparent border-b border-slate-100 focus:border-purple-400 focus:outline-none py-1 transition-colors resize-none overflow-hidden disabled:opacity-100 disabled:text-slate-700"
                                          placeholder={`Seçenek ${secIdx + 1}`}
                                        />
                                        {!isSurveyReadOnly && soru.secenekler && soru.secenekler.length > 1 && (
                                          <button onClick={() => {
                                            updateSoru(anketIdx, soru.id, { secenekler: soru.secenekler?.filter(sec => sec.id !== secenek.id) });
                                          }} className="text-slate-200 group-hover/opt:text-red-500 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                                        )}
                                      </div>
                                    ))}
                                    {!isSurveyReadOnly && <button 
                                      onClick={() => {
                                        const newSecenekler = [...(soru.secenekler || []), { id: Math.random().toString(36).substr(2, 9), metin: `` }];
                                        updateSoru(anketIdx, soru.id, { secenekler: newSecenekler });
                                      }}
                                      className="text-[10px] font-black text-purple-600 hover:text-purple-700 mt-2 flex items-center gap-1.5 uppercase tracking-tighter"
                                    >
                                      <Plus className="w-3 h-3" /> Seçenek Ekle
                                    </button>}
                                  </div>
                                )}

                                {/* Kısa/Uzun Yanıt Placeholder */}
                                {(soru.tip === 'kisa_yanit' || soru.tip === 'uzun_yanit') && (
                                  <div className="bg-slate-50 p-4 rounded-xl border border-dashed border-slate-200 text-slate-400 text-xs italic">
                                    {soru.tip === 'kisa_yanit' ? 'Tek satırlık metin girişi...' : 'Çok satırlı geniş metin girişi...'}
                                  </div>
                                )}
                              </div>
                            </div>
                          </SortableSoru>
                        ))}
                      </div>
                    </SortableContext>
                  </DndContext>
                </div>

                {/* 3. Canlı Analiz Ekranı */}
                {anket.id && !anket.id.startsWith('temp_') && (
                  <div className="p-8 border-b border-slate-100 bg-white">
                    <div className="flex items-center justify-between mb-6">
                      <h3 className="flex items-center gap-2 font-bold text-slate-700 text-lg">
                        <BarChart2 className="w-5 h-5 text-emerald-600" /> Canlı Analiz
                      </h3>
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={() => handleExportSurveyExcel(anket)}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg text-xs font-bold hover:bg-emerald-100 transition-colors"
                        >
                          <FileSpreadsheet className="w-4 h-4" /> Excel İndir
                        </button>
                        <div className="bg-emerald-50 text-emerald-700 px-3 py-1 rounded-full text-xs font-bold border border-emerald-200">
                          Katılım: {toplamCevaplar[anket.id] || 0}
                        </div>
                      </div>
                    </div>
                    
                    {(toplamCevaplar[anket.id] || 0) === 0 ? (
                      <div className="text-center py-6 bg-slate-50 rounded-xl border border-slate-200">
                        <p className="text-slate-400 text-sm font-medium">Bu anket için henüz yanıt bulunmuyor.</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {anket.sorular.filter(s => s.tip !== 'bilgi_kutusu' && s.tip !== 'bolum_basligi').map(soru => {
                          const ozet = (cevapOzetleri[anket.id as string] || []).find(c => c.soru_id === soru.id);
                          const isTextResponse = soru.tip === 'kisa_yanit' || soru.tip === 'uzun_yanit';
                          const isLikert = soru.tip === 'likert';
                          const isCokluMetin = soru.tip === 'coklu_metin';

                          if (isTextResponse) {
                            const yanitlar = (ozet?.cevaplar || []).filter(c => c && typeof c === 'string' && c.trim() !== '');
                            return (
                              <div key={soru.id} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm col-span-1 lg:col-span-2">
                                <h4 className="font-semibold text-slate-700 mb-3 text-sm">{soru.soru}</h4>
                                {yanitlar.length > 0 ? (
                                  <div className="max-h-[150px] overflow-y-auto space-y-2 pr-2">
                                    {yanitlar.map((cevap, idx) => (
                                      <div key={idx} className="bg-slate-50 p-2 rounded-lg text-xs text-slate-700 border border-slate-100">{cevap}</div>
                                    ))}
                                  </div>
                                ) : (
                                  <p className="text-xs text-slate-400 italic">Yanıt yok.</p>
                                )}
                              </div>
                            );
                          }

                          if (isCokluMetin) {
                            const yanitlar = ozet?.cevaplar || [];
                            return (
                              <div key={soru.id} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm col-span-1 lg:col-span-2">
                                <h4 className="font-semibold text-slate-700 mb-3 text-sm">{soru.soru}</h4>
                                {yanitlar.length > 0 ? (
                                  <div className="max-h-[200px] overflow-y-auto space-y-3 pr-2">
                                    {yanitlar.map((cevapObj, idx) => (
                                      <div key={idx} className="bg-slate-50 p-3 rounded-lg text-xs text-slate-700 border border-slate-100 space-y-1">
                                        <div className="font-bold text-slate-400 select-none border-b pb-1 mb-1">Cevap #{idx + 1}</div>
                                        {cevapObj && typeof cevapObj === 'object' ? (
                                          Object.entries(cevapObj).map(([birimKey, val]) => (
                                            <div key={birimKey} className="flex flex-col md:flex-row gap-1 border-b border-slate-100 last:border-0 pb-1">
                                              <span className="font-bold text-slate-600 min-w-[100px]">{birimKey}:</span>
                                              <span className="text-slate-800 break-all">{String(val || '')}</span>
                                            </div>
                                          ))
                                        ) : (
                                          <p className="text-slate-800">{String(cevapObj)}</p>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <p className="text-xs text-slate-400 italic">Yanıt yok.</p>
                                )}
                              </div>
                            );
                          }

                          if (isLikert) {
                            const soruOzetleri = ozet?.cevaplar || [];
                            const safeSecenekler = soru.secenekler && soru.secenekler.length > 0
                              ? soru.secenekler
                              : Array.from({ length: soru.likert_olcek || 5 }).map((_, i) => ({ id: `col${i}`, metin: (i + 1).toString() }));
                            const safeBirimler = soru.birimler && soru.birimler.length > 0
                              ? soru.birimler
                              : ['Değerlendirme İfadesi'];

                            return (
                              <div key={soru.id} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm col-span-1 lg:col-span-2">
                                <h4 className="font-semibold text-slate-700 mb-3 text-sm">{soru.soru}</h4>
                                <div className="overflow-x-auto border border-slate-200 rounded-lg">
                                  <table className="w-full text-xs text-left min-w-max">
                                    <thead className="bg-slate-50 border-b border-slate-200">
                                      <tr>
                                        <th className="p-2 text-slate-500 font-bold border-r border-slate-200">İfade</th>
                                        {safeSecenekler.map(sec => (
                                          <th key={sec.id} className="p-2 text-center text-slate-500 font-bold border-r border-slate-200 last:border-0">{sec.metin}</th>
                                        ))}
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {safeBirimler.map((ifade, iIdx) => {
                                        const safeRowId = `row_${iIdx}`;
                                        return (
                                          <tr key={iIdx} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/50">
                                            <td className="p-2 font-medium text-slate-700 border-r border-slate-200">{ifade}</td>
                                            {safeSecenekler.map(sec => {
                                              const val = sec.id || sec.metin;
                                              const count = soruOzetleri.filter(c => c && typeof c === 'object' && c[safeRowId] === val).length;
                                              return <td key={sec.id} className="p-2 text-center text-slate-600 border-r border-slate-200 last:border-0 font-bold">{count}</td>;
                                            })}
                                          </tr>
                                        );
                                      })}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            );
                          }

                          // Grafik Data Hazırlığı
                          const dataMap: Record<string, number> = {};
                          if (soru.tip === 'coktan_secmeli' || soru.tip === 'coklu_secim' || soru.tip === 'acilir_menu') {
                            (soru.secenekler || []).forEach(s => dataMap[s.id] = 0);
                            if (ozet) {
                              ozet.cevaplar.forEach(c => {
                                if (Array.isArray(c)) {
                                  c.forEach(item => { if (dataMap[item] !== undefined) dataMap[item]++; });
                                } else if (c && dataMap[c] !== undefined) {
                                  dataMap[c]++;
                                }
                              });
                            }
                          }

                          const chartData = Object.keys(dataMap).map(k => {
                            let name = k;
                            if (soru.tip === 'coktan_secmeli' || soru.tip === 'coklu_secim' || soru.tip === 'acilir_menu') {
                              name = soru.secenekler?.find(s => s.id === k)?.metin || k;
                            }
                            return { name, deger: dataMap[k] };
                          });

                          return (
                            <div key={soru.id} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col h-[280px]">
                              <h4 className="font-semibold text-slate-700 mb-4 text-xs text-center line-clamp-2" title={soru.soru}>{soru.soru}</h4>
                              <div className="flex-1 w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                  <BarChart data={chartData} margin={{ top: 10, right: 10, bottom: 0, left: -20 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                                    <XAxis dataKey="name" tick={{fontSize: 10, fill: '#64748B'}} axisLine={false} tickLine={false} />
                                    <YAxis allowDecimals={false} tick={{fontSize: 10, fill: '#64748B'}} axisLine={false} tickLine={false} />
                                    <RechartsTooltip formatter={(value: any) => [`${value} Yanıt`, 'Miktar']} cursor={{fill: '#F1F5F9'}} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontSize: '12px' }} />
                                    <Bar dataKey="deger" fill="#8b5cf6" radius={[4, 4, 0, 0]} barSize={30}>
                                      {chartData.map((_, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                      ))}
                                    </Bar>
                                  </BarChart>
                                </ResponsiveContainer>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

              </div>
            )}
          </div>
        );
      })}
    </div>

      {/* Kontrol Aşaması Genel Değerlendirmesi */}
      <div className="mb-8 p-8 bg-white border border-slate-200 rounded-2xl shadow-sm">
        <h3 className="flex items-center gap-2 font-bold text-slate-800 mb-3 text-xl">
          <Edit3 className="w-6 h-6 text-blue-600" />
          {t('general_evaluation')}
        </h3>
        <p className="text-slate-500 mb-6 text-sm">{t('evaluation_placeholder')}</p>
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <RichTextEditor 
            content={birimDegerlendirmesi} 
            onChange={setBirimDegerlendirmesi} 
            readOnly={isReadOnly} 
            minHeight="250px"
          />
        </div>
      </div>

      {!isReadOnly && (
        <div className="flex justify-end p-6 bg-white border-t border-slate-200 sticky bottom-0 z-10 shadow-[0_-4px_6px_-1px_rgb(0,0,0,0.05)] rounded-t-2xl">
          <button 
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-3 rounded-xl text-sm font-bold transition-all shadow-md active:scale-[0.98] disabled:opacity-50"
          >
            {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
            {isSaving ? 'Kaydediliyor...' : 'Tüm Değişiklikleri Kaydet'}
          </button>
        </div>
      )}
      {/* Preview Modal */}
      <Dialog open={!!previewAnket} onOpenChange={() => setPreviewAnket(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto p-0 border-none bg-transparent shadow-none">
          <div className="bg-[#F0F2F5] rounded-2xl p-4 sm:p-8 relative">
            <div className="sticky top-0 z-50 mb-4 flex justify-between items-center bg-white/80 backdrop-blur-md p-4 rounded-xl shadow-sm border border-slate-200">
              <span className="text-sm font-bold text-slate-500 uppercase tracking-widest">Önizleme Modu</span>
              <button 
                onClick={() => setPreviewAnket(null)}
                className="bg-slate-800 text-white px-4 py-2 rounded-lg font-bold shadow-md hover:bg-slate-900 transition-colors"
              >
                Önizlemeyi Kapat
              </button>
            </div>
            {previewAnket && (
              <div className="pointer-events-none opacity-90 select-none">
                <div className="max-w-3xl mx-auto">
                  <div className="bg-white rounded-2xl shadow-md overflow-hidden mb-6 border-t-8 border-t-purple-600 p-8">
                    <h1 className="text-3xl font-bold text-slate-900 mb-3">{previewAnket.baslik || 'İsimsiz Anket'}</h1>
                    <p className="text-slate-600">Bu bir önizleme modudur. Yanıtlar kaydedilmez.</p>
                  </div>
                  <div className="space-y-6">
                    {previewAnket.sorular.map((soru, index) => (
                      <div key={soru.id} className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200">
                        {soru.tip === 'bilgi_kutusu' ? (
                          <div className="prose prose-slate max-w-none">
                            <h3 className="text-xl font-bold text-slate-900 border-b pb-2 mb-4">{soru.soru}</h3>
                            <div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(soru.aciklama || '') }} />
                          </div>
                        ) : (
                          <>
                            <h3 className="text-lg font-medium text-slate-800 mb-4">
                              <span className="text-purple-600 mr-2 font-bold">{index + 1}.</span> 
                              {soru.soru} {soru.zorunlu && <span className="text-red-500">*</span>}
                            </h3>
                            <div className="pl-6 space-y-4">
                              {(soru.tip === 'kisa_yanit' || soru.tip === 'uzun_yanit') && (
                                <textarea 
                                  rows={soru.tip === 'uzun_yanit' ? 4 : 1}
                                  placeholder="Yanıtınız..."
                                  readOnly
                                  className="w-full text-base bg-transparent border-b border-slate-300 focus:outline-none py-2 transition-colors resize-none"
                                />
                              )}
                              {(soru.tip === 'coktan_secmeli' || soru.tip === 'coklu_secim') && (
                                <div className="space-y-3">
                                  {soru.secenekler?.map((secenek) => (
                                    <label key={secenek.id} className="flex items-center gap-3">
                                      <div className={`w-5 h-5 border-2 border-slate-300 ${soru.tip === 'coklu_secim' ? 'rounded' : 'rounded-full'}`}></div>
                                      <span className="text-slate-700">{secenek.metin}</span>
                                    </label>
                                  ))}
                                </div>
                              )}
                              {soru.tip === 'acilir_menu' && (
                                <div className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl text-slate-700 flex justify-between items-center">
                                  <span>Lütfen seçiniz...</span>
                                  <ChevronDown className="w-4 h-4 text-slate-400" />
                                </div>
                              )}
                              {soru.tip === 'likert' && (
                                <div className="overflow-x-auto">
                                  <table className="w-full border-collapse">
                                    <thead>
                                      <tr>
                                        <th className="p-2"></th>
                                        {Array.from({ length: soru.likert_olcek || 5 }).map((_, i) => (
                                          <th key={i} className="p-2 text-[10px] font-black text-slate-400 uppercase">{i + 1}</th>
                                        ))}
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {[1, 2].map(row => (
                                        <tr key={row} className="border-t border-slate-50">
                                          <td className="p-3 text-sm text-slate-600 font-medium whitespace-nowrap">Örnek Satır {row}</td>
                                          {Array.from({ length: soru.likert_olcek || 5 }).map((_, i) => (
                                            <td key={i} className="p-2 text-center">
                                              <div className="w-5 h-5 rounded-full border-2 border-slate-200 mx-auto"></div>
                                            </td>
                                          ))}
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              )}
                              {soru.tip === 'coklu_metin' && (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  {soru.birimler?.map((birim, i) => (
                                    <div key={i} className="space-y-2">
                                      <label className="text-xs font-bold text-slate-500 uppercase">{birim}</label>
                                      <textarea rows={3} readOnly className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl resize-none" />
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
