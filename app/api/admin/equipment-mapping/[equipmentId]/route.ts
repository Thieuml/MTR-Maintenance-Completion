import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

/**
 * DELETE /api/admin/equipment-mapping/[equipmentId]
 * Delete equipment mapping
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { equipmentId: string } }
) {
  try {
    await prisma.equipmentZoneMapping.delete({
      where: { equipmentId: params.equipmentId },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[Equipment Mapping DELETE] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}

