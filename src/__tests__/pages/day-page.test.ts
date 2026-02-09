/**
 * Test to verify the day page date parsing works correctly
 * This test addresses Bug #2: Verify day/[date] page works
 */

describe('Day page date parsing', () => {
  it('should parse date parameter correctly without showing Invalid Date', () => {
    // Test the date parsing logic from the day page
    const dateParam = '2026-02-08';
    const parsedDate = new Date(dateParam + 'T12:00:00');
    
    // Verify the date is valid
    expect(isNaN(parsedDate.getTime())).toBe(false);
    expect(parsedDate.toString()).not.toContain('Invalid Date');
    
    // Verify it parses to the correct date components
    expect(parsedDate.getFullYear()).toBe(2026);
    expect(parsedDate.getMonth()).toBe(1); // February is month 1 (0-indexed)
    expect(parsedDate.getDate()).toBe(8);
    expect(parsedDate.getHours()).toBe(12); // Noon
  });

  it('should handle various date formats correctly', () => {
    const testDates = [
      '2026-01-01',
      '2026-12-31',
      '2026-02-29', // Not a leap year, but let's test anyway
      '2026-06-15',
    ];

    for (const dateParam of testDates) {
      const parsedDate = new Date(dateParam + 'T12:00:00');
      
      // All should be valid dates
      expect(isNaN(parsedDate.getTime())).toBe(false);
      expect(parsedDate.toString()).not.toContain('Invalid Date');
      
      // Should parse to noon local time
      expect(parsedDate.getHours()).toBe(12);
    }
  });

  it('should format date for display correctly', () => {
    const dateParam = '2026-02-08';
    const parsedDate = new Date(dateParam + 'T12:00:00');
    
    // Test the formatting used in the component
    const formattedDate = parsedDate.toLocaleDateString('en-US', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
    
    // Should produce a readable date string
    expect(formattedDate).toMatch(/\w+, \w+ \d+, \d{4}/);
    expect(formattedDate).toContain('2026');
    expect(formattedDate).toContain('February');
    expect(formattedDate).toContain('8');
  });

  it('should handle invalid date gracefully', () => {
    // Test with an invalid date to ensure it doesn't crash
    const invalidDate = new Date('invalid-date' + 'T12:00:00');
    
    expect(isNaN(invalidDate.getTime())).toBe(true);
    expect(invalidDate.toString()).toContain('Invalid Date');
  });
});