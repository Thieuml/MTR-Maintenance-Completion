/**
 * Setup script for Novu workflows
 * Run: npm run setup:novu
 */

import { createMTRWorkflows } from '../lib/novu'

async function main() {
  console.log('🚀 Setting up Novu workflows for MTR Maintenance Tracking...')
  
  try {
    await createMTRWorkflows()
    console.log('✅ Novu workflows setup completed!')
    console.log('')
    console.log('Next steps:')
    console.log('1. Go to Novu Dashboard → Workflows')
    console.log('2. Customize the notification templates in Chinese')
    console.log('3. Configure email/SMS channels if needed')
  } catch (error) {
    console.error('❌ Failed to setup workflows:', error)
    process.exit(1)
  }
}

main()

