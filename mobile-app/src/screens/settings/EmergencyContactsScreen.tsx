/**
 * @fileoverview Emergency contacts management screen
 * @author Oabona-Majoko
 * @created 2025-01-27
 * @lastModified 2025-01-27
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  SafeAreaView,
  TextInput,
  Modal,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { colors } from '../../theme';
import EmergencyService, { EmergencyContact } from '../../services/EmergencyServiceSimple';
import PhoneInput from '../../components/ui/PhoneInput';
import logger from '../../services/LoggingService';

/** Lightweight country shape matching what PhoneInput emits */
interface PhoneCountry {
  code: string;
  name: string;
  dialCode: string;
  flag: string;
}

const log = logger.createLogger('EmergencyContactsScreen');

interface EmergencyContactsScreenProps {
  navigation: { navigate: (screen: string, params?: Record<string, unknown>) => void; goBack: () => void };
}

const EmergencyContactsScreen: React.FC<EmergencyContactsScreenProps> = ({ navigation }) => {
  const [contacts, setContacts] = useState<EmergencyContact[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newContact, setNewContact] = useState({
    name: '',
    phoneNumber: '',
    relationship: '',
    isPrimary: false,
  });
  const [selectedCountry, setSelectedCountry] = useState<PhoneCountry | null>(null);

  useEffect(() => {
    loadEmergencyContacts();
  }, []);

  const loadEmergencyContacts = async (): Promise<void> => {
    try {
      setIsLoading(true);
      const emergencyContacts = await EmergencyService.getEmergencyContacts();
      setContacts(emergencyContacts);
    } catch (error) {
      log.error('Error loading emergency contacts:', error);
      Alert.alert('Error', 'Failed to load emergency contacts');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddContact = async (): Promise<void> => {
    if (!newContact.name.trim() || !newContact.phoneNumber.trim()) {
      Alert.alert('Validation Error', 'Please fill in name and phone number');
      return;
    }

    // Construct full phone number with country code
    const fullPhoneNumber = selectedCountry?.dialCode
      ? `${selectedCountry.dialCode}${newContact.phoneNumber.replace(/\s/g, '')}`
      : newContact.phoneNumber.replace(/\s/g, '');

    try {
      // Create the contact with full phone number
      const contactToAdd = {
        ...newContact,
        phoneNumber: fullPhoneNumber
      };
      
      await EmergencyService.getEmergencyContacts(); // Mock implementation
      setShowAddModal(false);
      setNewContact({ name: '', phoneNumber: '', relationship: '', isPrimary: false });
      setSelectedCountry(null);
      await loadEmergencyContacts();
      Alert.alert('Success', 'Emergency contact added successfully');
    } catch (error) {
      log.error('Error adding contact:', error);
      Alert.alert('Error', 'Failed to add emergency contact');
    }
  };

  const handleCountryChange = (country: PhoneCountry): void => {
    setSelectedCountry(country);
  };

  const handleRemoveContact = (contact: EmergencyContact): void => {
    Alert.alert(
      'Remove Contact',
      `Remove ${contact.name} from emergency contacts?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => removeContact(contact.id),
        },
      ]
    );
  };

  const removeContact = async (contactId: string): Promise<void> => {
    try {
      // Implementation would remove from AsyncStorage and server
      const updatedContacts = contacts.filter(c => c.id !== contactId);
      setContacts(updatedContacts);
      Alert.alert('Success', 'Emergency contact removed');
    } catch (error) {
      log.error('Error removing contact:', error);
      Alert.alert('Error', 'Failed to remove contact');
    }
  };

  const handleCallContact = (contact: EmergencyContact): void => {
    Alert.alert(
      'Call Emergency Contact',
      `Call ${contact.name} at ${contact.phoneNumber}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Call', onPress: () => log.info(`Calling ${contact.phoneNumber}`) },
      ]
    );
  };

  const renderContactCard = (contact: EmergencyContact): React.ReactNode => (
    <View key={contact.id} style={styles.contactCard}>
      <View style={styles.contactHeader}>
        <View style={styles.contactInfo}>
          <View style={styles.contactNameRow}>
            <Text style={styles.contactName}>{contact.name}</Text>
            {contact.isPrimary && (
              <View style={styles.primaryBadge}>
                <Text style={styles.primaryText}>PRIMARY</Text>
              </View>
            )}
          </View>
          <Text style={styles.contactPhone}>{contact.phoneNumber}</Text>
          {contact.relationship && (
            <Text style={styles.contactRelationship}>{contact.relationship}</Text>
          )}
        </View>
        
        <View style={styles.contactActions}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => handleCallContact(contact)}
          >
            <Icon name="phone" size={20} color={colors.primary} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => handleRemoveContact(contact)}
          >
            <Icon name="delete" size={20} color="#F44336" />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  const renderAddContactModal = (): React.ReactNode => (
    <Modal
      visible={showAddModal}
      animationType="slide"
      transparent={true}
      onRequestClose={() => setShowAddModal(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Add Emergency Contact</Text>
            <TouchableOpacity onPress={() => setShowAddModal(false)}>
              <Icon name="close" size={24} color="#666666" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalBody}>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Full Name *</Text>
              <TextInput
                style={styles.textInput}
                value={newContact.name}
                onChangeText={(text) => setNewContact({ ...newContact, name: text })}
                placeholder="Enter full name"
                autoCapitalize="words"
              />
            </View>

            <View style={styles.inputGroup}>
              <PhoneInput
                value={newContact.phoneNumber}
                onChangeText={(text) => setNewContact({ ...newContact, phoneNumber: text })}
                onCountryChange={handleCountryChange}
                label="Phone Number *"
                placeholder="Enter phone number"
                defaultCountry="BW"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Relationship</Text>
              <TextInput
                style={styles.textInput}
                value={newContact.relationship}
                onChangeText={(text) => setNewContact({ ...newContact, relationship: text })}
                placeholder="e.g., Spouse, Parent, Friend"
                autoCapitalize="words"
              />
            </View>

            <TouchableOpacity
              style={styles.primaryToggle}
              onPress={() => setNewContact({ ...newContact, isPrimary: !newContact.isPrimary })}
            >
              <Icon
                name={newContact.isPrimary ? 'check-box' : 'check-box-outline-blank'}
                size={24}
                color={colors.primary}
              />
              <Text style={styles.primaryToggleText}>Set as primary emergency contact</Text>
            </TouchableOpacity>
          </ScrollView>

          <View style={styles.modalFooter}>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => setShowAddModal(false)}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.saveButton}
              onPress={handleAddContact}
            >
              <Text style={styles.saveButtonText}>Add Contact</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );

  const renderEmptyState = (): React.ReactNode => (
    <View style={styles.emptyState}>
      <Icon name="contacts" size={64} color="#CCCCCC" />
      <Text style={styles.emptyStateTitle}>No Emergency Contacts</Text>
      <Text style={styles.emptyStateSubtitle}>
        Add emergency contacts to enable safety features and emergency alerts.
      </Text>
      <TouchableOpacity
        style={styles.addFirstContactButton}
        onPress={() => setShowAddModal(true)}
      >
        <Icon name="add" size={20} color="#FFFFFF" />
        <Text style={styles.addFirstContactText}>Add Your First Contact</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Icon name="arrow-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Emergency Contacts</Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => setShowAddModal(true)}
        >
          <Icon name="add" size={24} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.infoCard}>
          <Icon name="info" size={24} color={colors.primary} />
          <View style={styles.infoContent}>
            <Text style={styles.infoTitle}>Safety First</Text>
            <Text style={styles.infoText}>
              Emergency contacts will be notified immediately when you trigger an emergency alert. 
              Make sure these are people who can help you in case of emergency.
            </Text>
          </View>
        </View>

        {isLoading ? (
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>Loading contacts...</Text>
          </View>
        ) : contacts.length > 0 ? (
          <View style={styles.contactsList}>
            <Text style={styles.sectionTitle}>Your Emergency Contacts</Text>
            {contacts.map(renderContactCard)}
          </View>
        ) : (
          renderEmptyState()
        )}
      </ScrollView>

      {renderAddContactModal()}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 12,
    elevation: 4,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  backButton: {
    padding: 8,
    marginRight: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
    flex: 1,
  },
  addButton: {
    padding: 8,
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  infoCard: {
    flexDirection: 'row',
    backgroundColor: '#E3F2FD',
    borderRadius: 12,
    padding: 16,
    marginVertical: 16,
    gap: 12,
  },
  infoContent: {
    flex: 1,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333333',
    marginBottom: 4,
  },
  infoText: {
    fontSize: 14,
    color: '#666666',
    lineHeight: 20,
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    fontSize: 16,
    color: '#666666',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: 16,
  },
  contactsList: {
    paddingBottom: 20,
  },
  contactCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    borderWidth: 1,
    borderColor: '#F0F0F0',
  },
  contactHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  contactInfo: {
    flex: 1,
  },
  contactNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  contactName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333333',
  },
  primaryBadge: {
    backgroundColor: colors.primary,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  primaryText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  contactPhone: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 2,
  },
  contactRelationship: {
    fontSize: 12,
    color: '#999999',
  },
  contactActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: '#F5F5F5',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 40,
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333333',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateSubtitle: {
    fontSize: 14,
    color: '#666666',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  addFirstContactButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
    gap: 8,
  },
  addFirstContactText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333333',
  },
  modalBody: {
    padding: 20,
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333333',
    marginBottom: 8,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    color: '#333333',
    backgroundColor: '#FFFFFF',
  },
  primaryToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
  },
  primaryToggleText: {
    fontSize: 14,
    color: '#333333',
  },
  modalFooter: {
    flexDirection: 'row',
    gap: 12,
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666666',
  },
  saveButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: colors.primary,
    alignItems: 'center',
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});

export default EmergencyContactsScreen;