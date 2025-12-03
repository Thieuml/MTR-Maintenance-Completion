/**
 * Test script for Novu notifications
 * Run: npm run test:novu
 */

import { notifyTonightSchedule, notifyMissedCommittedDate } from '../lib/novu'

async function main() {
  console.log('🧪 Testing Novu notifications...')
  console.log('')

  // Test 1: Tonight's schedule notification
  console.log('Test 1: Tonight Schedule Notification')
  console.log('=====================================')
  try {
    await notifyTonightSchedule({
      engineerId: 'test-engineer-1',
      engineerEmail: 'test@example.com',
      engineerName: '測試工程師',
      units: [
        {
          equipmentNumber: 'HOK-E25',
          station: 'HK Station',
          timeSlot: '23:00',
          workOrderNumber: '5000355448',
        },
        {
          equipmentNumber: 'HOK-E26',
          station: 'HK Station',
          timeSlot: '01:30',
          workOrderNumber: '5000355449',
        },
        {
          equipmentNumber: 'HOK-SL11',
          station: 'HK Station',
          timeSlot: '03:30',
        },
      ],
      date: new Date(),
    })
    console.log('✅ Tonight schedule notification sent successfully')
  } catch (error) {
    console.error('❌ Failed to send tonight schedule notification:', error)
  }

  console.log('')

  // Test 2: Missed committed date notification
  console.log('Test 2: Missed Committed Date Notification')
  console.log('============================================')
  try {
    const committedDate = new Date()
    const dueDate = new Date(committedDate)
    dueDate.setDate(dueDate.getDate() + 14)

    await notifyMissedCommittedDate({
      engineerId: 'test-engineer-1',
      engineerEmail: 'test@example.com',
      engineerName: '測試工程師',
      equipmentNumber: 'HOK-E25',
      station: 'HK Station',
      committedDate,
      dueDate,
      workOrderNumber: '5000355448',
    })
    console.log('✅ Missed committed date notification sent successfully')
  } catch (error) {
    console.error('❌ Failed to send missed committed date notification:', error)
  }

  console.log('')
  console.log('✅ Testing completed!')
  console.log('')
  console.log('Note: Check your Novu dashboard to see if notifications were received.')
  console.log('Make sure the subscriber ID matches: test-engineer-1')
}

main().catch((error) => {
  console.error('❌ Test failed:', error)
  process.exit(1)
})

