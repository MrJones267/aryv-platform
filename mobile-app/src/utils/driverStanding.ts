/**
 * @fileoverview Where someone stands as a driver
 * @author Oabona-Majoko
 * @created 2026-11-10
 * @lastModified 2026-11-10
 *
 * Offering rides depends on approved documents, not on the role chosen at
 * sign-up. The app went by the role alone, so an approved driver who had
 * signed up as a passenger was sent back to driver onboarding every time.
 */

export type DriverStanding = 'approved' | 'under_review' | 'suspended' | 'none';

interface DriverLike {
  driverVerificationStatus?: string | null;
  roles?: string[];
  primaryRole?: string;
}

export const driverStanding = (user: DriverLike | null | undefined): DriverStanding => {
  switch (user?.driverVerificationStatus) {
    case 'verified':
      return 'approved';
    case 'pending':
      return 'under_review';
    case 'suspended':
      return 'suspended';
    default:
      // Older servers sent no status; a driver role was all there was.
      if (!user?.driverVerificationStatus && (user?.roles?.includes('driver') || user?.primaryRole === 'driver')) {
        return 'approved';
      }
      return 'none';
  }
};

export default driverStanding;
