import { SupabaseClient } from '@supabase/supabase-js';

export type LogType = 'INSERT' | 'UPDATE' | 'DELETE' | 'SEAL';

interface LogParams {
  supabase: SupabaseClient<any, any, any>;
  userId?: string;
  islemTipi: LogType;
  tabloAdi: string;
  kayitId?: string;
  eskiVeri?: any;
  yeniVeri?: any;
}

export async function logSystemAction({
  supabase,
  userId,
  islemTipi,
  tabloAdi,
  kayitId,
  eskiVeri,
  yeniVeri,
  detay
}: LogParams & { detay?: string }) {
  try {
    let finalUserId = userId;
    
    if (!finalUserId) {
      const { data: { user } } = await supabase.auth.getUser();
      finalUserId = user?.id;
    }

    if (!finalUserId) {
      console.warn("LogSystemAction: No user found, skipping log.");
      return;
    }

    // Try with both kullanici_id and user_id to avoid schema mismatches
    const payload: any = {
      islem_tipi: islemTipi,
      tablo_adi: tabloAdi,
      kayit_id: kayitId,
      eski_veri: eskiVeri,
      yeni_veri: yeniVeri
    };
    
    if (detay) {
      payload.detay = detay;
    }
    
    // Most common is kullanici_id in this project, but we'll try it
    payload.kullanici_id = finalUserId;

    const { error } = await supabase.from('system_islem_loglari').insert(payload);

    if (error) {
      // If error mentions kullanici_id doesn't exist, try user_id
      if (error.message.includes('kullanici_id')) {
        delete payload.kullanici_id;
        payload.user_id = finalUserId;
        const { error: retryError } = await supabase.from('system_islem_loglari').insert(payload);
        if (retryError) console.error('Audit Log Retry Error:', retryError.message);
      } else {
        console.error('Audit Log Error:', error.message);
      }
    }
  } catch (err) {
    console.error('Audit Log Fatal Error:', err);
  }
}

// Keep old logAction for backward compatibility
export const logAction = logSystemAction;
