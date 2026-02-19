/**
 * @fileoverview Trip sharing bottom sheet for sharing ride with contacts
 * @author Oabona-Majoko
 * @created 2026-02-04
 * @lastModified 2026-02-04
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  FlatList,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { colors } from '../../theme';
import TripSharingService, { TripShareData } from '../../services/TripSharingService';
import { useToast } from '../ui/Toast';

interface TripShareSheetProps {
  visible: boolean;
  onClose: () => void;
  tripData: TripShareData;
}

interface ContactItem {
  name: string;
  phoneNumber: string;
  isPrimary: boolean;
}

const TripShareSheet: React.FC<TripShareSheetProps> = ({
  visible,
  onClose,
  tripData,
}) => {
  const [contacts, setContacts] = useState<ContactItem[]>([]);
  const [isSharing, setIsSharing] = useState(false);
  const sharingService = TripSharingService.getInstance();
  const toast = useToast();

  useEffect(() => {
    if (visible) {
      loadContacts();
    }
  }, [visible]);

  const loadContacts = async () => {
    const loaded = await sharingService.getEmergencyContacts();
    setContacts(loaded);
  };

  const handleShareAll = async () => {
    setIsSharing(true);
    try {
      await sharingService.shareTrip(tripData);
      toast.success('Trip Shared', 'Your trip details have been shared.');
      onClose();
    } catch (error) {
      toast.error('Share Failed', 'Could not share trip. Please try again.');
    } finally {
      setIsSharing(false);
    }
  };

  const handleShareSMS = async (contact: ContactItem) => {
    setIsSharing(true);
    try {
      const success = await sharingService.shareTripViaSMS(tripData, contact.phoneNumber);
      if (success) {
        toast.success('Shared', `Trip shared with ${contact.name} via SMS.`);
      }
    } catch (error) {
      toast.error('SMS Failed', 'Could not send SMS.');
    } finally {
      setIsSharing(false);
    }
  };

  const handleShareWhatsApp = async (contact: ContactItem) => {
    setIsSharing(true);
    try {
      await sharingService.shareTripViaWhatsApp(tripData, contact.phoneNumber);
    } catch (error) {
      toast.error('WhatsApp Failed', 'Could not open WhatsApp.');
    } finally {
      setIsSharing(false);
    }
  };

  const renderContact = ({ item }: { item: ContactItem }) => (
    <View style={styles.contactRow}>
      <View style={styles.contactInfo}>
        <View style={styles.contactAvatar}>
          <Text style={styles.contactInitial}>
            {item.name.charAt(0).toUpperCase()}
          </Text>
        </View>
        <View>
          <View style={styles.contactNameRow}>
            <Text style={styles.contactName}>{item.name}</Text>
            {item.isPrimary && (
              <View style={styles.primaryBadge}>
                <Text style={styles.primaryBadgeText}>Primary</Text>
              </View>
            )}
          </View>
          <Text style={styles.contactPhone}>{item.phoneNumber}</Text>
        </View>
      </View>
      <View style={styles.contactActions}>
        <TouchableOpacity
          style={[styles.shareBtn, styles.smsBtnStyle]}
          onPress={() => handleShareSMS(item)}
          disabled={isSharing}
        >
          <Icon name="sms" size={18} color="#2563EB" />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.shareBtn, styles.waBtnStyle]}
          onPress={() => handleShareWhatsApp(item)}
          disabled={isSharing}
        >
          <Icon name="chat" size={18} color="#25D366" />
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.overlayBg} onPress={onClose} />
        <View style={styles.sheet}>
          {/* Handle */}
          <View style={styles.handle} />

          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.headerTitle}>Share Your Trip</Text>
              <Text style={styles.headerSubtitle}>
                Let someone know where you are
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Icon name="close" size={22} color={colors.text.secondary} />
            </TouchableOpacity>
          </View>

          {/* Trip summary */}
          <View style={styles.tripSummary}>
            <View style={styles.tripRoute}>
              <View style={styles.routeDot} />
              <View style={styles.routeLine} />
              <View style={[styles.routeDot, styles.routeDotDest]} />
            </View>
            <View style={styles.tripRouteText}>
              <Text style={styles.tripRouteCity} numberOfLines={1}>
                {tripData.origin}
              </Text>
              <Text style={styles.tripRouteCity} numberOfLines={1}>
                {tripData.destination}
              </Text>
            </View>
          </View>

          {/* Share with all button */}
          <TouchableOpacity
            style={styles.shareAllBtn}
            onPress={handleShareAll}
            disabled={isSharing}
            activeOpacity={0.8}
          >
            <Icon name="share" size={20} color="#FFFFFF" />
            <Text style={styles.shareAllBtnText}>
              {isSharing ? 'Sharing...' : 'Share Trip Details'}
            </Text>
          </TouchableOpacity>

          {/* Emergency contacts */}
          {contacts.length > 0 ? (
            <View style={styles.contactsSection}>
              <Text style={styles.contactsSectionTitle}>Emergency Contacts</Text>
              <FlatList
                data={contacts}
                renderItem={renderContact}
                keyExtractor={(item) => item.phoneNumber}
                scrollEnabled={false}
              />
            </View>
          ) : (
            <View style={styles.noContacts}>
              <Icon name="people-outline" size={32} color={colors.border.medium} />
              <Text style={styles.noContactsText}>
                No emergency contacts set up yet.
              </Text>
              <Text style={styles.noContactsSubtext}>
                Add contacts in Settings to quickly share trips.
              </Text>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  overlayBg: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingBottom: 30,
    maxHeight: '75%',
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: colors.border.medium,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.text.primary,
  },
  headerSubtitle: {
    fontSize: 13,
    color: colors.text.secondary,
    marginTop: 2,
  },
  closeBtn: {
    padding: 4,
  },
  tripSummary: {
    flexDirection: 'row',
    backgroundColor: colors.background.secondary,
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },
  tripRoute: {
    alignItems: 'center',
    marginRight: 12,
    paddingVertical: 2,
  },
  routeDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#10B981',
  },
  routeLine: {
    width: 2,
    height: 18,
    backgroundColor: colors.border.light,
  },
  routeDotDest: {
    backgroundColor: '#EF4444',
  },
  tripRouteText: {
    flex: 1,
    justifyContent: 'space-between',
  },
  tripRouteCity: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.text.primary,
  },
  shareAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    gap: 8,
    marginBottom: 20,
  },
  shareAllBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  contactsSection: {
    marginBottom: 8,
  },
  contactsSectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: 12,
  },
  contactRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  contactInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  contactAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.primary + '15',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  contactInitial: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.primary,
  },
  contactNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  contactName: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.text.primary,
  },
  primaryBadge: {
    backgroundColor: '#10B981' + '20',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 8,
  },
  primaryBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#10B981',
  },
  contactPhone: {
    fontSize: 12,
    color: colors.text.secondary,
    marginTop: 1,
  },
  contactActions: {
    flexDirection: 'row',
    gap: 8,
  },
  shareBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  smsBtnStyle: {
    backgroundColor: '#2563EB' + '15',
  },
  waBtnStyle: {
    backgroundColor: '#25D366' + '15',
  },
  noContacts: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  noContactsText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.text.primary,
    marginTop: 10,
  },
  noContactsSubtext: {
    fontSize: 12,
    color: colors.text.secondary,
    textAlign: 'center',
    marginTop: 4,
  },
});

export default TripShareSheet;
