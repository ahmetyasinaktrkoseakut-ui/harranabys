'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';
import DOMPurify from 'dompurify';
import { Loader2, Save, Activity, Edit3, Trash2, Plus, Link as LinkIcon, ChevronDown, ChevronUp, BarChart2, Pencil, Info, GripVertical, PlusCircle, FileSpreadsheet } from 'lucide-react';
import { usePeriod } from '@/contexts/PeriodContext';
import { useLocale, useTranslations } from 'next-intl';
import { getLocalizedField } from '@/lib/i18n-utils';
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
import RichTextEditor from '@/components/RichTextEditor';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import PublicAnketClient from '@/components/PublicAnketClient';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#FF6666'];

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
  baslik: string;
  sorular: Soru[];
  aciklama: string;
  hedef_olcutler?: string[];
  isExpanded?: boolean;
}

interface AnketCevapOzeti {
  soru_id: string;
  cevaplar: any[];
}

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

export default function AnketYonetimiClient() {
  const t = useTranslations('Surveys');
  const tCommon = useTranslations('Common');
  const locale = useLocale();
  const { selectedPeriod } = usePeriod();
  const [isAdmin, setIsAdmin] = useState(false);
  const [isCoordinator, setIsCoordinator] = useState(false);
  const [isObserver, setIsObserver] = useState(false);
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  const [olcutler, setOlcutler] = useState<any[]>([]);
  const [hedefOlcutler, setHedefOlcutler] = useState<string[]>([]);
  
  // Sadece form (taslak) anketler için
  const [anketListesi, setAnketListesi] = useState<Anket[]>([{
    id: `temp_${Math.random().toString(36).substr(2, 9)}`,
    baslik: '',
    sorular: [],
    aciklama: '',
    isExpanded: true
  }]);
  
  // Yayınlanmış anketler (Yalnızca gösterim için)
  const [yayinlananAnketler, setYayinlananAnketler] = useState<Anket[]>([]);
  
  // Analiz verileri
  const [cevapOzetleri, setCevapOzetleri] = useState<Record<string, AnketCevapOzeti[]>>({});
  const [toplamCevaplar, setToplamCevaplar] = useState<Record<string, number>>({});
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

  const fetchPublishedAnketler = async (userIsAdmin: boolean, expectedDbBaslik: string | null, tumOlcutlerData: any[]) => {
    if (!selectedPeriod) return;
    
    const gecerliOlcutler = userIsAdmin ? (tumOlcutlerData || []) : (tumOlcutlerData || []).filter(o => o.baslik === expectedDbBaslik);
    const gecerliIdler = gecerliOlcutler.flatMap(o => (o.altOlcutler || []).map((ao: any) => ao.id.toString()));

    const { data: existingAnketler } = await supabase
      .from('anketler')
      .select('*')
      .eq('alt_olcut_id', 'genel')
      .eq('donem_id', selectedPeriod.id)
      .order('id', { ascending: true });

    if (existingAnketler && existingAnketler.length > 0) {
      const filteredAnketler = userIsAdmin ? existingAnketler : existingAnketler.filter(a => {
        if (!a.hedef_olcutler) return false;
        return a.hedef_olcutler.some((id: string) => gecerliIdler.includes(id));
      });

      const mappedAnketler: Anket[] = filteredAnketler.map((a: any) => ({
        id: a.id.toString(),
        baslik: a.baslik || 'İsimsiz Anket',
        sorular: a.sorular || [],
        aciklama: a.aciklama || '',
        hedef_olcutler: a.hedef_olcutler || [],
        isExpanded: false
      }));
      
      setYayinlananAnketler(mappedAnketler);

      // Fetch Cevaplar for Charts
      const anketIds = filteredAnketler.map(a => a.id);
      if (anketIds.length > 0) {
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
      }
    } else {
      setYayinlananAnketler([]);
    }
  };

  useEffect(() => {
    async function init() {
      if (!selectedPeriod) return;
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data: profile } = await supabase.from('profiller').select('rol').eq('id', user.id).maybeSingle();
        const role = profile?.rol?.toLowerCase() || '';
        const userIsAdmin = role.includes('yonetici') || role.includes('yönetici') || role.includes('admin');
        const userIsObserver = role.includes('gozlemci') || role.includes('gözlemci');
        setIsAdmin(userIsAdmin);
        setIsObserver(userIsObserver);

        let expectedDbBaslik: string | null = null;
        if (!userIsAdmin && !userIsObserver) {
          const { data: coordData } = await supabase.from('baslik_koordinatorleri').select('baslik').eq('kullanici_id', user.id).maybeSingle();
          if (coordData) {
            setIsCoordinator(true);
            const baslikMap: Record<string, string> = {
              'Kalite Güvencesi': 'KALİTE GÜVENCESİ SİSTEMİ',
              'Eğitim-Öğretim': 'EĞİTİM VE ÖĞRETİM',
              'Araştırma ve Geliştirme': 'ARAŞTIRMA VE GELİŞTİRME',
              'Toplumsal Katkı': 'TOPLUMSAL KATKI',
              'Yönetim Sistemi': 'YÖNETİM SİSTEMİ'
            };
            expectedDbBaslik = baslikMap[coordData.baslik];
          } else {
            // Koordinatör kaydı yoksa ve admin değilse uyarı verip dur
            setIsLoading(false);
            return;
          }
        } else {
          // Admin veya Gözlemci ise her zaman koordinatör gibi işlem yapabilsin
          setIsCoordinator(true);
        }

        const { data: allBasliklar } = await supabase.from('ana_basliklar').select('*');
        const { data: allAltOlcutlerData } = await supabase.from('alt_olcutler').select('*').order('kod', { ascending: true });

        const tumOlcutler = (allBasliklar || []).map(ana => {
          const anaAltOlcutler = (allAltOlcutlerData || []).filter(ao => {
            return (ao.kod && ana.kod && ao.kod.startsWith(ana.kod));
          });
          return {
            ...ana,
            baslik: ana.baslik_adi,
            kod: ana.kod,
            id: ana.id,
            altOlcutler: anaAltOlcutler
          };
        });

        if (userIsAdmin) {
          setOlcutler(tumOlcutler);
        } else if (expectedDbBaslik) {
          const secili = tumOlcutler.filter(o => o.baslik === expectedDbBaslik);
          setOlcutler(secili);
        }

        await fetchPublishedAnketler(userIsAdmin || userIsObserver, expectedDbBaslik, tumOlcutler);

      } catch (err) {
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    }
    init();
  }, [selectedPeriod]);

  const handleSave = async () => {
    if (isObserver) return;
    if (!selectedPeriod) return;
    if (hedefOlcutler.length === 0) {
      alert(t('target_criteria'));
      return;
    }
    setIsSaving(true);
    try {
      for (const anket of anketListesi) {
        // Yeni bir anket olarak veritabanına atılır (ID gönderilmez)
        const insertAnket: Record<string, any> = {
          alt_olcut_id: 'genel',
          donem_id: selectedPeriod?.id,
          baslik: anket.baslik,
          sorular: anket.sorular,
          aciklama: anket.aciklama,
          hedef_olcutler: hedefOlcutler
        };
        const { error } = await supabase.from('anketler').insert(insertAnket);
        if (error) throw new Error(error.message);
      }
      
      // State sıfırlama (Temizlik kuralı)
      setHedefOlcutler([]);
      setAnketListesi([{
        id: `temp_${Math.random().toString(36).substr(2, 9)}`,
        baslik: '',
        sorular: [],
        aciklama: '',
        isExpanded: true
      }]);

      alert(t('save_success'));

      window.location.reload();

    } catch (error: any) {
      console.error(error);
      alert(tCommon('error') + ': ' + error.message);
    } finally {
      setIsSaving(false);
    }
  };

  const toggleOlcut = (id: string) => {
    setHedefOlcutler(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const selectAll = () => {
    const allIds = olcutler.flatMap(o => o.altOlcutler.map((ao: any) => ao.id.toString()));
    setHedefOlcutler(allIds);
  };
  const deselectAll = () => setHedefOlcutler([]);

  const addNewAnket = () => {
    const tempId = 'temp_' + Math.random().toString(36).substr(2, 9);
    setAnketListesi(prev => [
      ...prev.map(a => ({...a, isExpanded: false})),
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

  const deleteAnketFormItem = (idx: number) => {
    if (anketListesi.length === 1) {
      alert("En az bir anket formu açık olmalıdır.");
      return;
    }
    setAnketListesi(prev => prev.filter((_, i) => i !== idx));
  };

  // Yayınlanmış anket silme
  const deleteYayinlananAnket = async (anketId: string, baslik: string) => {
    if (isObserver) return;
    if (confirm(t('delete_survey_confirm', { baslik }) || `"${baslik}" anketini kalıcı olarak silmek istediğinize emin misiniz?`)) {
      try {
        const { error } = await supabase.from('anketler').delete().eq('id', anketId);
        if (error) throw error;
        setYayinlananAnketler(prev => prev.filter(a => a.id !== anketId));
      } catch (err: any) {
        console.error("Silme hatası:", err);
        alert("Silme işlemi başarısız oldu: " + err.message);
      }
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
    if (confirm(tCommon('delete_confirm') || "Bu soruyu silmek istediğinize emin misiniz?")) {
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

  // Helper to find olcut codes based on ID
  const getOlcutKods = (ids: string[]) => {
    const matched: string[] = [];
    olcutler.forEach(ana => {
      ana.altOlcutler.forEach((ao: any) => {
        if (ids.includes(ao.id.toString())) {
          matched.push(ao.kod);
        }
      });
    });
    return matched;
  };

  if (isLoading) {
    return <div className="h-full flex items-center justify-center min-h-[400px]"><Loader2 className="w-10 h-10 animate-spin text-blue-600" /></div>;
  }

  if (!isAdmin && !isCoordinator) {
    return <div className="p-8 text-center text-red-500 font-bold">Bu sayfaya erişim yetkiniz yok.</div>;
  }

  return (
    <div className="p-8 max-w-5xl mx-auto animate-in fade-in duration-500">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
          <Activity className="w-6 h-6 text-purple-600" />
          {t('title')}
        </h2>
        <p className="text-slate-500 mt-2">{t('desc')}</p>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <label className="block text-md font-bold text-slate-800">{t('target_criteria')}</label>
          {!isObserver && (
            <div className="space-x-2">
              <button onClick={selectAll} className="text-xs font-semibold text-purple-600 bg-purple-50 px-3 py-1.5 rounded-lg hover:bg-purple-100">{t('select_all')}</button>
              <button onClick={deselectAll} className="text-xs font-semibold text-slate-600 bg-slate-100 px-3 py-1.5 rounded-lg hover:bg-slate-200">{t('deselect_all')}</button>
            </div>
          )}
        </div>
        
        <div className="max-h-[300px] overflow-y-auto border border-slate-200 rounded-xl p-4 bg-slate-50 space-y-4">
          {olcutler.map(ana => (
            <div key={ana.id} className="space-y-2">
              <h3 className="font-bold text-slate-700 text-sm border-b pb-1">{ana.kod} - {getLocalizedField(ana, 'baslik_adi', locale) || getLocalizedField(ana, 'baslik', locale) || ana.baslik}</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pl-2">
                {ana.altOlcutler.map((ao: any) => {
                  const idStr = ao.id.toString();
                  const isSelected = hedefOlcutler.includes(idStr);
                  return (
                    <label key={ao.id} className={`flex items-start gap-2 p-2 rounded-lg cursor-pointer transition-colors ${isSelected ? 'bg-purple-100 border-purple-200 border' : 'hover:bg-slate-200 border border-transparent'}`}>
                      <input 
                        type="checkbox" 
                        checked={isSelected}
                        onChange={() => toggleOlcut(idStr)}
                        disabled={isObserver}
                        className="mt-1 w-4 h-4 text-purple-600 rounded border-slate-300 focus:ring-purple-500"
                      />
                      <span className="text-xs font-medium text-slate-700 leading-tight">
                        <span className="font-bold">{ao.kod}</span> - {getLocalizedField(ao, 'olcut_adi', locale) || getLocalizedField(ao, 'ad', locale) || getLocalizedField(ao, 'baslik', locale) || ao.olcut_adi || ao.ad || ao.baslik}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          ))}
          {olcutler.length === 0 && <p className="text-sm text-slate-500">Gösterilecek ölçüt bulunamadı.</p>}
        </div>
        <p className="text-xs text-slate-500 mt-2">{t('selected_count', { count: hedefOlcutler.length })}</p>
      </div>

      {!isObserver && (
        <div className="mb-6 flex justify-end">
          <button 
            onClick={addNewAnket}
            className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 rounded-xl text-sm font-bold transition-all shadow-md shadow-purple-500/30 active:scale-[0.98]"
          >
            <Plus className="w-5 h-5" />
            {t('add_new_form')}
          </button>
        </div>
      )}

      {!isObserver && (
        <div className="space-y-6 mb-8">
        {anketListesi.map((anket, anketIdx) => (
          <div key={anket.id} className="bg-white rounded-2xl shadow-sm border border-slate-200">
            {/* Header / Accordion Toggle */}
            <div 
              className={`p-6 flex items-center justify-between cursor-pointer transition-colors rounded-t-2xl ${anket.isExpanded ? 'bg-slate-50 border-b border-slate-200' : 'hover:bg-slate-50'}`}
              onClick={() => toggleAnket(anketIdx)}
            >
              <div className="flex items-center gap-4">
                <div className={`p-2 rounded-lg ${anket.isExpanded ? 'bg-purple-100 text-purple-600' : 'bg-slate-100 text-slate-400'}`}>
                  {anket.isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                </div>
                <h3 className="text-xl font-bold text-slate-800">{anket.baslik || t('form_placeholder')}</h3>
              </div>
              <div className="flex items-center gap-3" onClick={e => e.stopPropagation()}>
                <button 
                  onClick={() => deleteAnketFormItem(anketIdx)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 text-red-600 rounded-lg text-xs font-semibold hover:bg-red-100 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" /> {t('delete_form')}
                </button>
              </div>
            </div>

            {/* İçerik */}
            {anket.isExpanded && (
              <div className="animate-in slide-in-from-top-4 duration-300">
                {/* 1. Anket Başlığı */}
                <div className="p-8 border-b border-slate-100 bg-white">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block">{t('form_title')}</label>
                  <input 
                    type="text" 
                    value={anket.baslik}
                    onChange={(e) => updateAnketField(anketIdx, 'baslik', e.target.value)}
                    placeholder={t('form_placeholder')}
                    className="w-full text-2xl font-black text-slate-800 border-b border-transparent hover:border-slate-200 focus:border-purple-500 focus:outline-none transition-colors bg-transparent pb-2"
                  />
                </div>

                {/* 2. Soru Oluşturucu */}
                  <div className="p-8 bg-[#FAFAFA]">
                    <div className="flex items-center justify-between mb-6">
                            <h4 className="text-sm font-bold text-slate-800 mb-6 flex items-center gap-2 border-b pb-2">
                              <Edit3 className="w-4 h-4 text-purple-600" /> {t('question_form') || 'Question Form'}
                            </h4>
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={() => setPreviewAnket(anket)}
                          className="flex items-center gap-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors"
                        >
                          {t('preview')}
                        </button>
                        <div className="relative group">
                          <button className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors">
                            <Plus className="w-4 h-4" /> {t('add_item')}
                          </button>
                          <div className="absolute right-0 top-full mt-2 w-64 bg-white rounded-xl shadow-2xl border border-slate-100 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-20 flex flex-col p-2">
                            <div className="px-3 py-1 text-[10px] font-bold text-slate-400 uppercase">{t('types.standard')}</div>
                            <button onClick={() => handleAddSoru(anketIdx, 'coktan_secmeli')} className="text-left px-3 py-2 text-sm text-slate-700 hover:bg-purple-50 hover:text-purple-700 rounded-lg">🔘 {t('types.coktan_secmeli')}</button>
                            <button onClick={() => handleAddSoru(anketIdx, 'coklu_secim')} className="text-left px-3 py-2 text-sm text-slate-700 hover:bg-purple-50 hover:text-purple-700 rounded-lg">☑️ {t('types.coklu_secim')}</button>
                            <button onClick={() => handleAddSoru(anketIdx, 'acilir_menu')} className="text-left px-3 py-2 text-sm text-slate-700 hover:bg-purple-50 hover:text-purple-700 rounded-lg">🔽 {t('types.acilir_menu')}</button>
                            <button onClick={() => handleAddSoru(anketIdx, 'kisa_yanit')} className="text-left px-3 py-2 text-sm text-slate-700 hover:bg-purple-50 hover:text-purple-700 rounded-lg">📝 {t('types.kisa_yanit')}</button>
                            <button onClick={() => handleAddSoru(anketIdx, 'uzun_yanit')} className="text-left px-3 py-2 text-sm text-slate-700 hover:bg-purple-50 hover:text-purple-700 rounded-lg">📄 {t('types.uzun_yanit')}</button>
                            
                            <div className="px-3 py-1 mt-2 text-[10px] font-bold text-slate-400 uppercase border-t pt-2">{t('types.advanced')}</div>
                            <button onClick={() => handleAddSoru(anketIdx, 'likert')} className="text-left px-3 py-2 text-sm text-slate-700 hover:bg-purple-50 hover:text-purple-700 rounded-lg">📊 {t('types.likert')}</button>
                            <button onClick={() => handleAddSoru(anketIdx, 'bilgi_kutusu')} className="text-left px-3 py-2 text-sm text-slate-700 hover:bg-purple-50 hover:text-purple-700 rounded-lg">ℹ️ {t('types.bilgi_kutusu')}</button>
                            <button onClick={() => handleAddSoru(anketIdx, 'bolum_basligi')} className="text-left px-3 py-2 text-sm text-slate-700 hover:bg-purple-50 hover:text-purple-700 rounded-lg">📌 Bölüm Başlığı</button>
                          </div>
                        </div>
                      </div>
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
                              <div className={`bg-white p-6 rounded-2xl border-2 shadow-sm relative group/soru transition-all ${soru.tip === 'bilgi_kutusu' ? 'border-amber-100 bg-amber-50/30' : soru.tip === 'bolum_basligi' ? 'border-blue-100 bg-blue-50/30' : 'border-slate-100'}`}>
                                <div className="flex items-start justify-between mb-4">
                                  <div className="flex items-center gap-3">
                                    <span className="w-8 h-8 rounded-full bg-slate-800 text-white flex items-center justify-center font-bold text-sm">
                                      {sIdx + 1}
                                    </span>
                                    <div className="flex flex-col">
                                      <span className="text-[10px] font-black text-purple-600 uppercase tracking-widest">
                                        {soru.tip === 'bolum_basligi' ? 'BÖLÜM BAŞLIĞI' : t(`types.${soru.tip}`)}
                                      </span>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    {soru.tip !== 'bilgi_kutusu' && soru.tip !== 'bolum_basligi' && (
                                      <label className="flex items-center gap-1.5 cursor-pointer mr-4">
                                        <input 
                                          type="checkbox" 
                                          checked={soru.zorunlu}
                                          onChange={(e) => updateSoru(anketIdx, soru.id, { zorunlu: e.target.checked })}
                                          className="w-4 h-4 text-purple-600 rounded border-slate-300 focus:ring-purple-500"
                                        />
                                        <span className="text-xs font-bold text-slate-500 uppercase">{t('required')}</span>
                                      </label>
                                    )}
                                    <button onClick={() => handleRemoveSoru(anketIdx, soru.id)} className="text-slate-300 hover:text-red-500 transition-colors p-1">
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  </div>
                                </div>

                                <div className="space-y-4">
                                  {/* Soru Başlığı / Bilgi Kutusu Başlığı */}
                                  <textarea 
                                    rows={1}
                                    value={soru.soru}
                                    onChange={(e) => {
                                      e.target.style.height = 'auto';
                                      e.target.style.height = e.target.scrollHeight + 'px';
                                      updateSoru(anketIdx, soru.id, { soru: e.target.value });
                                    }}
                                    placeholder={soru.tip === 'bilgi_kutusu' ? "Bölüm Başlığı..." : "Sorunuzu buraya yazın..."}
                                    className="w-full text-lg font-bold text-slate-800 bg-transparent border-b-2 border-slate-100 focus:border-purple-500 focus:outline-none transition-colors resize-none overflow-hidden pb-1"
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
                                        onChange={(val) => updateSoru(anketIdx, soru.id, { aciklama: val })}
                                        minHeight="120px"
                                      />
                                    </div>
                                  )}

                                  {/* Likert Seçenekleri ve Matris */}
                                  {soru.tip === 'likert' && (
                                    <div className="space-y-4 mt-2 border-t border-slate-100 pt-4">
                                      <div className="flex items-center gap-4 bg-purple-50 p-3 rounded-xl border border-purple-100 mb-6">
                                        <span className="text-xs font-bold text-purple-700 uppercase">Ölçek Tipi:</span>
                                        <div className="flex gap-2">
                                          {[3, 5, 7].map(v => (
                                            <button 
                                              key={v}
                                              onClick={() => {
                                                const defaultOptions = v === 3 ? ['Katılmıyorum', 'Kararsızım', 'Katılıyorum'] : 
                                                                       v === 5 ? ['Hiç Katılmıyorum', 'Katılmıyorum', 'Kararsızım', 'Katılıyorum', 'Tamamen Katılıyorum'] :
                                                                       ['Kesinlikle Katılmıyorum', 'Katılmıyorum', 'Biraz Katılmıyorum', 'Kararsızım', 'Biraz Katılıyorum', 'Katılıyorum', 'Kesinlikle Katılıyorum'];
                                                
                                                const newSecenekler = Array.from({length: v}).map((_, i) => ({
                                                  id: Math.random().toString(36).substr(2, 9),
                                                  metin: soru.secenekler?.[i]?.metin || defaultOptions[i] || `Seçenek ${i+1}`
                                                }));
                                                
                                                updateSoru(anketIdx, soru.id, { likert_olcek: v, secenekler: newSecenekler });
                                              }}
                                              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${soru.likert_olcek === v ? 'bg-[#8b1ce8] text-white shadow-sm' : 'bg-white text-slate-600 border border-slate-200 hover:border-purple-300 hover:text-purple-600'}`}
                                            >
                                              {v}'li Likert
                                            </button>
                                          ))}
                                        </div>
                                      </div>

                                      <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm">
                                        <div className="overflow-x-auto">
                                          <table className="w-full text-left min-w-max border-collapse">
                                            <thead>
                                              <tr>
                                                <th className="p-4 bg-white min-w-[280px] border-b border-r border-slate-100">
                                                  <div className="flex items-center gap-2 text-sm font-bold text-slate-700">
                                                    Satırlar (İfadeler) <Info className="w-4 h-4 text-slate-400" />
                                                  </div>
                                                </th>
                                                <th className="p-4 bg-white border-b border-slate-100" colSpan={soru.secenekler?.length || 1}>
                                                  <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-2 text-sm font-bold text-slate-700">
                                                      Seçenekler <Info className="w-4 h-4 text-slate-400" />
                                                    </div>
                                                    <button 
                                                      onClick={() => {
                                                        const newSecenekler = [...(soru.secenekler || []), { id: Math.random().toString(36).substr(2, 9), metin: 'Yeni Seçenek' }];
                                                        updateSoru(anketIdx, soru.id, { secenekler: newSecenekler, likert_olcek: newSecenekler.length });
                                                      }}
                                                      className="flex items-center gap-1.5 text-xs font-bold text-[#8b1ce8] hover:text-purple-700 transition-colors"
                                                    >
                                                      <PlusCircle className="w-4 h-4" /> Seçenek Ekle
                                                    </button>
                                                  </div>
                                                </th>
                                                <th className="p-4 bg-white border-b border-slate-100 w-12"></th>
                                              </tr>
                                              <tr>
                                                <td className="p-3 border-r border-slate-100 border-b border-slate-100 bg-white"></td>
                                                {soru.secenekler?.map((sec, sIdx) => (
                                                  <td key={sec.id} className="p-3 min-w-[130px] border-r border-slate-100 border-b border-slate-100 bg-white">
                                                    <div className="relative group/opt flex items-center bg-white border border-slate-200 rounded-lg px-2 py-2 focus-within:border-[#8b1ce8] focus-within:ring-1 focus-within:ring-[#8b1ce8] transition-all">
                                                      <input 
                                                        type="text"
                                                        value={sec.metin}
                                                        onChange={(e) => {
                                                          const newSecenekler = [...(soru.secenekler || [])];
                                                          newSecenekler[sIdx].metin = e.target.value;
                                                          updateSoru(anketIdx, soru.id, { secenekler: newSecenekler });
                                                        }}
                                                        className="w-full text-xs font-medium text-slate-700 text-center focus:outline-none bg-transparent"
                                                      />
                                                      <Pencil className="w-3 h-3 text-slate-300 absolute right-2 opacity-0 group-hover/opt:opacity-100 transition-opacity pointer-events-none" />
                                                    </div>
                                                  </td>
                                                ))}
                                                <td className="border-b border-slate-100 bg-white"></td>
                                              </tr>
                                            </thead>
                                            <tbody>
                                              {(soru.birimler || ['İfade 1']).map((ifade, iIdx) => (
                                                <tr key={iIdx} className="hover:bg-slate-50/50 transition-colors group/row">
                                                  <td className="p-3 border-r border-b border-slate-100">
                                                    <div className="flex items-center gap-3">
                                                      <GripVertical className="w-4 h-4 text-slate-300 cursor-grab" />
                                                      <span className="w-6 h-6 flex items-center justify-center bg-slate-50 text-slate-600 font-bold text-xs rounded border border-slate-100">
                                                        {iIdx + 1}
                                                      </span>
                                                      <div className="relative flex-1 group/input flex items-center bg-white border border-slate-200 rounded-lg px-3 py-2 focus-within:border-[#8b1ce8] focus-within:ring-1 focus-within:ring-[#8b1ce8] transition-all">
                                                        <input 
                                                          type="text"
                                                          value={ifade}
                                                          onChange={(e) => {
                                                            const newBirimler = [...(soru.birimler || [])];
                                                            newBirimler[iIdx] = e.target.value;
                                                            updateSoru(anketIdx, soru.id, { birimler: newBirimler });
                                                          }}
                                                          className="w-full text-xs font-medium text-slate-700 focus:outline-none bg-transparent"
                                                          placeholder="İfade yazın..."
                                                        />
                                                        <Pencil className="w-3.5 h-3.5 text-slate-300 absolute right-2 opacity-0 group-hover/input:opacity-100 transition-opacity pointer-events-none" />
                                                      </div>
                                                    </div>
                                                  </td>
                                                  {soru.secenekler?.map(sec => (
                                                    <td key={sec.id} className="p-3 text-center border-r border-b border-slate-100">
                                                      <div className="w-4 h-4 rounded-full border-2 border-slate-300 mx-auto group-hover/row:border-[#8b1ce8] transition-colors"></div>
                                                    </td>
                                                  ))}
                                                  <td className="p-3 text-center border-b border-slate-100">
                                                    <button 
                                                      onClick={() => {
                                                        const newBirimler = (soru.birimler || []).filter((_, idx) => idx !== iIdx);
                                                        updateSoru(anketIdx, soru.id, { birimler: newBirimler });
                                                      }}
                                                      className="text-slate-300 hover:text-red-500 transition-colors p-1"
                                                    >
                                                      <Trash2 className="w-4 h-4" />
                                                    </button>
                                                  </td>
                                                </tr>
                                              ))}
                                            </tbody>
                                          </table>
                                        </div>
                                        <div className="p-4 bg-white border-t border-slate-100">
                                          <button 
                                            onClick={() => {
                                              const newBirimler = [...(soru.birimler || []), `İfade ${(soru.birimler?.length || 0) + 1}`];
                                              updateSoru(anketIdx, soru.id, { birimler: newBirimler });
                                            }}
                                            className="flex items-center gap-1.5 text-xs font-bold text-[#8b1ce8] hover:text-purple-700 transition-colors"
                                          >
                                            <PlusCircle className="w-4 h-4" /> Satır Ekle
                                          </button>
                                        </div>
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
                                              value={birim}
                                              onChange={(e) => {
                                                const newBirimler = [...(soru.birimler || [])];
                                                newBirimler[bIdx] = e.target.value;
                                                updateSoru(anketIdx, soru.id, { birimler: newBirimler });
                                              }}
                                              className="bg-transparent text-xs font-bold text-slate-700 focus:outline-none w-24"
                                            />
                                            <button onClick={() => {
                                              updateSoru(anketIdx, soru.id, { birimler: soru.birimler?.filter((_, i) => i !== bIdx) });
                                            }} className="text-slate-400 hover:text-red-500"><Trash2 className="w-3 h-3" /></button>
                                          </div>
                                        ))}
                                        <button 
                                          onClick={() => updateSoru(anketIdx, soru.id, { birimler: [...(soru.birimler || []), `Birim ${soru.birimler?.length || 0 + 1}`] })}
                                          className="px-3 py-1.5 bg-white border border-dashed border-slate-300 text-slate-400 rounded-lg text-xs font-bold hover:border-purple-300 hover:text-purple-600 transition-all"
                                        >
                                          + Birim Ekle
                                        </button>
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
                                            className="flex-1 text-sm bg-transparent border-b border-slate-100 focus:border-purple-400 focus:outline-none py-1 transition-colors resize-none overflow-hidden"
                                            placeholder={`Seçenek ${secIdx + 1}`}
                                          />
                                          {soru.secenekler && soru.secenekler.length > 1 && (
                                            <button onClick={() => {
                                              updateSoru(anketIdx, soru.id, { secenekler: soru.secenekler?.filter(sec => sec.id !== secenek.id) });
                                            }} className="text-slate-200 group-hover/opt:text-red-500 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                                          )}
                                        </div>
                                      ))}
                                      <button 
                                        onClick={() => {
                                          const newSecenekler = [...(soru.secenekler || []), { id: Math.random().toString(36).substr(2, 9), metin: `` }];
                                          updateSoru(anketIdx, soru.id, { secenekler: newSecenekler });
                                        }}
                                        className="text-[10px] font-black text-purple-600 hover:text-purple-700 mt-2 flex items-center gap-1.5 uppercase tracking-tighter"
                                      >
                                        <Plus className="w-3 h-3" /> Seçenek Ekle
                                      </button>
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
              </div>
            )}
          </div>
        ))}
        </div>
      )}

      {!isObserver && (
        <div className="flex justify-end p-6 bg-white border-t border-slate-200 sticky bottom-0 z-10 shadow-[0_-4px_6px_-1px_rgb(0,0,0,0.05)] rounded-t-2xl mb-12">
          <button 
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-3 rounded-xl text-sm font-bold transition-all shadow-md active:scale-[0.98] disabled:opacity-50"
          >
            {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
            {isSaving ? t('saving') : t('save_and_distribute')}
          </button>
        </div>
      )}

      {/* 3. Yayınlanan Anketler ve Canlı Analizler Paneli */}
      {yayinlananAnketler.length > 0 && (
        <div className="mt-12">
          <div className="flex items-center gap-3 mb-6 border-b border-slate-200 pb-4">
            <div className="bg-purple-100 p-2 rounded-lg"><BarChart2 className="w-6 h-6 text-purple-600" /></div>
            <h2 className="text-2xl font-bold text-slate-800">{t('published_surveys')}</h2>
          </div>

          <div className="space-y-8">
            {yayinlananAnketler.map(anket => {
              const anketId = anket.id as string;
              const yanitSayisi = toplamCevaplar[anketId] || 0;
              const hedefler = getOlcutKods(anket.hedef_olcutler || []);

              return (
                <div key={`analiz_${anketId}`} className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                  <div className="p-6 border-b border-slate-200 bg-slate-50 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                      <h3 className="text-xl font-bold text-slate-800">{anket.baslik}</h3>
                      <div className="flex flex-wrap gap-2 mt-2">
                        <span className="px-2 py-1 bg-purple-100 text-purple-700 text-xs font-bold rounded-lg border border-purple-200">
                          {t('responses', { count: yanitSayisi })}
                        </span>
                        <button 
                          onClick={() => handleCopyLink(anketId)}
                          className="flex items-center gap-1.5 px-2 py-1 bg-white border border-slate-200 text-slate-600 rounded-lg text-xs font-semibold hover:bg-slate-50 transition-colors"
                        >
                          <LinkIcon className="w-3.5 h-3.5" /> {t('copy_link')}
                        </button>
                        <button 
                          onClick={() => handleExportSurveyExcel(anket)}
                          className="flex items-center gap-1.5 px-2 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg text-xs font-semibold hover:bg-emerald-100 transition-colors"
                        >
                          <FileSpreadsheet className="w-3.5 h-3.5" /> Excel Olarak İndir
                        </button>

                        {!isObserver && (
                          <button 
                            onClick={() => deleteYayinlananAnket(anketId, anket.baslik)}
                            className="flex items-center gap-1.5 px-2 py-1 bg-red-50 text-red-600 rounded-lg text-xs font-semibold hover:bg-red-100 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" /> Anketi Kaldır
                          </button>
                        )}
                      </div>
                    </div>
                    {hedefler.length > 0 && (
                      <div className="flex flex-col gap-1 md:items-end">
                        <span className="text-xs font-bold text-slate-500 uppercase">Atanan Ölçütler (Gizli)</span>
                        <div className="flex flex-wrap gap-1 md:justify-end max-w-sm">
                          {hedefler.map(k => (
                            <span key={k} className="px-2 py-0.5 bg-slate-200 text-slate-700 text-[10px] font-bold rounded border border-slate-300">
                              {k}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  
                  <div className="p-6">
                    {yanitSayisi === 0 ? (
                      <div className="text-center py-8 text-slate-600 font-bold text-sm bg-slate-50 rounded-xl border border-dashed border-slate-200">
                        Henüz hiç yanıt alınmamış.
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {anket.sorular.filter(s => s.tip !== 'bilgi_kutusu' && s.tip !== 'bolum_basligi').map((soru) => {
                          const soruOzetleri = cevapOzetleri[anketId]?.find(co => co.soru_id === soru.id)?.cevaplar || [];
                          let chartData: any[] = [];
                          
                          if (soru.tip === 'coktan_secmeli' || soru.tip === 'coklu_secim' || soru.tip === 'acilir_menu') {
                            const frequency: Record<string, number> = {};
                            soruOzetleri.forEach(c => {
                              if (Array.isArray(c)) {
                                c.forEach(item => {
                                  if (item) frequency[item] = (frequency[item] || 0) + 1;
                                });
                              } else if (c) {
                                frequency[c] = (frequency[c] || 0) + 1;
                              }
                            });
                            chartData = (soru.secenekler || []).map(sec => ({
                              name: sec.metin,
                              deger: frequency[sec.id] || 0
                            }));
                          } else if (soru.tip === 'likert') {
                            chartData = []; // Likert verisi tablo olarak basılacak
                          }

                          const isTextResponse = soru.tip === 'kisa_yanit' || soru.tip === 'uzun_yanit';
                          const isLikert = soru.tip === 'likert';
                          const isCokluMetin = soru.tip === 'coklu_metin';

                          const safeSecenekler = soru.secenekler && soru.secenekler.length > 0
                            ? soru.secenekler
                            : Array.from({ length: soru.likert_olcek || 5 }).map((_, i) => ({ id: `col${i}`, metin: (i + 1).toString() }));
                          
                          const safeBirimler = soru.birimler && soru.birimler.length > 0
                            ? soru.birimler
                            : ['Değerlendirme İfadesi'];

                          return (
                            <div key={`chart_${soru.id}`} className={`bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col ${isTextResponse || isLikert || isCokluMetin ? 'h-auto max-h-[400px]' : 'h-[280px]'}`}>
                              <h4 className="font-semibold text-slate-700 mb-4 text-xs text-center line-clamp-2" title={soru.soru}>{soru.soru}</h4>
                              <div className="flex-1 w-full overflow-y-auto">
                                {isTextResponse ? (
                                  <div className="space-y-2 pr-2">
                                    {soruOzetleri.filter(c => c && typeof c === 'string' && c.trim() !== '').length > 0 ? (
                                      soruOzetleri.filter(c => c && typeof c === 'string' && c.trim() !== '').map((cevap, cIdx) => (
                                        <div key={cIdx} className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-sm text-slate-700 break-words flex gap-3 shadow-sm mb-2">
                                          <span className="font-bold text-slate-400 select-none min-w-[20px]">{cIdx + 1}.</span>
                                          <span className="flex-1 leading-relaxed">{cevap}</span>
                                        </div>
                                      ))
                                    ) : (
                                      <div className="text-center text-slate-400 text-xs py-4">Yanıt yok.</div>
                                    )}
                                  </div>
                                ) : isCokluMetin ? (
                                  <div className="space-y-3 pr-2">
                                    {soruOzetleri.filter(c => c && typeof c === 'object').length > 0 ? (
                                      soruOzetleri.filter(c => c && typeof c === 'object').map((cevapObj, cIdx) => (
                                        <div key={cIdx} className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-xs text-slate-700 space-y-1 shadow-sm mb-2">
                                          <div className="font-bold text-slate-400 select-none border-b pb-1 mb-1">Cevap #{cIdx + 1}</div>
                                          {Object.entries(cevapObj).map(([birimKey, val]) => (
                                            <div key={birimKey} className="flex flex-col md:flex-row gap-1 border-b border-slate-100 last:border-0 pb-1">
                                              <span className="font-bold text-slate-600 min-w-[100px]">{birimKey}:</span>
                                              <span className="text-slate-800 break-all">{String(val || '')}</span>
                                            </div>
                                          ))}
                                        </div>
                                      ))
                                    ) : (
                                      <div className="text-center text-slate-400 text-xs py-4">Yanıt yok.</div>
                                    )}
                                  </div>
                                ) : isLikert ? (
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
                                ) : (
                                  <div style={{ width: '100%', height: '220px' }} className="mt-2">
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
                                )}
                              </div>
                            </div>
                          );
                        })}
                        {anket.sorular.filter(s => s.tip !== 'kisa_yanit').length === 0 && (
                          <div className="col-span-full text-center py-4 text-slate-500 text-sm">Grafiği çizilebilecek soru tipi bulunamadı.</div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
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
                      <div key={soru.id} className={`bg-white p-8 rounded-2xl shadow-sm border transition-all ${soru.tip === 'bilgi_kutusu' ? 'border-amber-200 bg-amber-50/20' : soru.tip === 'bolum_basligi' ? 'border-none bg-gradient-to-r from-purple-50 to-blue-50 shadow-inner' : 'border-slate-200'}`}>
                        {soru.tip === 'bilgi_kutusu' ? (
                          <div className="prose prose-slate max-w-none">
                            <h3 className="text-xl font-bold text-slate-900 border-b pb-2 mb-4">{soru.soru}</h3>
                            <div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(soru.aciklama || '') }} />
                          </div>
                        ) : soru.tip === 'bolum_basligi' ? (
                          <div className="py-4 border-b-2 border-purple-500 pb-4">
                            <h2 className="text-2xl font-black text-slate-800 tracking-tight">{soru.soru}</h2>
                            {soru.aciklama && <p className="text-sm text-slate-500 mt-2 font-medium">{soru.aciklama}</p>}
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
