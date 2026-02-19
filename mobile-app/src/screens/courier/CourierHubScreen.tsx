/**
 * @fileoverview Unified Courier hub with Send/Deliver toggle tabs
 * @author Oabona-Majoko
 * @created 2026-02-04
 * @lastModified 2026-02-04
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  StatusBar,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { colors } from '../../theme';

interface CourierHubScreenProps {
  navigation: { navigate: (screen: string, params?: Record<string, unknown>) => void; goBack: () => void };
}

type TabMode = 'send' | 'deliver';

const CourierHubScreen: React.FC<CourierHubScreenProps> = ({ navigation }) => {
  const [activeTab, setActiveTab] = useState<TabMode>('send');
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    setTimeout(() => setIsRefreshing(false), 1000);
  };

  const renderSendTab = () => (
    <View style={styles.tabContent}>
      {/* Send a parcel card */}
      <TouchableOpacity
        style={styles.actionCard}
        onPress={() => navigation.navigate('CreatePackage')}
        activeOpacity={0.7}
      >
        <View style={[styles.actionCardIcon, { backgroundColor: '#F59E0B' + '15' }]}>
          <Icon name="add-circle-outline" size={28} color="#F59E0B" />
        </View>
        <View style={styles.actionCardContent}>
          <Text style={styles.actionCardTitle}>Send a Parcel</Text>
          <Text style={styles.actionCardDesc}>
            Create a delivery request for travellers heading your way
          </Text>
        </View>
        <Icon name="chevron-right" size={24} color={colors.text.secondary} />
      </TouchableOpacity>

      {/* My packages card */}
      <TouchableOpacity
        style={styles.actionCard}
        onPress={() => navigation.navigate('PackageMain')}
        activeOpacity={0.7}
      >
        <View style={[styles.actionCardIcon, { backgroundColor: colors.primary + '15' }]}>
          <Icon name="inventory-2" size={28} color={colors.primary} />
        </View>
        <View style={styles.actionCardContent}>
          <Text style={styles.actionCardTitle}>My Packages</Text>
          <Text style={styles.actionCardDesc}>
            Track and manage your sent parcels
          </Text>
        </View>
        <Icon name="chevron-right" size={24} color={colors.text.secondary} />
      </TouchableOpacity>

      {/* How it works */}
      <View style={styles.infoSection}>
        <Text style={styles.infoTitle}>How Sending Works</Text>
        <View style={styles.infoSteps}>
          <View style={styles.infoStep}>
            <View style={styles.infoStepNumber}>
              <Text style={styles.infoStepNumberText}>1</Text>
            </View>
            <Text style={styles.infoStepText}>Describe your parcel and route</Text>
          </View>
          <View style={styles.infoStep}>
            <View style={styles.infoStepNumber}>
              <Text style={styles.infoStepNumberText}>2</Text>
            </View>
            <Text style={styles.infoStepText}>A traveller on that route accepts</Text>
          </View>
          <View style={styles.infoStep}>
            <View style={styles.infoStepNumber}>
              <Text style={styles.infoStepNumberText}>3</Text>
            </View>
            <Text style={styles.infoStepText}>Track delivery with QR verification</Text>
          </View>
        </View>
      </View>
    </View>
  );

  const renderDeliverTab = () => (
    <View style={styles.tabContent}>
      {/* Available deliveries */}
      <TouchableOpacity
        style={styles.actionCard}
        onPress={() => navigation.navigate('CourierMain')}
        activeOpacity={0.7}
      >
        <View style={[styles.actionCardIcon, { backgroundColor: '#8B5CF6' + '15' }]}>
          <Icon name="local-shipping" size={28} color="#8B5CF6" />
        </View>
        <View style={styles.actionCardContent}>
          <Text style={styles.actionCardTitle}>Browse Deliveries</Text>
          <Text style={styles.actionCardDesc}>
            Find parcels to deliver along your route and offset fuel costs
          </Text>
        </View>
        <Icon name="chevron-right" size={24} color={colors.text.secondary} />
      </TouchableOpacity>

      {/* Scan QR */}
      <TouchableOpacity
        style={styles.actionCard}
        onPress={() => navigation.navigate('QRScanner', {})}
        activeOpacity={0.7}
      >
        <View style={[styles.actionCardIcon, { backgroundColor: '#10B981' + '15' }]}>
          <Icon name="qr-code-scanner" size={28} color="#10B981" />
        </View>
        <View style={styles.actionCardContent}>
          <Text style={styles.actionCardTitle}>Scan QR Code</Text>
          <Text style={styles.actionCardDesc}>
            Confirm pickup or delivery of a package
          </Text>
        </View>
        <Icon name="chevron-right" size={24} color={colors.text.secondary} />
      </TouchableOpacity>

      {/* How it works */}
      <View style={styles.infoSection}>
        <Text style={styles.infoTitle}>How Delivering Works</Text>
        <View style={styles.infoSteps}>
          <View style={styles.infoStep}>
            <View style={styles.infoStepNumber}>
              <Text style={styles.infoStepNumberText}>1</Text>
            </View>
            <Text style={styles.infoStepText}>Browse parcels on your route</Text>
          </View>
          <View style={styles.infoStep}>
            <View style={styles.infoStepNumber}>
              <Text style={styles.infoStepNumberText}>2</Text>
            </View>
            <Text style={styles.infoStepText}>Accept and collect with QR scan</Text>
          </View>
          <View style={styles.infoStep}>
            <View style={styles.infoStepNumber}>
              <Text style={styles.infoStepNumberText}>3</Text>
            </View>
            <Text style={styles.infoStepText}>Deliver and get paid via escrow</Text>
          </View>
        </View>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.background.primary} />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Courier</Text>
        <Text style={styles.headerSubtitle}>Send or deliver parcels along travel routes</Text>
      </View>

      {/* Tab toggle */}
      <View style={styles.tabToggle}>
        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'send' && styles.tabBtnActive]}
          onPress={() => setActiveTab('send')}
          activeOpacity={0.7}
        >
          <Icon
            name="outbox"
            size={18}
            color={activeTab === 'send' ? '#FFFFFF' : colors.text.secondary}
          />
          <Text style={[styles.tabBtnText, activeTab === 'send' && styles.tabBtnTextActive]}>
            Send
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'deliver' && styles.tabBtnActive]}
          onPress={() => setActiveTab('deliver')}
          activeOpacity={0.7}
        >
          <Icon
            name="delivery-dining"
            size={18}
            color={activeTab === 'deliver' ? '#FFFFFF' : colors.text.secondary}
          />
          <Text style={[styles.tabBtnText, activeTab === 'deliver' && styles.tabBtnTextActive]}>
            Deliver
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />
        }
      >
        {activeTab === 'send' ? renderSendTab() : renderDeliverTab()}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  scrollView: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.text.primary,
  },
  headerSubtitle: {
    fontSize: 14,
    color: colors.text.secondary,
    marginTop: 4,
  },
  tabToggle: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginVertical: 12,
    backgroundColor: colors.background.secondary,
    borderRadius: 12,
    padding: 4,
  },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    gap: 6,
  },
  tabBtnActive: {
    backgroundColor: colors.primary,
    elevation: 2,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  tabBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text.secondary,
  },
  tabBtnTextActive: {
    color: '#FFFFFF',
  },
  tabContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 24,
  },
  actionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  actionCardIcon: {
    width: 52,
    height: 52,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  actionCardContent: {
    flex: 1,
    marginRight: 8,
  },
  actionCardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: 4,
  },
  actionCardDesc: {
    fontSize: 13,
    color: colors.text.secondary,
    lineHeight: 18,
  },
  infoSection: {
    marginTop: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 18,
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: 16,
  },
  infoSteps: {
    gap: 14,
  },
  infoStep: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  infoStepNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.primary + '15',
    justifyContent: 'center',
    alignItems: 'center',
  },
  infoStepNumberText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: colors.primary,
  },
  infoStepText: {
    fontSize: 14,
    color: colors.text.secondary,
    flex: 1,
  },
});

export default CourierHubScreen;
