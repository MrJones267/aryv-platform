/**
 * @fileoverview Admin dashboard for document verification review and approval
 * @author Oabona-Majoko
 * @created 2025-09-07
 * @lastModified 2025-09-07
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  RefreshControl,
  Modal,
  Image,
  TextInput,
  Dimensions,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import {
  DocumentRecord,
  VerificationStatus,
  DocumentType,
  OCRResults,
  ValidationResults,
} from '../../services/DocumentVerificationService';
import logger from '../../services/LoggingService';

const log = logger.createLogger('AdminVerificationDashboard');

const { width } = Dimensions.get('window');

interface AdminVerificationDashboardProps {
  onApprove: (documentId: string, notes?: string) => Promise<void>;
  onReject: (documentId: string, reason: string, notes?: string) => Promise<void>;
  onRequestMoreInfo: (documentId: string, requirements: string[]) => Promise<void>;
  style?: object;
}

interface PendingDocumentsResponse {
  documents: DocumentRecord[];
  totalCount: number;
  priorityCount: number;
  averageReviewTime: number;
}

interface AdminStats {
  totalPending: number;
  totalReviewed: number;
  approvalRate: number;
  averageReviewTime: number;
  documentsToday: number;
  highPriorityCount: number;
}

export const AdminVerificationDashboard: React.FC<AdminVerificationDashboardProps> = ({
  onApprove,
  onReject,
  onRequestMoreInfo,
  style,
}) => {
  const [pendingDocuments, setPendingDocuments] = useState<DocumentRecord[]>([]);
  const [adminStats, setAdminStats] = useState<AdminStats | null>(null);
  const [selectedDocument, setSelectedDocument] = useState<DocumentRecord | null>(null);
  const [showImageModal, setShowImageModal] = useState(false);
  const [reviewNotes, setReviewNotes] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'under_review' | 'requires_attention'>('all');
  const [sortBy, setSortBy] = useState<'date' | 'priority' | 'confidence'>('date');
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const predefinedRejectionReasons = [
    'Document image is too blurry or unclear',
    'Document appears to be expired',
    'Required information is not visible',
    'Document does not match user profile information',
    'Image quality is insufficient for verification',
    'Document appears to be altered or fraudulent',
    'Wrong document type submitted',
    'Document is partially obscured or cropped',
  ];

  useEffect(() => {
    loadPendingDocuments();
    loadAdminStats();
  }, [filterStatus, sortBy]);

  const loadPendingDocuments = async () => {
    try {
      setIsLoading(true);
      // In production, this would call the actual API
      const mockDocuments = generateMockPendingDocuments();
      setPendingDocuments(mockDocuments);
    } catch (error) {
      log.error('Error loading pending documents:', error);
      Alert.alert('Error', 'Failed to load pending documents');
    } finally {
      setIsLoading(false);
    }
  };

  const loadAdminStats = async () => {
    try {
      const mockStats: AdminStats = {
        totalPending: 23,
        totalReviewed: 156,
        approvalRate: 87.5,
        averageReviewTime: 3.2,
        documentsToday: 12,
        highPriorityCount: 5,
      };
      setAdminStats(mockStats);
    } catch (error) {
      log.error('Error loading admin stats:', error);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([loadPendingDocuments(), loadAdminStats()]);
    setRefreshing(false);
  };

  const handleDocumentSelect = (document: DocumentRecord) => {
    setSelectedDocument(document);
    setReviewNotes('');
    setRejectionReason('');
  };

  const handleApproveDocument = async () => {
    if (!selectedDocument) return;

    try {
      await onApprove(selectedDocument.id, reviewNotes.trim() || undefined);
      
      // Update local state
      setPendingDocuments(prev => prev.filter(doc => doc.id !== selectedDocument.id));
      setSelectedDocument(null);
      setReviewNotes('');
      
      Alert.alert('Document Approved', 'The document has been approved successfully.');
    } catch (error: unknown) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to approve document');
    }
  };

  const handleRejectDocument = async () => {
    if (!selectedDocument || !rejectionReason.trim()) {
      Alert.alert('Error', 'Please provide a reason for rejection');
      return;
    }

    try {
      await onReject(selectedDocument.id, rejectionReason.trim(), reviewNotes.trim() || undefined);
      
      // Update local state
      setPendingDocuments(prev => prev.filter(doc => doc.id !== selectedDocument.id));
      setSelectedDocument(null);
      setReviewNotes('');
      setRejectionReason('');
      
      Alert.alert('Document Rejected', 'The document has been rejected and the user will be notified.');
    } catch (error: unknown) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to reject document');
    }
  };

  const handleRequestMoreInfo = async () => {
    if (!selectedDocument) return;

    const requirements = [
      'Please retake the photo with better lighting',
      'Ensure all corners of the document are visible',
      'Make sure the text is clearly readable',
    ];

    try {
      await onRequestMoreInfo(selectedDocument.id, requirements);
      
      // Update local state
      setPendingDocuments(prev => prev.filter(doc => doc.id !== selectedDocument.id));
      setSelectedDocument(null);
      
      Alert.alert('More Information Requested', 'The user has been notified to provide additional information.');
    } catch (error: unknown) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to request more information');
    }
  };

  const generateMockPendingDocuments = (): DocumentRecord[] => {
    const documentTypes: DocumentType[] = ['drivers_license', 'vehicle_registration', 'insurance_card', 'passport'];
    const statuses: VerificationStatus[] = ['under_review', 'processing'];
    
    return Array.from({ length: 15 }, (_, index) => ({
      id: `doc_${index + 1}`,
      userId: `user_${index + 1}`,
      documentType: documentTypes[index % documentTypes.length],
      status: statuses[index % statuses.length],
      uploadedAt: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString(),
      processedAt: new Date(Date.now() - Math.random() * 24 * 60 * 60 * 1000).toISOString(),
      imageUrl: `https://example.com/document_${index + 1}.jpg`,
      thumbnailUrl: `https://example.com/thumb_${index + 1}.jpg`,
      ocrResults: {
        extractedText: `Mock extracted text for document ${index + 1}`,
        fields: [
          {
            fieldType: 'name',
            value: `John Doe ${index + 1}`,
            confidence: 0.8 + Math.random() * 0.2,
          },
          {
            fieldType: 'document_number',
            value: `DOC${String(index + 1).padStart(6, '0')}`,
            confidence: 0.7 + Math.random() * 0.3,
          },
        ],
        confidence: 0.7 + Math.random() * 0.3,
        processingTime: 1000 + Math.random() * 2000,
        errors: [],
      },
      validationResults: {
        isValid: Math.random() > 0.2,
        score: 0.6 + Math.random() * 0.4,
        checks: [
          {
            type: 'format',
            name: 'Document Format',
            passed: Math.random() > 0.1,
            confidence: 0.9,
          },
          {
            type: 'security_features',
            name: 'Security Features',
            passed: Math.random() > 0.2,
            confidence: 0.8,
          },
        ],
        anomalies: Math.random() > 0.7 ? ['Minor inconsistency detected'] : [],
        recommendations: Math.random() > 0.8 ? ['Consider manual review'] : [],
      },
      confidenceScore: 0.6 + Math.random() * 0.4,
      requiresManualReview: Math.random() > 0.6,
      attemptNumber: Math.floor(Math.random() * 3) + 1,
      maxAttempts: 3,
    }));
  };

  const getDocumentTypeIcon = (documentType: DocumentType): string => {
    const iconMap: Record<DocumentType, string> = {
      drivers_license: 'credit-card',
      passport: 'flight-takeoff',
      national_id: 'badge',
      vehicle_registration: 'directions-car',
      insurance_card: 'security',
      background_check: 'assignment',
      bank_statement: 'account-balance',
      utility_bill: 'receipt',
    };
    return iconMap[documentType] || 'description';
  };

  const getPriorityColor = (document: DocumentRecord): string => {
    if (document.confidenceScore < 0.6) return '#F44336'; // High priority - low confidence
    if (document.attemptNumber > 1) return '#FF9800'; // Medium priority - resubmission
    if (document.requiresManualReview) return '#FF9800'; // Medium priority - manual review
    return '#4CAF50'; // Low priority - normal processing
  };

  const getPriorityLabel = (document: DocumentRecord): string => {
    if (document.confidenceScore < 0.6) return 'High';
    if (document.attemptNumber > 1 || document.requiresManualReview) return 'Medium';
    return 'Normal';
  };

  const renderAdminStats = () => {
    if (!adminStats) return null;

    return (
      <View style={styles.statsContainer}>
        <Text style={styles.statsTitle}>Today's Overview</Text>
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{adminStats.totalPending}</Text>
            <Text style={styles.statLabel}>Pending</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{adminStats.documentsToday}</Text>
            <Text style={styles.statLabel}>Reviewed Today</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={[styles.statValue, { color: '#F44336' }]}>
              {adminStats.highPriorityCount}
            </Text>
            <Text style={styles.statLabel}>High Priority</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={[styles.statValue, { color: '#4CAF50' }]}>
              {adminStats.approvalRate}%
            </Text>
            <Text style={styles.statLabel}>Approval Rate</Text>
          </View>
        </View>
      </View>
    );
  };

  const renderFilters = () => (
    <View style={styles.filtersContainer}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={styles.filterButtons}>
          {[
            { key: 'all', label: 'All Documents' },
            { key: 'under_review', label: 'Under Review' },
            { key: 'requires_attention', label: 'Needs Attention' },
          ].map((filter) => (
            <TouchableOpacity
              key={filter.key}
              style={[
                styles.filterButton,
                filterStatus === filter.key && styles.filterButtonActive,
              ]}
              onPress={() => setFilterStatus(filter.key as typeof filterStatus)}
            >
              <Text
                style={[
                  styles.filterButtonText,
                  filterStatus === filter.key && styles.filterButtonTextActive,
                ]}
              >
                {filter.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
      
      <View style={styles.sortContainer}>
        <Text style={styles.sortLabel}>Sort by:</Text>
        <TouchableOpacity
          style={styles.sortButton}
          onPress={() => {
            const options = ['date', 'priority', 'confidence'];
            const currentIndex = options.indexOf(sortBy);
            const nextIndex = (currentIndex + 1) % options.length;
            setSortBy(options[nextIndex] as typeof sortBy);
          }}
        >
          <Text style={styles.sortButtonText}>
            {sortBy === 'date' ? 'Date' : sortBy === 'priority' ? 'Priority' : 'Confidence'}
          </Text>
          <Icon name="keyboard-arrow-down" size={20} color="#666666" />
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderDocumentList = () => (
    <View style={styles.documentsContainer}>
      <Text style={styles.documentsTitle}>
        Documents for Review ({pendingDocuments.length})
      </Text>
      
      {pendingDocuments.map((document) => (
        <TouchableOpacity
          key={document.id}
          style={styles.documentCard}
          onPress={() => handleDocumentSelect(document)}
        >
          <View style={styles.documentHeader}>
            <View style={styles.documentInfo}>
              <Icon 
                name={getDocumentTypeIcon(document.documentType)} 
                size={24} 
                color="#2196F3" 
              />
              <View style={styles.documentText}>
                <Text style={styles.documentTitle}>
                  {document.documentType.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                </Text>
                <Text style={styles.documentUser}>User ID: {document.userId}</Text>
                <Text style={styles.documentDate}>
                  Uploaded: {new Date(document.uploadedAt).toLocaleDateString()}
                </Text>
              </View>
            </View>
            
            <View style={styles.documentMeta}>
              <View style={[styles.priorityBadge, { backgroundColor: getPriorityColor(document) }]}>
                <Text style={styles.priorityText}>{getPriorityLabel(document)}</Text>
              </View>
              <Text style={styles.confidenceScore}>
                {Math.round(document.confidenceScore * 100)}% confidence
              </Text>
            </View>
          </View>
          
          {document.ocrResults && (
            <View style={styles.ocrPreview}>
              <Text style={styles.ocrLabel}>Extracted Info:</Text>
              {document.ocrResults.fields.slice(0, 2).map((field, index) => (
                <Text key={index} style={styles.ocrField}>
                  {field.fieldType}: {field.value}
                </Text>
              ))}
            </View>
          )}
        </TouchableOpacity>
      ))}
    </View>
  );

  const renderReviewModal = () => {
    if (!selectedDocument) return null;

    return (
      <Modal
        visible={!!selectedDocument}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setSelectedDocument(null)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Review Document</Text>
            <TouchableOpacity onPress={() => setSelectedDocument(null)}>
              <Icon name="close" size={24} color="#333333" />
            </TouchableOpacity>
          </View>
          
          <ScrollView style={styles.modalContent}>
            {/* Document Image */}
            <TouchableOpacity
              style={styles.documentImageContainer}
              onPress={() => setShowImageModal(true)}
            >
              <Image
                source={{ uri: selectedDocument.imageUrl || 'https://via.placeholder.com/300x200' }}
                style={styles.documentImage}
                resizeMode="cover"
              />
              <View style={styles.imageOverlay}>
                <Icon name="zoom-in" size={24} color="#FFFFFF" />
                <Text style={styles.imageOverlayText}>Tap to enlarge</Text>
              </View>
            </TouchableOpacity>
            
            {/* Document Info */}
            <View style={styles.documentDetailsCard}>
              <Text style={styles.detailsTitle}>Document Information</Text>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Type:</Text>
                <Text style={styles.detailValue}>
                  {selectedDocument.documentType.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                </Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>User ID:</Text>
                <Text style={styles.detailValue}>{selectedDocument.userId}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Uploaded:</Text>
                <Text style={styles.detailValue}>
                  {new Date(selectedDocument.uploadedAt).toLocaleString()}
                </Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Attempt:</Text>
                <Text style={styles.detailValue}>
                  {selectedDocument.attemptNumber} of {selectedDocument.maxAttempts}
                </Text>
              </View>
            </View>
            
            {/* OCR Results */}
            {selectedDocument.ocrResults && (
              <View style={styles.ocrResultsCard}>
                <Text style={styles.detailsTitle}>OCR Results</Text>
                <Text style={styles.ocrConfidence}>
                  Confidence: {Math.round(selectedDocument.ocrResults.confidence * 100)}%
                </Text>
                {selectedDocument.ocrResults.fields.map((field, index) => (
                  <View key={index} style={styles.detailRow}>
                    <Text style={styles.detailLabel}>{field.fieldType}:</Text>
                    <Text style={styles.detailValue}>{field.value}</Text>
                  </View>
                ))}
              </View>
            )}
            
            {/* Validation Results */}
            {selectedDocument.validationResults && (
              <View style={styles.validationCard}>
                <Text style={styles.detailsTitle}>Validation Results</Text>
                <Text style={styles.validationScore}>
                  Score: {Math.round(selectedDocument.validationResults.score * 100)}%
                </Text>
                {selectedDocument.validationResults.checks.map((check, index) => (
                  <View key={index} style={styles.validationCheck}>
                    <Icon 
                      name={check.passed ? 'check-circle' : 'cancel'} 
                      size={16} 
                      color={check.passed ? '#4CAF50' : '#F44336'} 
                    />
                    <Text style={styles.checkName}>{check.name}</Text>
                    <Text style={styles.checkConfidence}>
                      {Math.round(check.confidence * 100)}%
                    </Text>
                  </View>
                ))}
              </View>
            )}
            
            {/* Review Actions */}
            <View style={styles.reviewActionsCard}>
              <Text style={styles.detailsTitle}>Review Actions</Text>
              
              {/* Notes */}
              <Text style={styles.inputLabel}>Admin Notes (Optional)</Text>
              <TextInput
                style={styles.notesInput}
                value={reviewNotes}
                onChangeText={setReviewNotes}
                placeholder="Add any notes about this document review..."
                multiline
                numberOfLines={3}
              />
              
              {/* Rejection Reason */}
              <Text style={styles.inputLabel}>Rejection Reason (if rejecting)</Text>
              <TouchableOpacity
                style={styles.reasonSelector}
                onPress={() => {
                  Alert.alert(
                    'Select Rejection Reason',
                    '',
                    [
                      ...predefinedRejectionReasons.map(reason => ({
                        text: reason,
                        onPress: () => setRejectionReason(reason),
                      })),
                      { text: 'Cancel', style: 'cancel' },
                    ]
                  );
                }}
              >
                <Text style={styles.reasonText}>
                  {rejectionReason || 'Select rejection reason...'}
                </Text>
                <Icon name="keyboard-arrow-down" size={20} color="#666666" />
              </TouchableOpacity>
              
              {/* Action Buttons */}
              <View style={styles.actionButtons}>
                <TouchableOpacity
                  style={styles.requestInfoButton}
                  onPress={handleRequestMoreInfo}
                >
                  <Icon name="info" size={20} color="#FF9800" />
                  <Text style={styles.requestInfoText}>Request Info</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={styles.rejectButton}
                  onPress={handleRejectDocument}
                  disabled={!rejectionReason.trim()}
                >
                  <Icon name="cancel" size={20} color="#FFFFFF" />
                  <Text style={styles.rejectText}>Reject</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={styles.approveButton}
                  onPress={handleApproveDocument}
                >
                  <Icon name="check-circle" size={20} color="#FFFFFF" />
                  <Text style={styles.approveText}>Approve</Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </View>
        
        {/* Full Screen Image Modal */}
        <Modal
          visible={showImageModal}
          transparent
          animationType="fade"
          onRequestClose={() => setShowImageModal(false)}
        >
          <View style={styles.imageModalContainer}>
            <TouchableOpacity
              style={styles.imageModalBackground}
              onPress={() => setShowImageModal(false)}
            />
            <Image
              source={{ uri: selectedDocument.imageUrl || 'https://via.placeholder.com/300x200' }}
              style={styles.fullScreenImage}
              resizeMode="contain"
            />
            <TouchableOpacity
              style={styles.imageCloseButton}
              onPress={() => setShowImageModal(false)}
            >
              <Icon name="close" size={24} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </Modal>
      </Modal>
    );
  };

  return (
    <View style={[styles.container, style]}>
      <ScrollView
        style={styles.scrollView}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
        showsVerticalScrollIndicator={false}
      >
        {renderAdminStats()}
        {renderFilters()}
        {renderDocumentList()}
      </ScrollView>
      
      {renderReviewModal()}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  scrollView: {
    flex: 1,
  },
  statsContainer: {
    backgroundColor: '#FFFFFF',
    margin: 16,
    padding: 20,
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  statsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333333',
    marginBottom: 16,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  statCard: {
    flex: 1,
    minWidth: 80,
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2196F3',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#666666',
    textAlign: 'center',
  },
  filtersContainer: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 16,
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  filterButtons: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F0F0F0',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  filterButtonActive: {
    backgroundColor: '#E3F2FD',
    borderColor: '#2196F3',
  },
  filterButtonText: {
    fontSize: 14,
    color: '#666666',
    fontWeight: '500',
  },
  filterButtonTextActive: {
    color: '#2196F3',
  },
  sortContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sortLabel: {
    fontSize: 14,
    color: '#666666',
  },
  sortButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#F0F0F0',
    gap: 4,
  },
  sortButtonText: {
    fontSize: 14,
    color: '#333333',
    fontWeight: '500',
  },
  documentsContainer: {
    paddingHorizontal: 16,
    marginBottom: 32,
  },
  documentsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333333',
    marginBottom: 16,
  },
  documentCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  documentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  documentInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  documentText: {
    flex: 1,
  },
  documentTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333333',
    marginBottom: 2,
  },
  documentUser: {
    fontSize: 12,
    color: '#666666',
    marginBottom: 2,
  },
  documentDate: {
    fontSize: 12,
    color: '#999999',
  },
  documentMeta: {
    alignItems: 'flex-end',
  },
  priorityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 4,
  },
  priorityText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  confidenceScore: {
    fontSize: 12,
    color: '#666666',
  },
  ocrPreview: {
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    padding: 12,
  },
  ocrLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#333333',
    marginBottom: 6,
  },
  ocrField: {
    fontSize: 12,
    color: '#666666',
    marginBottom: 2,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333333',
  },
  modalContent: {
    flex: 1,
    padding: 16,
  },
  documentImageContainer: {
    position: 'relative',
    marginBottom: 16,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#F0F0F0',
  },
  documentImage: {
    width: '100%',
    height: 200,
  },
  imageOverlay: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: 16,
    paddingHorizontal: 8,
    paddingVertical: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  imageOverlayText: {
    fontSize: 12,
    color: '#FFFFFF',
  },
  documentDetailsCard: {
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  detailsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333333',
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  detailLabel: {
    fontSize: 14,
    color: '#666666',
  },
  detailValue: {
    fontSize: 14,
    color: '#333333',
    fontWeight: '500',
    textAlign: 'right',
    flex: 1,
    marginLeft: 12,
  },
  ocrResultsCard: {
    backgroundColor: '#E3F2FD',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  ocrConfidence: {
    fontSize: 14,
    fontWeight: '500',
    color: '#2196F3',
    marginBottom: 12,
  },
  validationCard: {
    backgroundColor: '#F3E5F5',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  validationScore: {
    fontSize: 14,
    fontWeight: '500',
    color: '#9C27B0',
    marginBottom: 12,
  },
  validationCheck: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  checkName: {
    fontSize: 14,
    color: '#333333',
    flex: 1,
  },
  checkConfidence: {
    fontSize: 12,
    color: '#666666',
  },
  reviewActionsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333333',
    marginBottom: 8,
    marginTop: 12,
  },
  notesInput: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: '#333333',
    textAlignVertical: 'top',
    marginBottom: 16,
  },
  reasonSelector: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    padding: 12,
    marginBottom: 24,
  },
  reasonText: {
    fontSize: 14,
    color: '#333333',
    flex: 1,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  requestInfoButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#FFF3E0',
    borderWidth: 1,
    borderColor: '#FF9800',
    gap: 6,
  },
  requestInfoText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FF9800',
  },
  rejectButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#F44336',
    gap: 6,
  },
  rejectText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  approveButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#4CAF50',
    gap: 6,
  },
  approveText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  imageModalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageModalBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  fullScreenImage: {
    width: width - 32,
    height: width - 32,
    maxWidth: 400,
    maxHeight: 400,
  },
  imageCloseButton: {
    position: 'absolute',
    top: 50,
    right: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default AdminVerificationDashboard;