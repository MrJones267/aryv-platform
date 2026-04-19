/**
 * Lightweight setup for pure unit tests — no database connection required.
 */
process.env['NODE_ENV'] = 'test';
process.env['JWT_SECRET'] = 'test-jwt-secret-for-unit-tests-only';
process.env['QR_CODE_SECRET'] = 'test-qr-secret';

jest.setTimeout(10000);
