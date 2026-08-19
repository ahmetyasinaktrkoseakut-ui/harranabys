'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase/client';
import { Loader2, Save, Users, AlertCircle, CheckCircle2, Search, Trash2 } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';

const TOPICS = [
  'Kalite Güvencesi',
  'Eğitim-Öğretim',
  'Araştırma ve Geliştirme',
  'Toplumsal Katkı',
  'Yönetim Sistemi'
];

const TOPIC_TRANSLATIONS: Record<string, Record<string, string>> = {
  tr: {
    'Kalite Güvencesi': 'Kalite Güvencesi',
    'Eğitim-Öğretim': 'Eğitim-Öğretim',
    'Araştırma ve Geliştirme': 'Araştırma ve Geliştirme',
    'Toplumsal Katkı': 'Toplumsal Katkı',
    'Yönetim Sistemi': 'Yönetim Sistemi',
    'Tüm Sistem': 'Tüm Sistem'
  },
  en: {
    'Kalite Güvencesi': 'Quality Assurance',
    'Eğitim-Öğretim': 'Education-Training',
    'Araştırma ve Geliştirme': 'Research and Development',
    'Toplumsal Katkı': 'Social Contribution',
    'Yönetim Sistemi': 'Management System',
    'Tüm Sistem': 'All System'
  },
  ar: {
    'Kalite Güvencesi': 'ضمان الجودة',
    'Eğitim-Öğretim': 'التعليم والتدريب',
    'Araştırma ve Geliştirme': 'البحث والتطوير',
    'Toplumsal Katkı': 'المساهمة المجتمعية',
    'Yönetim Sistemi': 'نظام الإدارة',
    'Tüm Sistem': 'النظام بأكمله'
  }
};

const ROLE_TRANSLATIONS: Record<string, Record<string, string>> = {
  tr: {
    'Koordinatör': 'Koordinatör',
    'Gözlemci': 'Gözlemci',
    'Atanacak Rol': 'Atanacak Rol',
    'Koordinatör (Veri Girişlerini Onaylayabilir/Düzenleyebilir)': 'Koordinatör (Veri Girişlerini Onaylayabilir/Düzenleyebilir)',
    'Gözlemci (Tüm Sistemi Görüntüleyebilir, Müdahale Edemez)': 'Gözlemci (Tüm Sistemi Görüntüleyebilir, Müdahale Edemez)',
    'Gözlemci İçin Başlık Seçilmez': '-- Gözlemci İçin Başlık Seçilmez --',
    'Başarılı': 'Başarılı',
    'Hata': 'Hata'
  },
  en: {
    'Koordinatör': 'Coordinator',
    'Gözlemci': 'Observer',
    'Atanacak Rol': 'Role to Assign',
    'Koordinatör (Veri Girişlerini Onaylayabilir/Düzenleyebilir)': 'Coordinator (Can Approve/Edit Data Entries)',
    'Gözlemci (Tüm Sistemi Görüntüleyebilir, Müdahale Edemez)': 'Observer (Can View All System, Cannot Interfere)',
    'Gözlemci İçin Başlık Seçilmez': '-- No Topic Selection for Observer --',
    'Başarılı': 'Success',
    'Hata': 'Error'
  },
  ar: {
    'Koordinatör': 'منسق',
    'Gözlemci': 'مراقب',
    'Atanacak Rol': 'الدور المراد تعيينه',
    'Koordinatör (Veri Girişlerini Onaylayabilir/Düzenleyebilir)': 'منسق (يمكنه الموافقة/تعديل مدخلات البيانات)',
    'Gözlemci (Tüm Sistemi Görüntüleyebilir, Müdahale Edemez)': 'مراقب (يمكنه عرض النظام بأكمله، ولا يمكنه التدخل)',
    'Gözlemci İçin Başlık Seçilmez': '-- لا يتم اختيار عنوان للمراقب --',
    'Başarılı': 'نجاح',
    'Hata': 'خطأ'
  }
};

const getTopicText = (topic: string, lang: string) => {
  const translations = TOPIC_TRANSLATIONS[lang] || TOPIC_TRANSLATIONS['tr'];
  return translations[topic] || topic;
};

const getRoleText = (role: string, lang: string) => {
  const translations = ROLE_TRANSLATIONS[lang] || ROLE_TRANSLATIONS['tr'];
  return translations[role] || role;
};

export default function KoordinatorlerPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [coordinators, setCoordinators] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [selectedUser, setSelectedUser] = useState<string>('');
  const [selectedTopic, setSelectedTopic] = useState<string>('');
  const [selectedRole, setSelectedRole] = useState<'Koordinatör' | 'Gözlemci'>('Koordinatör');
  
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isObserver, setIsObserver] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  const t = useTranslations('Coordinators');
  const tCommon = useTranslations('Common');
  const locale = useLocale();
  
  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true);
      setMessage(null);
      
      const { data: profiles, error: pError } = await supabase
        .from('profiller')
        .select('*');
        
      if (pError) throw pError;
      setUsers(profiles || []);

      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const currentUserProfile = (profiles || []).find(p => String(p.id) === String(user.id));
        const role = currentUserProfile?.rol?.toLowerCase() || '';
        setIsObserver(role.includes('gözlemci') || role.includes('gozlemci'));
      }

      const { data: coords, error: cError } = await supabase
        .from('baslik_koordinatorleri')
        .select('*');
        
      if (cError) throw cError;
      setCoordinators(coords || []);

    } catch (error: any) {
      console.error('Error fetching data:', error);
      setMessage({ 
        type: 'error', 
        text: `${t('fetch_error') || 'Veriler yüklenirken bir hata oluştu:'} ${error.message || tCommon('unknown_error') || 'Bilinmeyen hata'}` 
      });
    } finally {
      setIsLoading(false);
    }
  }, [t, tCommon]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleAssign = async () => {
    if (!selectedUser || (selectedRole !== 'Gözlemci' && !selectedTopic)) {
      setMessage({ type: 'error', text: t('select_user_topic_error') || 'Lütfen kullanıcı ve başlık seçiniz.' });
      return;
    }

    setIsSaving(true);
    setMessage(null);

    try {
      // rpc_v4_assign_koordinator_with_role kullanarak atomik işlem yapıyoruz.
      const { error } = await supabase.rpc('rpc_v4_assign_koordinator_with_role', {
        p_user_id: selectedUser,
        p_baslik: selectedRole === 'Gözlemci' ? null : selectedTopic,
        p_rol: selectedRole
      });

      if (error) throw error;

      setMessage({ type: 'success', text: t('assign_success') || 'Koordinatör başarıyla atandı.' });
      setSelectedUser('');
      setSelectedTopic('');
      setSelectedRole('Koordinatör');
      fetchData(); // Listeyi yenile
    } catch (error: any) {
      console.error('Save error:', error);
      setMessage({ type: 'error', text: `${t('assign_error') || 'Atama kaydedilirken hata oluştu:'} ${error.message}` });
    } finally {
      setIsSaving(false);
    }
  };

  const getFullName = (u: any) => {
    if (!u) return tCommon('unknown_user') || 'Bilinmeyen Kullanıcı';
    const name = u.ad_soyad || (u.ad && u.soyad ? `${u.ad} ${u.soyad}` : (u.ad || u.name || tCommon('unnamed') || 'İsimsiz'));
    return `${u.unvan ? u.unvan + ' ' : ''}${name}`;
  };

  const handleRemove = async (kullanici_id: string, baslik: string) => {
    const translatedBaslik = getTopicText(baslik, locale);
    if (!window.confirm(t('delete_confirm', { baslik: translatedBaslik }) || `${translatedBaslik} koordinatörlüğünü silmek istediğinize emin misiniz?`)) return;
    
    try {
      if (baslik === 'Tüm Sistem') {
        // Gözlemci atamasını silmek için doğrudan tablo işlemleri yapıyoruz (RPC'deki NULL parametre karşılaştırma hatasını aşmak için)
        const { error: deleteError } = await supabase
          .from('baslik_koordinatorleri')
          .delete()
          .eq('kullanici_id', kullanici_id)
          .is('baslik', null);
          
        if (deleteError) throw deleteError;

        // Profil rolünü BirimSorumlusu yapıyoruz
        const { error: profileError } = await supabase
          .from('profiller')
          .update({ rol: 'BirimSorumlusu' })
          .eq('id', kullanici_id);
          
        if (profileError) throw profileError;
      } else {
        const { error } = await supabase.rpc('rpc_v4_remove_koordinator', {
          p_user_id: kullanici_id,
          p_baslik: baslik
        });
          
        if (error) throw error;
      }
      
      setMessage({ type: 'success', text: tCommon('delete_success') || 'Atama silindi.' });
      fetchData();
    } catch (error: any) {
      console.error('Delete error:', error);
      setMessage({ type: 'error', text: tCommon('delete_error') || 'Silinirken hata oluştu.' });
    }
  };

  const filteredUsers = users
    .filter(u => {
      const fullName = getFullName(u).toLowerCase();
      const email = (u.email || '').toLowerCase();
      const search = searchTerm.toLowerCase();
      return fullName.includes(search) || email.includes(search);
    })
    .sort((a, b) => getFullName(a).localeCompare(getFullName(b)));

  return (
    <div className="p-8 mx-auto max-w-5xl animate-in fade-in duration-500">
      <div className="mb-8 border-b border-slate-200 pb-6 flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-3">
            <Users className="w-8 h-8 text-indigo-600" />
            {t('title') || 'Başlık Koordinatörleri'}
          </h2>
          <p className="text-slate-500 mt-2 font-medium max-w-2xl text-sm leading-relaxed">
            {t('description') || 'Bu ekrandan 5 ana başlık için koordinatör ataması yapabilirsiniz. Koordinatörler, kendi başlıkları altındaki ölçütleri birimlere dağıtabilir ve gelen veri girişlerini onaylayıp reddedebilir.'}
          </p>
        </div>
      </div>

      {message && (
        <div className={`mb-6 p-4 rounded-xl flex items-start gap-3 border ${
          message.type === 'success' ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'
        }`}>
          {message.type === 'success' ? <CheckCircle2 className="w-5 h-5 mt-0.5" /> : <AlertCircle className="w-5 h-5 mt-0.5" />}
          <div>
            <h3 className="text-sm font-semibold">{message.type === 'success' ? getRoleText('Başarılı', locale) : getRoleText('Hata', locale)}</h3>
            <p className="text-sm opacity-90">{message.text}</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        
        {/* Atama Formu */}
        <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-200/60 transition-all hover:shadow-md">
          <h3 className="text-lg font-extrabold text-slate-900 mb-6 border-b border-slate-100 pb-4">{t('new_assignment') || 'Yeni Atama Yap'}</h3>
          
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">{t('user_search') || 'Kullanıcı Arama'}</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input 
                  type="text" 
                  placeholder={t('search_placeholder') || "İsim veya E-posta..."}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">{t('select_user') || 'Kullanıcı Seçin'}</label>
              <select 
                value={selectedUser} 
                onChange={(e) => setSelectedUser(e.target.value)}
                className="w-full p-2 border rounded-lg text-sm bg-slate-50"
              >
                <option value="">{t('select_user_placeholder') || '-- Kullanıcı Seç --'}</option>
                {filteredUsers.slice(0, 100).map(u => (
                  <option key={u.id} value={u.id}>{getFullName(u)} ({u.email})</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">{t('assigned_topic') || 'Sorumlu Olacağı Başlık'}</label>
              <select 
                value={selectedRole === 'Gözlemci' ? '' : selectedTopic} 
                onChange={(e) => setSelectedTopic(e.target.value)}
                disabled={selectedRole === 'Gözlemci'}
                className="w-full p-2 border rounded-lg text-sm bg-slate-50 disabled:opacity-70"
              >
                {selectedRole === 'Gözlemci' ? (
                  <option value="">{getRoleText('Gözlemci İçin Başlık Seçilmez', locale)}</option>
                ) : (
                  <>
                    <option value="">{t('select_topic_placeholder') || '-- Başlık Seç --'}</option>
                    {TOPICS.map(topic => (
                      <option key={topic} value={topic}>{getTopicText(topic, locale)}</option>
                    ))}
                  </>
                )}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">{getRoleText('Atanacak Rol', locale)}</label>
              <select 
                value={selectedRole} 
                onChange={(e) => setSelectedRole(e.target.value as any)}
                disabled={isObserver}
                className="w-full p-2 border rounded-lg text-sm bg-slate-50 disabled:opacity-75"
              >
                <option value="Koordinatör">{getRoleText('Koordinatör (Veri Girişlerini Onaylayabilir/Düzenleyebilir)', locale)}</option>
                <option value="Gözlemci">{getRoleText('Gözlemci (Tüm Sistemi Görüntüleyebilir, Müdahale Edemez)', locale)}</option>
              </select>
            </div>

            <button
              onClick={handleAssign}
              disabled={isSaving || !selectedUser || (selectedRole !== 'Gözlemci' && !selectedTopic) || isObserver}
              className="w-full mt-6 flex items-center justify-center gap-3 bg-indigo-600 hover:bg-indigo-700 text-white py-4 rounded-xl text-sm font-bold transition-all shadow-lg shadow-indigo-500/20 active:scale-95 disabled:opacity-50"
            >
              {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
              {t('save_assignment') || 'Atamayı Kaydet'}
            </button>
          </div>
        </div>

        {/* Mevcut Atamalar Listesi */}
        <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-200/60 flex flex-col h-full min-h-[400px] transition-all hover:shadow-md">
          <h3 className="text-lg font-extrabold text-slate-900 mb-6 border-b border-slate-100 pb-4">{t('current_coordinators') || 'Mevcut Koordinatörler'}</h3>
          
          <div className="flex-1 overflow-y-auto pr-2 space-y-3">
            {(() => {
              const displayList = [
                ...coordinators.map(c => ({
                  kullanici_id: c.kullanici_id,
                  baslik: c.baslik,
                  isVirtual: false
                })),
                ...users
                  .filter(u => u.rol === 'Gozlemci')
                  .map(u => ({
                    kullanici_id: u.id,
                    baslik: 'Tüm Sistem',
                    isVirtual: true
                  }))
              ];

              if (isLoading) {
                return <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-blue-500" /></div>;
              }

              if (displayList.length === 0) {
                return (
                  <div className="text-center py-12 text-sm text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                    {t('no_coordinators') || 'Henüz atanmış bir koordinatör yok.'}
                  </div>
                );
              }

              return displayList.map(coord => {
                const user = users.find(u => String(u.id) === String(coord.kullanici_id));
                return (
                  <div key={coord.kullanici_id + coord.baslik} className="flex items-center justify-between p-5 border border-slate-100 rounded-2xl bg-white hover:bg-indigo-50/30 hover:border-indigo-100 hover:shadow-md transition-all group">
                    <div className="flex-1">
                      <div className="font-extrabold text-sm text-slate-900 group-hover:text-indigo-700 transition-colors">
                        {getFullName(user)}
                      </div>
                      <div className="text-xs text-slate-500 font-medium mt-0.5">{user?.email || t('email_not_found') || 'E-posta bulunamadı'}</div>
                      <div className="inline-flex mt-4 px-3 py-1 bg-indigo-50 text-indigo-700 text-[10px] font-black rounded-lg uppercase tracking-widest border border-indigo-100 group-hover:bg-indigo-600 group-hover:text-white group-hover:border-indigo-600 transition-all">
                        {getTopicText(coord.baslik, locale)}
                      </div>
                      <div className={`inline-flex mt-4 ml-2 px-3 py-1 text-[10px] font-black rounded-lg uppercase tracking-widest border transition-all ${
                        coord.isVirtual || user?.rol === 'Gozlemci'
                          ? 'bg-amber-50 text-amber-700 border-amber-100'
                          : 'bg-slate-50 text-slate-700 border-slate-200'
                      }`}>
                        {coord.isVirtual || user?.rol === 'Gozlemci' ? getRoleText('Gözlemci', locale) : getRoleText('Koordinatör', locale)}
                      </div>
                    </div>
                    {!isObserver && (
                      <button 
                        onClick={() => handleRemove(coord.kullanici_id, coord.baslik)}
                        className="p-3 text-slate-300 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all opacity-0 group-hover:opacity-100"
                        title={t('remove_assignment') || "Atamayı Sil"}
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    )}
                  </div>
                );
              });
            })()}
          </div>
        </div>

      </div>
    </div>
  );
}
