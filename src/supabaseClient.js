import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://naloiodfdylsogcxclli.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5hbG9pb2RmZHlsc29nY3hjbGxpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE4NDc3MzgsImV4cCI6MjA4NzQyMzczOH0.PU-TKV75JTXByW2LuMI2kTLnSQSoRol89jMDd1voxCU'

export const supabase = createClient(supabaseUrl, supabaseKey)