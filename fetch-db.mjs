import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data: anaBasliklar } = await supabase.from('ana_basliklar').select('id, baslik_adi');
  const { data: altOlcutler } = await supabase.from('alt_olcutler').select('id, kod, olcut_adi');

  console.log(JSON.stringify({ anaBasliklar, altOlcutler }, null, 2));
}

run();
