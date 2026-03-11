import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://velrfjpesgcomktbcmin.supabase.co'
const SUPABASE_ANON_KEY =
  'sb_publishable_PH8Y71Bsi7wpKkHtcmEZMQ_DA6_Ky_w'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

