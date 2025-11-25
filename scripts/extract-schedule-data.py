#!/usr/bin/env python3
"""
Script to help extract and format schedule data from images
This generates TypeScript-compatible schedule data entries
"""

# This script helps format schedule data entries
# Run this to generate properly formatted entries for the seed file

def format_schedule_entry(zone_code, week, batch, date, time_slot, equipment, or_number, deadline):
    """Format a schedule entry as TypeScript object"""
    return f"    {{ zoneCode: '{zone_code}', week: {week}, batch: '{batch}', date: '{date}', timeSlot: '{time_slot}', equipmentNumber: '{equipment}', orNumber: '{or_number}', deadline: '{deadline}' }},"

# Example usage:
# print(format_schedule_entry('MTR-01', 45, 'A', '2024-11-02', 'SLOT_2300', 'HOK-E25', '5000355448', '16-Nov'))

# To use this script:
# 1. Extract data from images manually or via OCR
# 2. Call format_schedule_entry() for each entry
# 3. Copy the output into seed.ts

if __name__ == '__main__':
    print("Schedule Data Formatter")
    print("=" * 50)
    print("\nUse this script to format schedule entries.")
    print("Example:")
    print(format_schedule_entry('MTR-01', 45, 'A', '2024-11-02', 'SLOT_2300', 'HOK-E25', '5000355448', '16-Nov'))

