'use client';

import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase/client';
import { 
  Inbox, 
  Copy, 
  Check, 
  ExternalLink, 
  Search, 
  Filter, 
  Calendar, 
  Building2, 
  User, 
  FileText, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Loader2, 
  RefreshCw, 
  AlertCircle, 
  Eye, 
  Download,
  Share2,
  Sparkles,
  Trash2
} from 'lucide-react';
import { usePeriod } from '@/contexts/PeriodContext';
import { useLocale } from 'next-intl';

interface FaaliyetKaydi {
  id: string;
  donem_id: string;
  alt_olcut_id: number;
  ad_soyad: string;
  email: string | null;
  faaliyet_turu: string;
  faaliyet_adi: string;
  duzenleyen_kurum: string | null;
  faaliyet_tarihi: string;
  aciklama: string | null;
  dosya_adi: string;
  dosya_url: string;
  dosya_boyutu: number | null;
  durum: 'beklemede' | 'onaylandi' | 'reddedildi';
  olusturulma_tarihi: string;
  karar_veren_id: string | null;
  karar_tarihi: string | null;
  aktarilan_kanit_no: number | null;
  aktarilan_evidence_id: string | null;
  
  // Joined client-side
  olcut_kod?: string;
  olcut_adi?: string;
  ana_baslik_adi?: string;
}

export default function DisKanitlarPage() {
  const { selectedPeriod } = usePeriod();
  const locale = useLocale();

  const [faaliyetler, setFaaliyetler] = useState<FaaliyetKaydi[]>([]);
  const [altOlcutlerMap, setAltOlcutlerMap] = useState<Record<number, { kod: string; ad: string; ana_baslik_adi?: string }>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedTopic, setSelectedTopic] = useState<string>('all');
  const [copiedLink, setCopiedLink] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Selected item for detail modal
  const [selectedItem, setSelectedItem] = useState<FaaliyetKaydi | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  
  // Citation Modal after transfer
  const [citationModal, setCitationModal] = useState<{
    isOpen: boolean;
    citationText: string;
    kanitNo: number;
    faaliyetAdi: string;
  } | null>(null);

  const formUrl = useMemo(() => {
    if (typeof window === 'undefined') return '';
    return `${window.location.origin}/${locale}/faaliyet-bildirimi`;
  }, [locale]);

  const copyFormLink = () => {
    if (!formUrl) return;
    navigator.clipboard.writeText(formUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const loadData = async () => {
    try {
      setIsLoading(true);

      // 1. Ölçütleri çek
      const { data: olcutlerData } = await supabase
        .from('alt_olcutler')
        .select(`
          id,
          kod,
          olcut_adi,
          ana_baslik:ana_baslik_id (
            baslik_adi
          )
        `);

      const olcutMap: Record<number, { kod: string; ad: string; ana_baslik_adi?: string }> = {};
      if (olcutlerData) {
        olcutlerData.forEach((ao: any) => {
          olcutMap[ao.id] = {
            kod: ao.kod,
            ad: ao.olcut_adi,
            ana_baslik_adi: ao.ana_baslik?.baslik_adi,
          };
        });
      }
      setAltOlcutlerMap(olcutMap);

      // 2. Faaliyet kayıtlarını çek
      let query = supabase
        .from('dis_faaliyet_kanitlari')
        .select('*')
        .order('olusturulma_tarihi', { ascending: false });

      if (selectedPeriod?.id) {
        query = query.eq('donem_id', selectedPeriod.id);
      }

      const { data: records, error } = await query;
      if (error) throw error;

      const mapped: FaaliyetKaydi[] = (records || []).map((r: any) => {
        const oInfo = olcutMap[r.alt_olcut_id];
        return {
          ...r,
          olcut_kod: oInfo?.kod || 'Belirtilmedi',
          olcut_adi: oInfo?.ad || 'Ölçüt Bulunamadı',
          ana_baslik_adi: oInfo?.ana_baslik_adi || '',
        };
      });

      setFaaliyetler(mapped);
    } catch (err) {
      console.error('[DIS_KANITLAR] Veri çekme hatası:', err);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedPeriod]);

  // Filtreleme
  const filteredList = useMemo(() => {
    return faaliyetler.filter((item) => {
      // Durum filtresi
      if (selectedStatus !== 'all' && item.durum !== selectedStatus) {
        return false;
      }

      // Komisyon/Başlık filtresi
      if (selectedTopic !== 'all') {
        if (!item.olcut_kod?.startsWith(selectedTopic)) {
          return false;
        }
      }

      // Metin arama
      if (searchTerm.trim() !== '') {
        const query = searchTerm.toLowerCase();
        const matchesName = item.faaliyet_adi?.toLowerCase().includes(query);
        const matchesAuthor = item.ad_soyad?.toLowerCase().includes(query);
        const matchesOrg = item.duzenleyen_kurum?.toLowerCase().includes(query);
        const matchesType = item.faaliyet_turu?.toLowerCase().includes(query);
        const matchesCode = item.olcut_kod?.toLowerCase().includes(query);
        return matchesName || matchesAuthor || matchesOrg || matchesType || matchesCode;
      }

      return true;
    });
  }, [faaliyetler, selectedStatus, selectedTopic, searchTerm]);

  // İstatistikler
  const stats = useMemo(() => {
    const total = faaliyetler.length;
    const beklemede = faaliyetler.filter((f) => f.durum === 'beklemede').length;
    const onaylandi = faaliyetler.filter((f) => f.durum === 'onaylandi').length;
    const reddedildi = faaliyetler.filter((f) => f.durum === 'reddedildi').length;
    return { total, beklemede, onaylandi, reddedildi };
  }, [faaliyetler]);

  // Kanıtlara Aktar Eylemi
  const handleAktar = async (item: FaaliyetKaydi) => {
    if (!confirm(`"${item.faaliyet_adi}" başlıklı faaliyeti ${item.olcut_kod} ölçütünün Uygulama aşamasına aktarmak istiyor musunuz?`)) {
      return;
    }

    setActionLoadingId(item.id);
    try {
      const res = await fetch('/api/faaliyet-bildirimi/aktar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ faaliyetId: item.id }),
      });

      const result = await res.json();
      if (!res.ok || !result.success) {
        throw new Error(result.error || 'Aktarma işlemi gerçekleştirilemedi.');
      }

      await loadData();
      if (isDetailOpen && selectedItem?.id === item.id) {
        setIsDetailOpen(false);
      }

      if (result.atif_metni) {
        setCitationModal({
          isOpen: true,
          citationText: result.atif_metni,
          kanitNo: result.evidence_no,
          faaliyetAdi: item.faaliyet_adi,
        });
      } else {
        alert(`Faaliyet başarıyla [Kanıt ${result.evidence_no}] olarak eklendi.`);
      }
    } catch (err: any) {
      console.error('Aktarma hatası:', err);
      alert(err.message || 'Bir hata oluştu.');
    } finally {
      setActionLoadingId(null);
    }
  };

  // Reddet Eylemi
  const handleReddet = async (item: FaaliyetKaydi) => {
    if (!confirm(`"${item.faaliyet_adi}" başlıklı faaliyet bildirimini reddetmek istediğinize emin misiniz?`)) {
      return;
    }

    setActionLoadingId(item.id);
    try {
      const res = await fetch('/api/faaliyet-bildirimi/reddet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ faaliyetId: item.id }),
      });

      const result = await res.json();
      if (!res.ok || !result.success) {
        throw new Error(result.error || 'Reddetme işlemi başarısız.');
      }

      await loadData();
      if (isDetailOpen && selectedItem?.id === item.id) {
        setIsDetailOpen(false);
      }
      alert('Faaliyet bildirimi reddedildi.');
    } catch (err: any) {
      console.error('Reddet hatası:', err);
      alert(err.message || 'Bir hata oluştu.');
    } finally {
      setActionLoadingId(null);
    }
  };

  // Kalıcı Silme Eylemi
  const handleSil = async (item: FaaliyetKaydi) => {
    if (!confirm(`"${item.faaliyet_adi}" başlıklı faaliyet bildirimini ve yüklenen belgeyi KALICI OLARAK silmek istediğinize emin misiniz? Bu işlem geri alınamaz.`)) {
      return;
    }

    setActionLoadingId(item.id);
    try {
      const res = await fetch('/api/faaliyet-bildirimi/sil', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ faaliyetId: item.id }),
      });

      const result = await res.json();
      if (!res.ok || !result.success) {
        throw new Error(result.error || 'Silme işlemi gerçekleştirilemedi.');
      }

      await loadData();
      if (isDetailOpen && selectedItem?.id === item.id) {
        setIsDetailOpen(false);
      }
      alert('Faaliyet kaydı ve dosyası kalıcı olarak silindi.');
    } catch (err: any) {
      console.error('Silme hatası:', err);
      alert(err.message || 'Bir hata oluştu.');
    } finally {
      setActionLoadingId(null);
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      {/* Header Banner */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 bg-white p-7 rounded-2xl border border-slate-200 shadow-sm">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-200">
              <Inbox className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-800">Dış Faaliyet Kanıtları</h1>
              <p className="text-sm text-slate-500">
                Akademisyenlerin dışarıda gerçekleştirdikleri faaliyet ve kanıt belgelerinin merkezi gelen kutusu.
              </p>
            </div>
          </div>
        </div>

        {/* Public Form Link Share Box */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-600 font-mono">
            <Share2 className="w-3.5 h-3.5 text-slate-400" />
            <span className="truncate max-w-[200px] sm:max-w-[280px]">{formUrl || 'Yükleniyor...'}</span>
          </div>

          <button
            type="button"
            onClick={copyFormLink}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all shadow-sm ${
              copiedLink
                ? 'bg-emerald-600 text-white'
                : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-200'
            }`}
          >
            {copiedLink ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            {copiedLink ? 'Link Kopyalandı!' : 'Form Linkini Kopyala'}
          </button>

          <a
            href={`/${locale}/faaliyet-bildirimi`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-sm font-semibold transition-colors border border-slate-200"
            title="Formu Yeni Sekmede Aç"
          >
            <ExternalLink className="w-4 h-4 text-slate-500" />
            <span className="hidden sm:inline">Formu Aç</span>
          </a>

          <button
            type="button"
            onClick={() => {
              setRefreshing(true);
              loadData();
            }}
            disabled={refreshing}
            className="p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-colors border border-slate-200"
            title="Yenile"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center font-bold">
            <FileText className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-800">{stats.total}</div>
            <div className="text-xs text-slate-500 font-medium">Toplam Bildirim</div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center font-bold">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-bold text-amber-700">{stats.beklemede}</div>
            <div className="text-xs text-slate-500 font-medium">Bekleyen İnceleme</div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-bold text-emerald-700">{stats.onaylandi}</div>
            <div className="text-xs text-slate-500 font-medium">Kanıtlara Aktarılan</div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center font-bold">
            <XCircle className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-bold text-rose-700">{stats.reddedildi}</div>
            <div className="text-xs text-slate-500 font-medium">Reddedilen</div>
          </div>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-center gap-4 justify-between">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Faaliyet adı, hoca veya kurum ara..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          {/* Status Filter */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl text-xs font-semibold text-slate-600">
            <button
              onClick={() => setSelectedStatus('all')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                selectedStatus === 'all' ? 'bg-white text-slate-900 shadow-xs' : 'hover:text-slate-900'
              }`}
            >
              Tümü ({stats.total})
            </button>
            <button
              onClick={() => setSelectedStatus('beklemede')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                selectedStatus === 'beklemede' ? 'bg-white text-amber-700 shadow-xs' : 'hover:text-slate-900'
              }`}
            >
              Beklemede ({stats.beklemede})
            </button>
            <button
              onClick={() => setSelectedStatus('onaylandi')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                selectedStatus === 'onaylandi' ? 'bg-white text-emerald-700 shadow-xs' : 'hover:text-slate-900'
              }`}
            >
              Aktarılan ({stats.onaylandi})
            </button>
            <button
              onClick={() => setSelectedStatus('reddedildi')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                selectedStatus === 'reddedildi' ? 'bg-white text-rose-700 shadow-xs' : 'hover:text-slate-900'
              }`}
            >
              Reddedilen ({stats.reddedildi})
            </button>
          </div>

          {/* Topic Filter */}
          <select
            value={selectedTopic}
            onChange={(e) => setSelectedTopic(e.target.value)}
            className="text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
          >
            <option value="all">Tüm Başlıklar</option>
            <option value="A">A - Kalite Güvencesi</option>
            <option value="B">B - Eğitim ve Öğretim</option>
            <option value="C">C - Araştırma ve Geliştirme</option>
            <option value="D">D - Toplumsal Katkı</option>
            <option value="E">E - Yönetim Sistemi</option>
          </select>
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {isLoading ? (
          <div className="p-16 flex flex-col items-center justify-center gap-3 text-slate-400">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
            <p className="text-sm">Bildirimler yükleniyor...</p>
          </div>
        ) : filteredList.length === 0 ? (
          <div className="p-16 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
              <Inbox className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-semibold text-slate-700">Kayıt Bulunamadı</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Seçili filtrelere uygun dış faaliyet bildirimi bulunamadı veya henüz bu dönem için bir faaliyet iletilmedi.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-600 text-xs uppercase font-bold border-b border-slate-200 tracking-wider">
                <tr>
                  <th className="px-5 py-4">Tarih</th>
                  <th className="px-5 py-4">Faaliyet & Türü</th>
                  <th className="px-5 py-4">Yapan Kişi / Kurum</th>
                  <th className="px-5 py-4">Hedef Ölçüt</th>
                  <th className="px-5 py-4">Durum</th>
                  <th className="px-5 py-4">Belge</th>
                  <th className="px-5 py-4 text-right">İşlem</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredList.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                    {/* Tarih */}
                    <td className="px-5 py-4 whitespace-nowrap">
                      <div className="text-xs font-semibold text-slate-800">
                        {new Date(item.faaliyet_tarihi).toLocaleDateString('tr-TR')}
                      </div>
                      <div className="text-[11px] text-slate-400">
                        {new Date(item.olusturulma_tarihi).toLocaleDateString('tr-TR')}
                      </div>
                    </td>

                    {/* Faaliyet */}
                    <td className="px-5 py-4">
                      <div className="font-semibold text-slate-900 line-clamp-1" title={item.faaliyet_adi}>
                        {item.faaliyet_adi}
                      </div>
                      <div className="inline-block mt-1 px-2 py-0.5 rounded text-[11px] font-medium bg-indigo-50 text-indigo-700 border border-indigo-100">
                        {item.faaliyet_turu}
                      </div>
                    </td>

                    {/* Yapan / Kurum */}
                    <td className="px-5 py-4">
                      <div className="font-medium text-slate-800">{item.ad_soyad}</div>
                      <div className="text-xs text-slate-500 line-clamp-1">
                        {item.duzenleyen_kurum || item.email || '-'}
                      </div>
                    </td>

                    {/* Ölçüt */}
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-1.5">
                        <span className="px-2 py-0.5 rounded font-bold text-xs bg-slate-100 text-slate-800 border border-slate-200">
                          {item.olcut_kod}
                        </span>
                      </div>
                      <div className="text-xs text-slate-500 line-clamp-1 mt-0.5" title={item.olcut_adi}>
                        {item.olcut_adi}
                      </div>
                    </td>

                    {/* Durum */}
                    <td className="px-5 py-4 whitespace-nowrap">
                      {item.durum === 'beklemede' && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                          <Clock className="w-3 h-3" />
                          Beklemede
                        </span>
                      )}
                      {item.durum === 'onaylandi' && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <CheckCircle2 className="w-3 h-3" />
                          {item.aktarilan_kanit_no ? `[Kanıt ${item.aktarilan_kanit_no}]` : 'Aktarıldı'}
                        </span>
                      )}
                      {item.durum === 'reddedildi' && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                          <XCircle className="w-3 h-3" />
                          Reddedildi
                        </span>
                      )}
                    </td>

                    {/* Belge */}
                    <td className="px-5 py-4 whitespace-nowrap">
                      <a
                        href={item.dosya_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs font-medium text-indigo-600 hover:text-indigo-800 hover:underline"
                        title={item.dosya_adi}
                      >
                        <FileText className="w-3.5 h-3.5" />
                        <span className="truncate max-w-[120px]">{item.dosya_adi}</span>
                        {item.dosya_boyutu && (
                          <span className="text-[10px] text-slate-400">({item.dosya_boyutu} KB)</span>
                        )}
                      </a>
                    </td>

                    {/* İşlemler */}
                    <td className="px-5 py-4 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedItem(item);
                            setIsDetailOpen(true);
                          }}
                          className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
                          title="Detayları İncele"
                        >
                          <Eye className="w-4 h-4" />
                        </button>

                        {item.durum === 'beklemede' && (
                          <>
                            <button
                              type="button"
                              onClick={() => handleAktar(item)}
                              disabled={actionLoadingId === item.id}
                              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold transition-colors disabled:opacity-50"
                              title="Ölçütün Uygulama Aşamasına Kanıt Olarak Aktar"
                            >
                              {actionLoadingId === item.id ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                'Aktar'
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleReddet(item)}
                              disabled={actionLoadingId === item.id}
                              className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50"
                              title="Reddet"
                            >
                              Reddet
                            </button>
                          </>
                        )}

                        <button
                          type="button"
                          onClick={() => handleSil(item)}
                          disabled={actionLoadingId === item.id}
                          className="p-1.5 rounded-lg bg-slate-100 hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition-colors"
                          title="Kaydı ve Belgeyi Kalıcı Olarak Sil"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* DETAIL MODAL */}
      {isDetailOpen && selectedItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-2xl w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="p-6 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div>
                <span className="px-2.5 py-0.5 rounded text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                  {selectedItem.faaliyet_turu}
                </span>
                <h3 className="text-lg font-bold text-slate-900 mt-2">{selectedItem.faaliyet_adi}</h3>
              </div>
              <button
                onClick={() => setIsDetailOpen(false)}
                className="w-8 h-8 rounded-lg bg-white border border-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center transition-colors"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-4 text-xs">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-slate-400 font-bold block mb-1">GERÇEKLEŞTİREN:</span>
                  <p className="font-semibold text-slate-800 text-sm">{selectedItem.ad_soyad}</p>
                  <p className="text-slate-500">{selectedItem.email || 'E-posta belirtilmedi'}</p>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-slate-400 font-bold block mb-1">DÜZENLEYEN KURUM / YER:</span>
                  <p className="font-semibold text-slate-800 text-sm">
                    {selectedItem.duzenleyen_kurum || 'Belirtilmedi'}
                  </p>
                  <p className="text-slate-500">
                    Tarih: {new Date(selectedItem.faaliyet_tarihi).toLocaleDateString('tr-TR')}
                  </p>
                </div>
              </div>

              <div className="p-4 bg-indigo-50/60 rounded-xl border border-indigo-100 text-xs space-y-1">
                <span className="text-indigo-900 font-bold block">İLGİLİ ÖLÇÜT BİLGİSİ:</span>
                <p className="text-indigo-950 font-semibold text-sm">
                  {selectedItem.olcut_kod} - {selectedItem.olcut_adi}
                </p>
                {selectedItem.ana_baslik_adi && (
                  <p className="text-indigo-700">Komisyon: {selectedItem.ana_baslik_adi}</p>
                )}
              </div>

              {selectedItem.aciklama && (
                <div>
                  <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Açıklama / Detay:</h4>
                  <p className="text-sm text-slate-700 bg-slate-50 p-4 rounded-xl border border-slate-200 whitespace-pre-wrap">
                    {selectedItem.aciklama}
                  </p>
                </div>
              )}

              {/* Ek Belge */}
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-800">{selectedItem.dosya_adi}</p>
                    <p className="text-xs text-slate-500">
                      {selectedItem.dosya_boyutu ? `${selectedItem.dosya_boyutu} KB` : 'Belge Boyutu Belirsiz'}
                    </p>
                  </div>
                </div>

                <a
                  href={selectedItem.dosya_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  İndir / Aç
                </a>
              </div>

              {/* Karar Bilgisi */}
              {selectedItem.durum !== 'beklemede' && (
                <div className="p-4 rounded-xl border text-xs space-y-1 bg-slate-50 border-slate-200">
                  <span className="font-bold text-slate-700 block">İŞLEM DURUMU:</span>
                  <p className="text-slate-800">
                    Durum:{' '}
                    <span className="font-bold">
                      {selectedItem.durum === 'onaylandi'
                        ? `Uygulama Aşamasına [Kanıt ${selectedItem.aktarilan_kanit_no}] Olarak Aktarıldı`
                        : 'Reddedildi'}
                    </span>
                  </p>
                  {selectedItem.karar_tarihi && (
                    <p className="text-slate-500">
                      Karar Tarihi: {new Date(selectedItem.karar_tarihi).toLocaleString('tr-TR')}
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsDetailOpen(false)}
                  className="px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-xl text-xs font-semibold hover:bg-slate-100"
                >
                  Kapat
                </button>
                <button
                  type="button"
                  onClick={() => handleSil(selectedItem)}
                  disabled={actionLoadingId === selectedItem.id}
                  className="flex items-center gap-1.5 px-3 py-2 bg-white border border-rose-200 text-rose-600 hover:bg-rose-50 rounded-xl text-xs font-semibold transition-colors disabled:opacity-50"
                  title="Kaydı ve Belgeyi Kalıcı Olarak Sil"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Kalıcı Sil
                </button>
              </div>

              {selectedItem.durum === 'beklemede' && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleReddet(selectedItem)}
                    disabled={actionLoadingId === selectedItem.id}
                    className="px-4 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-semibold disabled:opacity-50"
                  >
                    Reddet
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAktar(selectedItem)}
                    disabled={actionLoadingId === selectedItem.id}
                    className="flex items-center gap-2 px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow-sm disabled:opacity-50"
                  >
                    {actionLoadingId === selectedItem.id ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <CheckCircle2 className="w-3.5 h-3.5" />
                    )}
                    Kanıtlara Aktar
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* CITATION MODAL AFTER TRANSFER */}
      {citationModal?.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-lg w-full p-6 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center">
                <Check className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Kanıt Başarıyla Aktarıldı!</h3>
                <p className="text-xs text-slate-500">
                  Faaliyet [Kanıt {citationModal.kanitNo}] numarasıyla ilgili ölçütün Uygulama aşamasına kaydedildi.
                </p>
              </div>
            </div>

            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-600">Önerilen Metin İçi Atıf Şablonu:</span>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(citationModal.citationText);
                    alert('Atıf metni panoya kopyalandı.');
                  }}
                  className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
                >
                  <Copy className="w-3 h-3" />
                  Kopyala
                </button>
              </div>
              <p className="text-xs text-slate-700 font-mono select-all bg-white p-3 rounded-lg border border-slate-200 leading-relaxed">
                {citationModal.citationText}
              </p>
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setCitationModal(null)}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold"
              >
                Anladım
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
