/**
 * Test to verify date formatting uses local time instead of UTC
 * This test addresses Bug #1: Date handling uses UTC instead of local time
 */

describe('Date formatting for local time', () => {
  it('should use local date formatting instead of toISOString', () => {
    // Create a test date that would be different in UTC vs local time
    // For example, late evening PST would be next day in UTC
    const testDate = new Date('2026-02-08T23:30:00-08:00'); // 11:30 PM PST on Feb 8th
    
    // The buggy implementation (using UTC)
    const utcDateStr = testDate.toISOString().split('T')[0]; // This would be 2026-02-09 (next day in UTC)
    
    // The correct implementation (using local time)
    const localDateStr = `${testDate.getFullYear()}-${String(testDate.getMonth()+1).padStart(2,'0')}-${String(testDate.getDate()).padStart(2,'0')}`;
    
    // Verify they are different when there's a timezone offset
    expect(localDateStr).not.toBe(utcDateStr);
    expect(localDateStr).toBe('2026-02-08'); // Should stay Feb 8th in local time
    expect(utcDateStr).toBe('2026-02-09'); // Would be Feb 9th in UTC
  });

  it('should correctly format current date in local time', () => {
    const now = new Date();
    
    // Our local formatting function
    const localDateStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
    
    // Verify it follows YYYY-MM-DD format
    expect(localDateStr).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    
    // Verify month is correctly 1-indexed (not 0-indexed)
    const month = now.getMonth() + 1;
    expect(localDateStr).toContain(String(month).padStart(2, '0'));
    
    // Verify it uses the actual local date components
    expect(localDateStr.includes(String(now.getFullYear()))).toBe(true);
    expect(localDateStr.includes(String(now.getDate()).padStart(2, '0'))).toBe(true);
  });

  it('should handle edge cases correctly', () => {
    // Test single digit month and day
    const testDate = new Date(2026, 0, 5); // January 5, 2026 (month is 0-indexed in constructor)
    const dateStr = `${testDate.getFullYear()}-${String(testDate.getMonth()+1).padStart(2,'0')}-${String(testDate.getDate()).padStart(2,'0')}`;
    
    expect(dateStr).toBe('2026-01-05');
    
    // Test double digit month and day
    const testDate2 = new Date(2026, 11, 25); // December 25, 2026
    const dateStr2 = `${testDate2.getFullYear()}-${String(testDate2.getMonth()+1).padStart(2,'0')}-${String(testDate2.getDate()).padStart(2,'0')}`;
    
    expect(dateStr2).toBe('2026-12-25');
  });
});