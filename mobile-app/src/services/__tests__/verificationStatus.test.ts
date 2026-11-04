/**
 * @fileoverview The verification screen's view of the server's status
 * @author Oabona-Majoko
 * @created 2026-11-04
 * @lastModified 2026-11-04
 *
 * The server lists required documents by name and uses its own statuses;
 * the screen read requirement.documentType.replace(...) from each name,
 * which threw while drawing, so opening Verify Your Identity crashed.
 */

const mockGet = jest.fn();
jest.mock('../ApiClient', () => ({
  __esModule: true,
  ApiClient: jest.fn().mockImplementation(() => ({ get: (...args: unknown[]) => mockGet(...args) })),
  default: jest.fn(),
}));
jest.mock('../AuthService', () => ({
  __esModule: true,
  AuthService: jest.fn().mockImplementation(() => ({ getValidToken: jest.fn().mockResolvedValue('token') })),
}));

import DocumentVerificationService from '../DocumentVerificationService';

// What GET /api/verification/status/:id answers today.
const serverStatus = (overrides: Record<string, unknown> = {}) => ({
  success: true,
  data: {
    userId: 'u1',
    overallStatus: 'unverified',
    completionPercentage: 0,
    canStartDriving: false,
    requiredDocuments: ['drivers_license', 'vehicle_registration', 'insurance_card'],
    submittedDocuments: [],
    nextSteps: ['Upload your drivers license'],
    ...overrides,
  },
});

describe('Verification status for the screen', () => {
  beforeEach(() => mockGet.mockReset());

  it('turns document names into requirements the screen can draw', async () => {
    mockGet.mockResolvedValue(serverStatus());
    const status = await DocumentVerificationService.getUserVerificationStatus('u1');

    for (const requirement of status.requiredDocuments) {
      expect(typeof requirement.documentType).toBe('string');
      expect(() => requirement.documentType.replace(/_/g, ' ')).not.toThrow();
    }
    expect(status.requiredDocuments.map((r) => r.documentType)).toEqual(
      ['national_id', 'passport', 'drivers_license', 'vehicle_registration', 'insurance_card'],
    );
  });

  it('asks everyone for a national ID, or a passport instead', async () => {
    mockGet.mockResolvedValue(serverStatus({ requiredDocuments: [] }));
    const status = await DocumentVerificationService.getUserVerificationStatus('u1');

    expect(status.requiredDocuments[0]).toEqual(expect.objectContaining({ documentType: 'national_id', required: true }));
    expect(status.requiredDocuments[1]).toEqual(expect.objectContaining({ documentType: 'passport', required: false }));
    expect(status.nextSteps[0]).toBe('Upload your national ID or passport');
  });

  it("maps the server's statuses onto the screen's, and fills what it leaves out", async () => {
    mockGet.mockResolvedValue(serverStatus());
    const status = await DocumentVerificationService.getUserVerificationStatus('u1');

    expect(status).toEqual(expect.objectContaining({
      overallStatus: 'incomplete', verificationLevel: 'basic', canBookRides: true,
    }));
    expect(() => status.overallStatus.charAt(0)).not.toThrow();
  });

  it('stops asking for identity once an ID is approved', async () => {
    mockGet.mockResolvedValue(serverStatus({
      overallStatus: 'pending',
      submittedDocuments: [{ id: 'd1', documentType: 'passport', status: 'approved' }],
    }));
    const status = await DocumentVerificationService.getUserVerificationStatus('u1');

    expect(status.overallStatus).toBe('pending');
    expect(status.verificationLevel).toBe('standard');
    expect(status.nextSteps).not.toContain('Upload your national ID or passport');
  });

  it('copes with a response missing its lists', async () => {
    mockGet.mockResolvedValue({ success: true, data: { userId: 'u1' } });
    const status = await DocumentVerificationService.getUserVerificationStatus('u1');

    expect(status.submittedDocuments).toEqual([]);
    expect(status.requiredDocuments.length).toBe(2);
  });
});
