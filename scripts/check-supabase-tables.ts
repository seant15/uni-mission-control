import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://jcghdthijgjttmpthagj.supabase.co'
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || 'dev-key-placeholder'

const supabase = createClient(supabaseUrl, supabaseKey)

async function checkTables() {
  console.log('Checking Supabase tables...\n')

  // Check for alerts table
  console.log('1. Checking alerts table:')
  const { data: alerts, error: alertsError } = await supabase
    .from('alerts')
    .select('*')
    .limit(1)

  if (alertsError) {
    console.log('❌ alerts table error:', alertsError.message)
  } else {
    console.log('✅ alerts table exists')
    if (alerts && alerts.length > 0) {
      console.log('   Sample columns:', Object.keys(alerts[0]))
    }
  }

  // Check for client_accounts table
  console.log('\n2. Checking client_accounts table:')
  const { data: accounts, error: accountsError } = await supabase
    .from('client_accounts')
    .select('*')
    .limit(1)

  if (accountsError) {
    console.log('❌ client_accounts table error:', accountsError.message)
  } else {
    console.log('✅ client_accounts table exists')
    if (accounts && accounts.length > 0) {
      console.log('   Sample columns:', Object.keys(accounts[0]))
    }
  }

  // Check for account_metrics table
  console.log('\n3. Checking account_metrics table:')
  const { data: metrics, error: metricsError } = await supabase
    .from('account_metrics')
    .select('*')
    .limit(1)

  if (metricsError) {
    console.log('❌ account_metrics table error:', metricsError.message)
  } else {
    console.log('✅ account_metrics table exists')
    if (metrics && metrics.length > 0) {
      console.log('   Sample columns:', Object.keys(metrics[0]))
    }
  }

  // Check for marketing_overview table
  console.log('\n4. Checking marketing_overview table:')
  const { data: overview, error: overviewError } = await supabase
    .from('marketing_overview')
    .select('*')
    .limit(1)

  if (overviewError) {
    console.log('❌ marketing_overview table error:', overviewError.message)
  } else {
    console.log('✅ marketing_overview table exists')
    if (overview && overview.length > 0) {
      console.log('   Sample columns:', Object.keys(overview[0]))
    }
  }
}

checkTables().catch(console.error)
