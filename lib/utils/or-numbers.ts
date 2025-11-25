/**
 * Utility functions for generating dummy OR (Work Order) numbers
 * Format: 10-digit numbers starting with 5 (e.g., 5000355448)
 * Based on November schedule examples
 */

/**
 * Generate a dummy OR number
 * Format: 5000XXXXXX (10 digits, starts with 5)
 */
export function generateDummyORNumber(): string {
  // Generate random 6-digit number
  const random = Math.floor(100000 + Math.random() * 900000)
  return `5000${random}`
}

/**
 * Generate multiple dummy OR numbers
 */
export function generateDummyORNumbers(count: number): string[] {
  const numbers: string[] = []
  const used = new Set<string>()
  
  while (numbers.length < count) {
    const orNumber = generateDummyORNumber()
    if (!used.has(orNumber)) {
      used.add(orNumber)
      numbers.push(orNumber)
    }
  }
  
  return numbers
}

/**
 * Validate OR number format
 */
export function isValidORNumber(orNumber: string): boolean {
  // Must be 10 digits starting with 5
  return /^5\d{9}$/.test(orNumber)
}

