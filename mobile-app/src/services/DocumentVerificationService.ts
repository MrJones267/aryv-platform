/**
 * @fileoverview Document verification service with OCR and identity validation
 * @author Oabona-Majoko
 * @created 2025-09-07
 * @lastModified 2025-09-07
 */

import { ApiClient } from './ApiClient';
import { AuthService } from './AuthService';
import logger from './LoggingService';

const log = logger.createLogger('DocumentVerificationService');

export interface DocumentUploadRequest {
  userId: string;
  documentType: DocumentType;
  imageUri: string;
  metadata?: DocumentMetadata;
  /** ISO 8601. Required by the API for licences, insurance and passports. */
  documentExpiresAt?: string;
}

export interface DocumentMetadata {
  captureTimestamp: string;
  deviceInfo: string;
  location?: {
    latitude: number;
    longitude: number;
  };
  imageQuality: 'low' | 'medium' | 'high';
  fileSize: number;
  fileName: string;
}

export type DocumentType = 
  | 'drivers_license'
  | 'passport'
  | 'national_id'
  | 'vehicle_registration'
  | 'insurance_card'
  | 'background_check'
  | 'bank_statement'
  | 'utility_bill';

export type VerificationStatus = 
  | 'pending_upload'
  | 'uploaded'
  | 'processing'
  | 'under_review'
  | 'approved'
  | 'rejected'
  | 'expired'
  | 'requires_resubmission';

export interface DocumentRecord {
  id: string;
  userId: string;
  documentType: DocumentType;
  status: VerificationStatus;
  uploadedAt: string;
  processedAt?: string;
  approvedAt?: string;
  expiresAt?: string;
  imageUrl?: string;
  thumbnailUrl?: string;
  ocrResults?: OCRResults;
  validationResults?: ValidationResults;
  adminNotes?: string;
  rejectionReason?: string;
  confidenceScore: number; // 0-1
  requiresManualReview: boolean;
  attemptNumber: number;
  maxAttempts: number;
}

export interface OCRResults {
  extractedText: string;
  fields: ExtractedField[];
  confidence: number;
  processingTime: number;
  errors: string[];
}

export interface ExtractedField {
  fieldType: string;
  value: string;
  confidence: number;
  boundingBox?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export interface ValidationResults {
  isValid: boolean;
  score: number; // 0-1
  checks: ValidationCheck[];
  anomalies: string[];
  recommendations: string[];
}

export interface ValidationCheck {
  type: 'format' | 'security_features' | 'consistency' | 'expiration' | 'authenticity';
  name: string;
  passed: boolean;
  confidence: number;
  details?: string;
}

export interface VerificationRequirements {
  documentType: DocumentType;
  required: boolean;
  description: string;
  exampleImages: string[];
  guidelines: string[];
  maxFileSize: number; // in MB
  acceptedFormats: string[];
  validityPeriod?: number; // in days
}

export interface UserVerificationStatus {
  userId: string;
  overallStatus: 'incomplete' | 'pending' | 'verified' | 'suspended';
  completionPercentage: number;
  requiredDocuments: VerificationRequirements[];
  submittedDocuments: DocumentRecord[];
  nextSteps: string[];
  canStartDriving: boolean;
  canBookRides: boolean;
  verificationLevel: 'basic' | 'standard' | 'premium';
  lastUpdated: string;
}

export interface DocumentUploadResponse {
  success: boolean;
  documentId: string;
  status: VerificationStatus;
  message: string;
  processingTime?: number;
  nextSteps?: string[];
  requiresAdditionalInfo?: boolean;
  error?: string;
}

export interface VerificationProgressResponse {
  userId: string;
  documents: DocumentRecord[];
  overallProgress: number;
  estimatedCompletionTime: string;
  blockers: string[];
  recommendations: string[];
}

class DocumentVerificationService {
  private apiClient: ApiClient;
  private authService: AuthService;
  
  // Document validation rules
  private readonly DOCUMENT_REQUIREMENTS: Record<DocumentType, VerificationRequirements> = {
    drivers_license: {
      documentType: 'drivers_license',
      required: true,
      description: "Valid driver's license from your country/state",
      exampleImages: ['/examples/drivers_license_front.jpg', '/examples/drivers_license_back.jpg'],
      guidelines: [
        'Take photo in good lighting',
        'Ensure all text is clearly visible',
        'Include both front and back sides',
        'Make sure license is not expired',
        'Avoid glare and shadows'
      ],
      maxFileSize: 10,
      acceptedFormats: ['jpg', 'jpeg', 'png'],
      validityPeriod: 365,
    },
    passport: {
      documentType: 'passport',
      required: false,
      description: 'Valid passport for international verification',
      exampleImages: ['/examples/passport_photo_page.jpg'],
      guidelines: [
        'Photo page must be fully visible',
        'All text should be clear and readable',
        'Ensure passport is not expired',
        'Good lighting is essential'
      ],
      maxFileSize: 10,
      acceptedFormats: ['jpg', 'jpeg', 'png'],
      validityPeriod: 365,
    },
    national_id: {
      documentType: 'national_id',
      required: false,
      description: 'Government-issued national ID card',
      exampleImages: ['/examples/national_id_front.jpg', '/examples/national_id_back.jpg'],
      guidelines: [
        'Include both sides if applicable',
        'Ensure all details are visible',
        'Check expiration date',
        'Use good lighting'
      ],
      maxFileSize: 10,
      acceptedFormats: ['jpg', 'jpeg', 'png'],
      validityPeriod: 365,
    },
    vehicle_registration: {
      documentType: 'vehicle_registration',
      required: true,
      description: 'Current vehicle registration document',
      exampleImages: ['/examples/vehicle_registration.jpg'],
      guidelines: [
        'Must match the vehicle you plan to use',
        'Registration must be current',
        'All vehicle details must be visible',
        'Owner name must match your profile'
      ],
      maxFileSize: 10,
      acceptedFormats: ['jpg', 'jpeg', 'png', 'pdf'],
      validityPeriod: 365,
    },
    insurance_card: {
      documentType: 'insurance_card',
      required: true,
      description: 'Valid vehicle insurance proof',
      exampleImages: ['/examples/insurance_card.jpg'],
      guidelines: [
        'Must cover the vehicle for rideshare use',
        'Policy must be current and valid',
        'Coverage amounts must meet minimum requirements',
        'Policyholder must match driver name'
      ],
      maxFileSize: 10,
      acceptedFormats: ['jpg', 'jpeg', 'png', 'pdf'],
      validityPeriod: 180,
    },
    background_check: {
      documentType: 'background_check',
      required: true,
      description: 'Background check report from approved provider',
      exampleImages: ['/examples/background_check.pdf'],
      guidelines: [
        'Must be from an approved background check provider',
        'Report must be less than 90 days old',
        'Must show clear criminal history results',
        'All pages must be included'
      ],
      maxFileSize: 15,
      acceptedFormats: ['pdf', 'jpg', 'jpeg', 'png'],
      validityPeriod: 365,
    },
    bank_statement: {
      documentType: 'bank_statement',
      required: false,
      description: 'Bank statement for financial verification',
      exampleImages: ['/examples/bank_statement.pdf'],
      guidelines: [
        'Statement must be from the last 3 months',
        'Account holder name must match profile',
        'All personal information may be redacted except name and dates',
        'Must show active account status'
      ],
      maxFileSize: 10,
      acceptedFormats: ['pdf', 'jpg', 'jpeg', 'png'],
      validityPeriod: 90,
    },
    utility_bill: {
      documentType: 'utility_bill',
      required: false,
      description: 'Recent utility bill for address verification',
      exampleImages: ['/examples/utility_bill.jpg'],
      guidelines: [
        'Must be from the last 3 months',
        'Service address must match your profile address',
        'Account holder name should match your profile',
        'Bill must show current status'
      ],
      maxFileSize: 10,
      acceptedFormats: ['pdf', 'jpg', 'jpeg', 'png'],
      validityPeriod: 90,
    },
  };

  // OCR confidence thresholds
  private readonly OCR_THRESHOLDS = {
    HIGH_CONFIDENCE: 0.9,
    MEDIUM_CONFIDENCE: 0.7,
    LOW_CONFIDENCE: 0.5,
    MANUAL_REVIEW: 0.6,
  };

  constructor() {
    this.apiClient = new ApiClient();
    this.authService = new AuthService();
  }

  /**
   * Upload and process document for verification
   */
  async uploadDocument(request: DocumentUploadRequest): Promise<DocumentUploadResponse> {
    try {
      // Validate document before upload
      const validationError = this.validateDocumentUpload(request);
      if (validationError) {
        return {
          success: false,
          documentId: '',
          status: 'pending_upload',
          message: validationError,
          error: validationError,
        };
      }

      // Always the real endpoint. The simulated path this replaced invented
      // OCR text and decided pass/fail with Math.random(), which looked like
      // driver vetting without being any.
      return await this.callDocumentUploadAPI(request);
    } catch (error: unknown) {
      log.error('Document upload error', error);
      return {
        success: false,
        documentId: '',
        status: 'pending_upload',
        message: 'Upload failed. Please try again.',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Get user's verification status and progress
   */
  async getUserVerificationStatus(userId: string): Promise<UserVerificationStatus> {
    try {
      return await this.callVerificationStatusAPI(userId);
    } catch (error: unknown) {
      log.error('Error fetching verification status', error);
      throw new Error('Failed to fetch verification status');
    }
  }

  /**
   * Get document requirements for user type
   */
  getDocumentRequirements(userType: 'passenger' | 'driver'): VerificationRequirements[] {
    const baseRequirements = [
      this.DOCUMENT_REQUIREMENTS.drivers_license,
    ];

    if (userType === 'driver') {
      return [
        ...baseRequirements,
        this.DOCUMENT_REQUIREMENTS.vehicle_registration,
        this.DOCUMENT_REQUIREMENTS.insurance_card,
        this.DOCUMENT_REQUIREMENTS.background_check,
      ];
    }

    return baseRequirements;
  }

  /**
   * Get verification progress for user
   */
  async getVerificationProgress(userId: string): Promise<VerificationProgressResponse> {
    try {
      return await this.callVerificationProgressAPI(userId);
    } catch (error: unknown) {
      log.error('Error fetching verification progress', error);
      throw new Error('Failed to fetch verification progress');
    }
  }

  /**
   * Resubmit rejected document
   */
  async resubmitDocument(
    userId: string,
    documentType: DocumentType,
    imageUri: string,
    documentExpiresAt?: string,
  ): Promise<DocumentUploadResponse> {
    try {
      // The caller supplies the type. This previously read it from a helper
      // that returned a hardcoded record — every resubmission was filed as a
      // driver's licence for a fictional user regardless of the real document.
      const resubmitRequest: DocumentUploadRequest = {
        userId,
        documentType,
        imageUri,
        ...(documentExpiresAt ? { documentExpiresAt } : {}),
        metadata: {
          captureTimestamp: new Date().toISOString(),
          deviceInfo: 'resubmission',
          imageQuality: 'high',
          fileSize: 0,
          fileName: `resubmit_${documentType}_${Date.now()}`,
        },
      };

      return await this.uploadDocument(resubmitRequest);
    } catch (error: unknown) {
      log.error('Document resubmission error', error);
      throw new Error('Failed to resubmit document');
    }
  }

  /**
   * Check if user can perform specific actions
   */
  async canUserPerformAction(userId: string, action: 'drive' | 'book_ride' | 'receive_payments'): Promise<boolean> {
    try {
      const status = await this.getUserVerificationStatus(userId);
      
      switch (action) {
        case 'book_ride':
          return status.canBookRides;
        case 'drive':
          return status.canStartDriving;
        case 'receive_payments':
          return status.verificationLevel === 'premium' && status.overallStatus === 'verified';
        default:
          return false;
      }
    } catch (error) {
      log.error('Error checking user permissions', error);
      return false;
    }
  }

  // Private helper methods

  private validateDocumentUpload(request: DocumentUploadRequest): string | null {
    const requirements = this.DOCUMENT_REQUIREMENTS[request.documentType];
    if (!requirements) {
      return 'Invalid document type';
    }

    if (!request.imageUri) {
      return 'Image is required';
    }

    // Validate file size if metadata provided
    if (request.metadata?.fileSize && request.metadata.fileSize > requirements.maxFileSize * 1024 * 1024) {
      return `File size exceeds ${requirements.maxFileSize}MB limit`;
    }

    return null;
  }

  private async callDocumentUploadAPI(request: DocumentUploadRequest): Promise<DocumentUploadResponse> {
    const authToken = await this.authService.getValidToken();

    // Sent as multipart, not base64 in JSON. A 10 MB photo base64-encodes to
    // roughly 13.3 MB, which the API's 10 MB body limit rejects outright.
    const form = new FormData();
    form.append('document', {
      uri: request.imageUri,
      type: request.metadata?.fileName?.toLowerCase().endsWith('.png')
        ? 'image/png'
        : 'image/jpeg',
      name: request.metadata?.fileName || `${request.documentType}.jpg`,
    } as unknown as Blob);
    form.append('documentType', request.documentType);
    if (request.documentExpiresAt) {
      form.append('documentExpiresAt', request.documentExpiresAt);
    }

    const response = await this.apiClient.post('/verification/documents/upload', form, {
      headers: authToken ? { 'Authorization': `Bearer ${authToken}` } : {},
    });

    if (!response.success) {
      throw new Error(response.error || 'Document upload API failed');
    }

    return {
      success: true,
      documentId: response.data?.documentId,
      status: response.data?.status ?? 'uploaded',
      message: (response.data?.message as string) ?? 'Document submitted for review',
    };
  }

  private async callVerificationStatusAPI(userId: string): Promise<UserVerificationStatus> {
    const authToken = await this.authService.getValidToken();
    const response = await this.apiClient.get(`/verification/status/${userId}`, {
      headers: authToken ? { 'Authorization': `Bearer ${authToken}` } : {},
    });

    if (!response.success) {
      throw new Error(response.error || 'Verification status API failed');
    }

    return response.data;
  }

  private async callVerificationProgressAPI(userId: string): Promise<VerificationProgressResponse> {
    const authToken = await this.authService.getValidToken();
    const response = await this.apiClient.get(`/verification/progress/${userId}`, {
      headers: authToken ? { 'Authorization': `Bearer ${authToken}` } : {},
    });

    if (!response.success) {
      throw new Error(response.error || 'Verification progress API failed');
    }

    return response.data;
  }
}

export default new DocumentVerificationService();