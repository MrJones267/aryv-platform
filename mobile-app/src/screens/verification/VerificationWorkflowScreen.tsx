/**
 * @fileoverview Complete verification workflow with step-by-step document upload and tracking
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
  SafeAreaView,
  Alert,
  RefreshControl,
  // ProgressBarAndroid,
  ActivityIndicator,
  Platform,
  Animated,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import DocumentVerificationService, {
  UserVerificationStatus,
  DocumentRecord,
  DocumentType,
  VerificationRequirements,
  DocumentMetadata,
} from '../../services/DocumentVerificationService';
import DocumentCapture from '../../components/verification/DocumentCapture';

interface VerificationWorkflowScreenProps {
  navigation: any;
  route?: any;
}

interface DocumentUploadState {
  isUploading: boolean;
  progress: number;
  error?: string;
}

const VerificationWorkflowScreen: React.FC<VerificationWorkflowScreenProps> = ({ navigation }) => {
  const dispatch = useAppDispatch();
  const { profile: user } = useAppSelector((state) => state.user);
  
  const [verificationStatus, setVerificationStatus] = useState<UserVerificationStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showDocumentCapture, setShowDocumentCapture] = useState(false);
  const [selectedDocumentType, setSelectedDocumentType] = useState<DocumentType | null>(null);
  const [uploadStates, setUploadStates] = useState<Record<string, DocumentUploadState>>({});
  
  // Animation values
  const fadeAnim = useState(new Animated.Value(0))[0];
  const slideAnim = useState(new Animated.Value(50))[0];

  useEffect(() => {
    loadVerificationStatus();
    
    // Animate entrance
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const loadVerificationStatus = async () => {
    if (!user?.id) return;
    
    try {
      setIsLoading(true);
      const status = await DocumentVerificationService.getUserVerificationStatus(user.id);
      setVerificationStatus(status);
    } catch (error: any) {
      console.error('Error loading verification status:', error);
      Alert.alert('Error', 'Failed to load verification status. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadVerificationStatus();
    setRefreshing(false);
  };

  const handleDocumentUpload = (documentType: DocumentType) => {
    setSelectedDocumentType(documentType);
    setShowDocumentCapture(true);
  };

  const handleDocumentCaptured = async (imageUri: string, metadata: DocumentMetadata) => {
    if (!user?.id || !selectedDocumentType) return;

    setShowDocumentCapture(false);
    
    // Initialize upload state
    setUploadStates(prev => ({
      ...prev,
      [selectedDocumentType]: {
        isUploading: true,
        progress: 0,
      }
    }));

    try {
      // Simulate upload progress
      const progressInterval = setInterval(() => {
        setUploadStates(prev => ({
          ...prev,
          [selectedDocumentType]: {
            ...prev[selectedDocumentType],
            progress: Math.min((prev[selectedDocumentType]?.progress || 0) + 10, 90),
          }
        }));
      }, 200);

      const uploadResponse = await DocumentVerificationService.uploadDocument({
        userId: user.id,
        documentType: selectedDocumentType,
        imageUri,
        metadata,
      });

      clearInterval(progressInterval);

      if (uploadResponse.success) {
        // Complete upload progress
        setUploadStates(prev => ({
          ...prev,
          [selectedDocumentType]: {
            isUploading: false,
            progress: 100,
          }
        }));

        // Show success message
        Alert.alert(
          'Document Uploaded',
          uploadResponse.message,
          [
            { text: 'OK', onPress: () => {
              // Refresh verification status
              loadVerificationStatus();
              
              // Clear upload state after a delay
              setTimeout(() => {
                setUploadStates(prev => {
                  const newState = { ...prev };
                  delete newState[selectedDocumentType];
                  return newState;
                });
              }, 2000);
            }}
          ]
        );
      } else {
        throw new Error(uploadResponse.error || 'Upload failed');
      }
    } catch (error: any) {
      console.error('Document upload error:', error);
      
      setUploadStates(prev => ({
        ...prev,
        [selectedDocumentType]: {
          isUploading: false,
          progress: 0,
          error: error.message,
        }
      }));

      Alert.alert(
        'Upload Failed',
        error.message || 'Failed to upload document. Please try again.',
        [
          { text: 'Retry', onPress: () => handleDocumentUpload(selectedDocumentType) },
          { text: 'Cancel' },
        ]
      );
    }

    setSelectedDocumentType(null);
  };

  const handleResubmitDocument = (documentRecord: DocumentRecord) => {
    Alert.alert(
      'Resubmit Document',
      `Your ${documentRecord.documentType.replace('_', ' ')} was rejected. Would you like to resubmit it?`,
      [
        { text: 'Cancel' },
        { 
          text: 'Resubmit', 
          onPress: () => handleDocumentUpload(documentRecord.documentType) 
        },
      ]
    );
  };

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'approved': return '#4CAF50';
      case 'pending_upload': return '#9E9E9E';
      case 'uploaded': case 'processing': return '#2196F3';
      case 'under_review': return '#FF9800';
      case 'rejected': case 'expired': return '#F44336';
      case 'requires_resubmission': return '#FF5722';
      default: return '#9E9E9E';
    }
  };

  const getStatusIcon = (status: string): string => {
    switch (status) {
      case 'approved': return 'check-circle';
      case 'pending_upload': return 'radio-button-unchecked';
      case 'uploaded': case 'processing': return 'hourglass-empty';
      case 'under_review': return 'visibility';
      case 'rejected': return 'cancel';
      case 'expired': return 'schedule';
      case 'requires_resubmission': return 'refresh';
      default: return 'help-outline';
    }
  };

  const getDocumentStatus = (documentType: DocumentType): DocumentRecord | null => {
    return verificationStatus?.submittedDocuments.find(doc => doc.documentType === documentType) || null;
  };

  const renderProgressBar = () => {
    if (!verificationStatus) return null;

    // const ProgressComponent = Platform.OS === 'android' ? ProgressBarAndroid : ActivityIndicator;
    
    return (
      <View style={styles.progressContainer}>
        <View style={styles.progressHeader}>
          <Text style={styles.progressTitle}>Verification Progress</Text>
          <Text style={styles.progressPercent}>
            {Math.round(verificationStatus.completionPercentage)}%
          </Text>
        </View>
        
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${verificationStatus.completionPercentage}%` }]} />
        </View>
        
        <Text style={styles.progressSubtitle}>
          {verificationStatus.submittedDocuments.length} of {verificationStatus.requiredDocuments.length} documents submitted
        </Text>
      </View>
    );
  };

  const renderVerificationStatus = () => {
    if (!verificationStatus) return null;

    const getOverallStatusColor = () => {
      switch (verificationStatus.overallStatus) {
        case 'verified': return '#4CAF50';
        case 'pending': return '#FF9800';
        case 'suspended': return '#F44336';
        default: return '#9E9E9E';
      }
    };

    const getOverallStatusIcon = () => {
      switch (verificationStatus.overallStatus) {
        case 'verified': return 'verified';
        case 'pending': return 'schedule';
        case 'suspended': return 'block';
        default: return 'help-outline';
      }
    };

    return (
      <View style={styles.statusCard}>
        <View style={styles.statusHeader}>
          <View style={styles.statusInfo}>
            <Icon 
              name={getOverallStatusIcon()} 
              size={32} 
              color={getOverallStatusColor()} 
            />
            <View style={styles.statusText}>
              <Text style={styles.statusTitle}>
                {verificationStatus.overallStatus.charAt(0).toUpperCase() + 
                 verificationStatus.overallStatus.slice(1)}
              </Text>
              <Text style={styles.statusSubtitle}>
                Verification Level: {verificationStatus.verificationLevel}
              </Text>
            </View>
          </View>
          
          <View style={styles.permissionsContainer}>
            <View style={styles.permission}>
              <Icon 
                name={verificationStatus.canBookRides ? 'check-circle' : 'cancel'} 
                size={20} 
                color={verificationStatus.canBookRides ? '#4CAF50' : '#F44336'} 
              />
              <Text style={styles.permissionText}>Book Rides</Text>
            </View>
            <View style={styles.permission}>
              <Icon 
                name={verificationStatus.canStartDriving ? 'check-circle' : 'cancel'} 
                size={20} 
                color={verificationStatus.canStartDriving ? '#4CAF50' : '#F44336'} 
              />
              <Text style={styles.permissionText}>Start Driving</Text>
            </View>
          </View>
        </View>
      </View>
    );
  };

  const renderDocumentRequirements = () => {
    if (!verificationStatus) return null;

    return (
      <View style={styles.requirementsContainer}>
        <Text style={styles.sectionTitle}>Required Documents</Text>
        
        {verificationStatus.requiredDocuments.map((requirement, index) => {
          const documentStatus = getDocumentStatus(requirement.documentType);
          const uploadState = uploadStates[requirement.documentType];
          
          return (
            <View key={requirement.documentType} style={styles.documentCard}>
              <View style={styles.documentHeader}>
                <View style={styles.documentInfo}>
                  <Icon 
                    name={getStatusIcon(documentStatus?.status || 'pending_upload')} 
                    size={24} 
                    color={getStatusColor(documentStatus?.status || 'pending_upload')} 
                  />
                  <View style={styles.documentText}>
                    <Text style={styles.documentTitle}>
                      {requirement.documentType.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                    </Text>
                    <Text style={styles.documentDescription}>
                      {requirement.description}
                    </Text>
                    {documentStatus && (
                      <Text style={[styles.documentStatus, { 
                        color: getStatusColor(documentStatus.status) 
                      }]}>
                        Status: {documentStatus.status.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                      </Text>
                    )}
                  </View>
                </View>
                
                <View style={styles.documentActions}>
                  {!documentStatus && (
                    <TouchableOpacity
                      style={styles.uploadButton}
                      onPress={() => handleDocumentUpload(requirement.documentType)}
                      disabled={!!uploadState?.isUploading}
                    >
                      <Icon name="camera-alt" size={20} color="#FFFFFF" />
                      <Text style={styles.uploadButtonText}>Upload</Text>
                    </TouchableOpacity>
                  )}
                  
                  {documentStatus?.status === 'rejected' && (
                    <TouchableOpacity
                      style={styles.resubmitButton}
                      onPress={() => handleResubmitDocument(documentStatus)}
                    >
                      <Icon name="refresh" size={20} color="#FF5722" />
                      <Text style={styles.resubmitButtonText}>Resubmit</Text>
                    </TouchableOpacity>
                  )}
                  
                  {documentStatus?.status === 'approved' && (
                    <View style={styles.approvedBadge}>
                      <Icon name="check" size={16} color="#FFFFFF" />
                      <Text style={styles.approvedText}>Approved</Text>
                    </View>
                  )}
                </View>
              </View>
              
              {uploadState?.isUploading && (
                <View style={styles.uploadProgress}>
                  <Text style={styles.uploadProgressText}>
                    Uploading... {uploadState.progress}%
                  </Text>
                  <View style={styles.uploadProgressBar}>
                    <View 
                      style={[
                        styles.uploadProgressFill, 
                        { width: `${uploadState.progress}%` }
                      ]} 
                    />
                  </View>
                </View>
              )}
              
              {uploadState?.error && (
                <View style={styles.uploadError}>
                  <Icon name="error" size={16} color="#F44336" />
                  <Text style={styles.uploadErrorText}>{uploadState.error}</Text>
                </View>
              )}
              
              {documentStatus?.rejectionReason && (
                <View style={styles.rejectionReason}>
                  <Icon name="info" size={16} color="#FF5722" />
                  <Text style={styles.rejectionReasonText}>
                    {documentStatus.rejectionReason}
                  </Text>
                </View>
              )}
              
              {documentStatus?.adminNotes && (
                <View style={styles.adminNotes}>
                  <Icon name="note" size={16} color="#2196F3" />
                  <Text style={styles.adminNotesText}>
                    Admin Notes: {documentStatus.adminNotes}
                  </Text>
                </View>
              )}
            </View>
          );
        })}
      </View>
    );
  };

  const renderNextSteps = () => {
    if (!verificationStatus || verificationStatus.nextSteps.length === 0) return null;

    return (
      <View style={styles.nextStepsContainer}>
        <Text style={styles.sectionTitle}>Next Steps</Text>
        {verificationStatus.nextSteps.map((step, index) => (
          <View key={index} style={styles.nextStepItem}>
            <View style={styles.nextStepNumber}>
              <Text style={styles.nextStepNumberText}>{index + 1}</Text>
            </View>
            <Text style={styles.nextStepText}>{step}</Text>
          </View>
        ))}
      </View>
    );
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Icon name="assignment" size={48} color="#2196F3" />
          <Text style={styles.loadingText}>Loading verification status...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton} 
          onPress={() => navigation.goBack()}
        >
          <Icon name="arrow-back" size={24} color="#333333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Document Verification</Text>
        <TouchableOpacity style={styles.helpButton} onPress={() => {}}>
          <Icon name="help-outline" size={24} color="#2196F3" />
        </TouchableOpacity>
      </View>

      <Animated.ScrollView
        style={[styles.scrollView, {
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }],
        }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        {renderProgressBar()}
        {renderVerificationStatus()}
        {renderDocumentRequirements()}
        {renderNextSteps()}
      </Animated.ScrollView>

      {showDocumentCapture && selectedDocumentType && (
        <DocumentCapture
          documentType={selectedDocumentType}
          onCapture={handleDocumentCaptured}
          onCancel={() => {
            setShowDocumentCapture(false);
            setSelectedDocumentType(null);
          }}
          visible={showDocumentCapture}
          guidelines={
            verificationStatus?.requiredDocuments
              .find(req => req.documentType === selectedDocumentType)
              ?.guidelines || []
          }
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333333',
  },
  helpButton: {
    padding: 8,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  loadingText: {
    fontSize: 16,
    color: '#666666',
    marginTop: 16,
    textAlign: 'center',
  },
  scrollView: {
    flex: 1,
  },
  progressContainer: {
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
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  progressTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333333',
  },
  progressPercent: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2196F3',
  },
  progressBar: {
    height: 8,
    borderRadius: 4,
    marginBottom: 8,
    backgroundColor: '#E0E0E0',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#2196F3',
    borderRadius: 4,
  },
  progressSubtitle: {
    fontSize: 14,
    color: '#666666',
    textAlign: 'center',
  },
  statusCard: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 20,
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  statusHeader: {
    gap: 16,
  },
  statusInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  statusText: {
    flex: 1,
  },
  statusTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333333',
    marginBottom: 4,
  },
  statusSubtitle: {
    fontSize: 14,
    color: '#666666',
  },
  permissionsContainer: {
    flexDirection: 'row',
    gap: 24,
  },
  permission: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  permissionText: {
    fontSize: 14,
    color: '#666666',
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333333',
    marginBottom: 16,
  },
  requirementsContainer: {
    paddingHorizontal: 16,
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
    alignItems: 'center',
    justifyContent: 'space-between',
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
    marginBottom: 4,
  },
  documentDescription: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 4,
    lineHeight: 18,
  },
  documentStatus: {
    fontSize: 12,
    fontWeight: '500',
  },
  documentActions: {
    alignItems: 'center',
  },
  uploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2196F3',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
  },
  uploadButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  resubmitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF3E0',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#FF5722',
    gap: 6,
  },
  resubmitButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FF5722',
  },
  approvedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4CAF50',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 4,
  },
  approvedText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  uploadProgress: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  uploadProgressText: {
    fontSize: 12,
    color: '#666666',
    marginBottom: 8,
  },
  uploadProgressBar: {
    height: 4,
    backgroundColor: '#E0E0E0',
    borderRadius: 2,
    overflow: 'hidden',
  },
  uploadProgressFill: {
    height: '100%',
    backgroundColor: '#2196F3',
    borderRadius: 2,
  },
  uploadError: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
    gap: 8,
  },
  uploadErrorText: {
    fontSize: 12,
    color: '#F44336',
    flex: 1,
  },
  rejectionReason: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
    gap: 8,
  },
  rejectionReasonText: {
    fontSize: 12,
    color: '#FF5722',
    flex: 1,
    lineHeight: 16,
  },
  adminNotes: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 8,
    gap: 8,
  },
  adminNotesText: {
    fontSize: 12,
    color: '#2196F3',
    flex: 1,
    lineHeight: 16,
  },
  nextStepsContainer: {
    paddingHorizontal: 16,
    marginBottom: 32,
  },
  nextStepItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
    gap: 12,
  },
  nextStepNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#2196F3',
    justifyContent: 'center',
    alignItems: 'center',
  },
  nextStepNumberText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  nextStepText: {
    fontSize: 14,
    color: '#333333',
    flex: 1,
    lineHeight: 20,
  },
});

export default VerificationWorkflowScreen;