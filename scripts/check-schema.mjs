import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSchema() {
  const { data, error } = await supabase
    .from('alt_olcutler')
    .select('*')
    .limit(1);
    
  if (error) {
    console.error('Error fetching data:', error);
  } else {
    console.log('Sample data:', data);
  }
}

checkSchema();
