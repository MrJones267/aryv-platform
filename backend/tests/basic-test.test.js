/**
 * @fileoverview Basic test to verify testing suite functionality
 * @author Oabona-Majoko
 * @created 2025-01-25
 */

describe('Basic Test Suite Verification', () => {
  test('testing environment should be properly configured', () => {
    expect(process.env.NODE_ENV).toBe('test');
  });

  test('Jest should be working correctly', () => {
    expect(2 + 2).toBe(4);
    expect(typeof global.testUtils).toBe('object');
  });

  test('async operations should work', async () => {
    const promise = new Promise(resolve => {
      setTimeout(() => resolve('success'), 10);
    });

    const result = await promise;
    expect(result).toBe('success');
  });

  test('test utilities should be available', () => {
    expect(global.testUtils).toBeDefined();
    expect(typeof global.testUtils.generateRandomEmail).toBe('function');
    expect(typeof global.testUtils.generateRandomPhone).toBe('function');
    expect(typeof global.testUtils.wait).toBe('function');
  });

  test('random email generation should work', () => {
    const email1 = global.testUtils.generateRandomEmail();
    const email2 = global.testUtils.generateRandomEmail();
    
    expect(email1).toMatch(/@hitch\.com$/);
    expect(email2).toMatch(/@hitch\.com$/);
    expect(email1).not.toBe(email2);
  });

  test('random phone generation should work', () => {
    const phone1 = global.testUtils.generateRandomPhone();
    const phone2 = global.testUtils.generateRandomPhone();
    
    expect(phone1).toMatch(/^\+1234567\d{3}$/);
    expect(phone2).toMatch(/^\+1234567\d{3}$/);
    expect(phone1).not.toBe(phone2);
  });

  test('wait utility should work', async () => {
    const start = Date.now();
    await global.testUtils.wait(50);
    const elapsed = Date.now() - start;
    
    expect(elapsed).toBeGreaterThanOrEqual(45);
    expect(elapsed).toBeLessThan(100);
  });
});