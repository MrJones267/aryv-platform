/**
 * @fileoverview Document verification service with OCR and identity validation
 * @author Oabona-Majoko
 * @created 2025-09-07
 * @lastModified 2025-09-07
 */

import { ApiClient } from './ApiClient';
import { AuthService } from './AuthService';

export interface DocumentUploadRequest {
  userId: string;
  documentType: DocumentType;
  imageUri: string;
  imageData?: string; // base64 encoded
  metadata?: DocumentMetadata;
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

      if (!__DEV__) {
        return await this.callDocumentUploadAPI(request);
      }

      // Development: Simulate document processing
      return await this.simulateDocumentProcessing(request);
    } catch (error: any) {
      console.error('Document upload error:', error);
      return {
        success: false,
        documentId: '',
        status: 'pending_upload',
        message: 'Upload failed. Please try again.',
        error: error.message,
      };
    }
  }

  /**
   * Get user's verification status and progress
   */
  async getUserVerificationStatus(userId: string): Promise<UserVerificationStatus> {
    try {
      if (!__DEV__) {
        return await this.callVerificationStatusAPI(userId);
      }

      // Development: Generate mock verification status
      return this.generateMockVerificationStatus(userId);
    } catch (error: any) {
      console.error('Error fetching verification status:', error);
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
      if (!__DEV__) {
        return await this.callVerificationProgressAPI(userId);
      }

      // Development: Generate mock progress
      return this.generateMockVerificationProgress(userId);
    } catch (error: any) {
      console.error('Error fetching verification progress:', error);
      throw new Error('Failed to fetch verification progress');
    }
  }

  /**
   * Resubmit rejected document
   */
  async resubmitDocument(documentId: string, imageUri: string, notes?: string): Promise<DocumentUploadResponse> {
    try {
      // Get original document record
      const originalDoc = await this.getDocumentRecord(documentId);
      if (!originalDoc) {
        throw new Error('Original document not found');
      }

      // Create resubmission request
      const resubmitRequest: DocumentUploadRequest = {
        userId: originalDoc.userId,
        documentType: originalDoc.documentType,
        imageUri,
        metadata: {
          captureTimestamp: new Date().toISOString(),
          deviceInfo: 'resubmission',
          imageQuality: 'high',
          fileSize: 0,
          fileName: `resubmit_${originalDoc.documentType}_${Date.now()}`,
        },
      };

      return await this.uploadDocument(resubmitRequest);
    } catch (error: any) {
      console.error('Document resubmission error:', error);
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
      console.error('Error checking user permissions:', error);
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

  private async simulateDocumentProcessing(request: DocumentUploadRequest): Promise<DocumentUploadResponse> {
    // Simulate processing delay
    await new Promise(resolve => setTimeout(resolve, 2000));

    const documentId = `doc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Simulate OCR processing
    const ocrResults = this.simulateOCR(request.documentType);
    const validationResults = this.simulateValidation(request.documentType, ocrResults);
    
    // Determine status based on validation
    let status: VerificationStatus = 'processing';
    let message = 'Document uploaded successfully and is being processed';
    
    if (validationResults.score > 0.8) {
      status = ocrResults.confidence > this.OCR_THRESHOLDS.HIGH_CONFIDENCE ? 'approved' : 'under_review';
      message = status === 'approved' ? 'Document automatically approved' : 'Document under manual review';
    } else if (validationResults.score > 0.5) {
      status = 'under_review';
      message = 'Document requires manual review';
    } else {
      status = 'rejected';
      message = 'Document validation failed. Please resubmit.';
    }

    return {
      success: true,
      documentId,
      status,
      message,
      processingTime: 2000,
      nextSteps: this.getNextSteps(status, request.documentType),
    };
  }

  private simulateOCR(documentType: DocumentType): OCRResults {
    const mockText = this.getMockOCRText(documentType);
    const confidence = 0.7 + Math.random() * 0.3; // 70-100%
    
    return {
      extractedText: mockText,
      fields: this.extractFieldsFromText(documentType, mockText),
      confidence,
      processingTime: 1200,
      errors: [],
    };
  }

  private simulateValidation(documentType: DocumentType, ocrResults: OCRResults): ValidationResults {
    const checks: ValidationCheck[] = [
      {
        type: 'format',
        name: 'Document Format',
        passed: Math.random() > 0.1,
        confidence: 0.9,
        details: 'Document format appears valid',
      },
      {
        type: 'security_features',
        name: 'Security Features',
        passed: Math.random() > 0.2,
        confidence: 0.8,
        details: 'Security features detected',
      },
      {
        type: 'consistency',
        name: 'Data Consistency',
        passed: Math.random() > 0.15,
        confidence: 0.85,
      },
      {
        type: 'expiration',
        name: 'Expiration Check',
        passed: Math.random() > 0.1,
        confidence: 0.95,
      },
    ];

    const passedChecks = checks.filter(check => check.passed).length;
    const score = passedChecks / checks.length;
    
    return {
      isValid: score > 0.7,
      score,
      checks,
      anomalies: score < 0.8 ? ['Minor inconsistencies detected'] : [],
      recommendations: score < 0.6 ? ['Consider retaking photo with better lighting'] : [],
    };
  }

  private getMockOCRText(documentType: DocumentType): string {
    const mockTexts = {
      drivers_license: "DRIVER LICENSE\nJOHN DOE\n123 MAIN ST\nANYTOWN ST 12345\nDOB: 01/01/1990\nEXP: 01/01/2025\nCLASS: C\nLIC: D1234567890",
      passport: "PASSPORT\nUNITED STATES OF AMERICA\nGIVEN NAMES: JOHN\nSURNAME: DOE\nPASSPORT NO: 123456789\nDATE OF BIRTH: 01/01/1990\nDATE OF ISSUE: 01/01/2020\nDATE OF EXPIRY: 01/01/2030",
      national_id: "NATIONAL ID\nJOHN DOE\nID NO: 123456789\nDOB: 01/01/1990\nISSUED: 01/01/2020\nEXPIRES: 01/01/2030",
      vehicle_registration: "VEHICLE REGISTRATION\nOWNER: JOHN DOE\nVIN: 1234567890ABCDEF\nMAKE: TOYOTA\nMODEL: CAMRY\nYEAR: 2020\nREG EXP: 12/31/2024",
      insurance_card: "AUTO INSURANCE\nPOLICY HOLDER: JOHN DOE\nPOLICY NO: INS123456789\nEFFECTIVE: 01/01/2024\nEXPIRES: 01/01/2025\nVEHICLE: 2020 TOYOTA CAMRY",
      background_check: "BACKGROUND CHECK REPORT\nSUBJECT: JOHN DOE\nREPORT DATE: 01/01/2024\nCRIMINAL HISTORY: CLEAR\nDRIVING RECORD: CLEAR\nSTATUS: APPROVED",
      bank_statement: "BANK STATEMENT\nACCOUNT HOLDER: JOHN DOE\nSTATEMENT DATE: 01/01/2024\nACCOUNT STATUS: ACTIVE",
      utility_bill: "UTILITY BILL\nSERVICE ADDRESS: 123 MAIN ST\nACCOUNT HOLDER: JOHN DOE\nBILL DATE: 01/01/2024\nAMOUNT DUE: $125.00",
    };

    return mockTexts[documentType] || "DOCUMENT TEXT NOT AVAILABLE";
  }

  private extractFieldsFromText(documentType: DocumentType, text: string): ExtractedField[] {
    const fields: ExtractedField[] = [];
    
    // Simple field extraction simulation
    const lines = text.split('\n');
    lines.forEach((line, index) => {
      if (line.includes(':')) {
        const [key, value] = line.split(':');
        fields.push({
          fieldType: key.trim().toLowerCase().replace(' ', '_'),
          value: value?.trim() || '',
          confidence: 0.8 + Math.random() * 0.2,
          boundingBox: {
            x: 10,
            y: index * 20,
            width: 200,
            height: 18,
          },
        });
      }
    });

    return fields;
  }

  private getNextSteps(status: VerificationStatus, documentType: DocumentType): string[] {
    switch (status) {
      case 'approved':
        return ['Document approved! You can now proceed with verification.'];
      case 'under_review':
        return [
          'Your document is under manual review',
          'You will be notified within 2-3 business days',
          'Please ensure your contact information is up to date',
        ];
      case 'rejected':
        return [
          'Please retake the photo following our guidelines',
          'Ensure good lighting and all text is visible',
          'Upload a high-quality image of your document',
        ];
      case 'processing':
        return [
          'Your document is being processed',
          'This usually takes 2-5 minutes',
          'You will be notified when processing is complete',
        ];
      default:
        return [];
    }
  }

  private async getDocumentRecord(documentId: string): Promise<DocumentRecord | null> {
    // Mock implementation - in production would fetch from API
    return {
      id: documentId,
      userId: 'user-1',
      documentType: 'drivers_license',
      status: 'rejected',
      uploadedAt: new Date().toISOString(),
      confidenceScore: 0.5,
      requiresManualReview: true,
      attemptNumber: 1,
      maxAttempts: 3,
    };
  }

  private generateMockVerificationStatus(userId: string): UserVerificationStatus {
    const requiredDocs = this.getDocumentRequirements('driver');
    const submittedDocs: DocumentRecord[] = requiredDocs.slice(0, 2).map((req, index) => ({
      id: `doc_${index + 1}`,
      userId,
      documentType: req.documentType,
      status: index === 0 ? 'approved' : 'under_review',
      uploadedAt: new Date(Date.now() - (index + 1) * 24 * 60 * 60 * 1000).toISOString(),
      confidenceScore: 0.8 + Math.random() * 0.2,
      requiresManualReview: index > 0,
      attemptNumber: 1,
      maxAttempts: 3,
    }));

    const completionPercentage = (submittedDocs.length / requiredDocs.length) * 100;
    
    return {
      userId,
      overallStatus: completionPercentage < 100 ? 'pending' : 'verified',
      completionPercentage,
      requiredDocuments: requiredDocs,
      submittedDocuments: submittedDocs,
      nextSteps: completionPercentage < 100 ? ['Upload remaining required documents'] : [],
      canStartDriving: completionPercentage >= 100,
      canBookRides: completionPercentage >= 25,
      verificationLevel: completionPercentage >= 100 ? 'standard' : 'basic',
      lastUpdated: new Date().toISOString(),
    };
  }

  private generateMockVerificationProgress(userId: string): VerificationProgressResponse {
    const documents = this.generateMockVerificationStatus(userId).submittedDocuments;
    
    return {
      userId,
      documents,
      overallProgress: (documents.length / 4) * 100, // Assuming 4 required docs for drivers
      estimatedCompletionTime: '2-3 business days',
      blockers: documents.some(doc => doc.status === 'rejected') ? ['Rejected document needs resubmission'] : [],
      recommendations: [
        'Ensure all photos are taken in good lighting',
        'Double-check that all text is clearly visible',
        'Upload documents as soon as possible for faster review',
      ],
    };
  }

  private async callDocumentUploadAPI(request: DocumentUploadRequest): Promise<DocumentUploadResponse> {
    const authToken = await this.authService.getValidToken();
    const response = await this.apiClient.post('/verification/documents/upload', request, {
      headers: authToken ? { 'Authorization': `Bearer ${authToken}` } : {},
    });

    if (!response.success) {
      throw new Error(response.error || 'Document upload API failed');
    }

    return response.data;
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