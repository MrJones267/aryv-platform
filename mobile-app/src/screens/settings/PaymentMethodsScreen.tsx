/**
 * @fileoverview Payment Methods management screen
 * @author Oabona-Majoko
 * @created 2025-01-27
 * @lastModified 2025-01-27
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Alert,
  Modal,
  TextInput,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { colors } from '../../theme';
import { paymentApi, SavedPaymentMethod, PaymentProvider } from '../../services/api';
import logger from '../../services/LoggingService';

const log = logger.createLogger('PaymentMethodsScreen');

interface PaymentMethodsScreenProps {
  navigation: { navigate: (screen: string, params?: Record<string, unknown>) => void; goBack: () => void };
}

interface PaymentMethod {
  id: string;
  type: 'card' | 'bank' | 'mobile';
  name: string;
  last4?: string;
  expiryDate?: string;
  phone?: string;
  provider?: string;
  isDefault: boolean;
  icon: string;
}

interface AddCardFormData {
  cardNumber: string;
  expiryDate: string;
  cvv: string;
  cardholderName: string;
}

interface AddMobileMoneyFormData {
  phone: string;
  provider: PaymentProvider;
  accountName: string;
}

const MOBILE_MONEY_PROVIDERS: { value: PaymentProvider; label: string; icon: string }[] = [
  { value: 'orange_money', label: 'Orange Money', icon: 'phone-android' },
  { value: 'mtn_momo', label: 'MTN MoMo', icon: 'phone-android' },
  { value: 'mpesa', label: 'M-Pesa', icon: 'phone-android' },
  { value: 'fnb_ewallet', label: 'FNB eWallet', icon: 'account-balance' },
];

const PaymentMethodsScreen: React.FC<PaymentMethodsScreenProps> = ({ navigation }) => {
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [isAddCardModalVisible, setIsAddCardModalVisible] = useState(false);
  const [isAddMobileMoneyVisible, setIsAddMobileMoneyVisible] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [cardFormData, setCardFormData] = useState<AddCardFormData>({
    cardNumber: '',
    expiryDate: '',
    cvv: '',
    cardholderName: '',
  });
  const [mobileMoneyForm, setMobileMoneyForm] = useState<AddMobileMoneyFormData>({
    phone: '',
    provider: 'orange_money',
    accountName: '',
  });

  useEffect(() => {
    loadPaymentMethods();
  }, []);

  const loadPaymentMethods = async () => {
    setIsLoading(true);
    try {
      const response = await paymentApi.getPaymentMethods();
      if (response.success && response.data) {
        setPaymentMethods(response.data.map(mapSavedMethod));
      }
    } catch (error) {
      log.info('Error loading payment methods, using defaults:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const mapSavedMethod = (m: SavedPaymentMethod): PaymentMethod => ({
    id: m.id,
    type: m.type === 'mobile_money' ? 'mobile' : m.type === 'card' ? 'card' : 'bank',
    name: m.label,
    last4: m.last4,
    expiryDate: m.expiryDate,
    phone: m.phone,
    provider: m.provider,
    isDefault: m.isDefault,
    icon: m.type === 'card' ? 'credit-card' : 'phone-android',
  });

  const handleSetDefault = async (id: string): Promise<void> => {
    try {
      await paymentApi.setDefaultPaymentMethod(id);
      setPaymentMethods(methods =>
        methods.map(method => ({
          ...method,
          isDefault: method.id === id,
        }))
      );
    } catch (error) {
      // Optimistic update even on failure
      setPaymentMethods(methods =>
        methods.map(method => ({
          ...method,
          isDefault: method.id === id,
        }))
      );
    }
  };

  const handleDeletePaymentMethod = (id: string, name: string): void => {
    Alert.alert(
      'Delete Payment Method',
      `Are you sure you want to remove ${name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await paymentApi.removePaymentMethod(id);
            } catch (error) {
              // Remove locally anyway
            }
            setPaymentMethods(methods => methods.filter(method => method.id !== id));
          },
        },
      ]
    );
  };

  const handleAddCard = async (): Promise<void> => {
    if (!cardFormData.cardNumber || !cardFormData.expiryDate ||
        !cardFormData.cvv || !cardFormData.cardholderName) {
      Alert.alert('Error', 'Please fill in all fields.');
      return;
    }

    setIsSaving(true);
    try {
      const [expiryMonth, expiryYear] = cardFormData.expiryDate.split('/');
      const response = await paymentApi.addCard({
        cardNumber: cardFormData.cardNumber.replace(/\s/g, ''),
        expiryMonth: parseInt(expiryMonth, 10),
        expiryYear: parseInt('20' + expiryYear, 10),
        cvv: cardFormData.cvv,
        cardholderName: cardFormData.cardholderName,
        setAsDefault: paymentMethods.length === 0,
      });

      if (response.success && response.data) {
        setPaymentMethods(prev => [...prev, mapSavedMethod(response.data!)]);
      } else {
        // Fallback: add locally
        setPaymentMethods(prev => [...prev, {
          id: Date.now().toString(),
          type: 'card',
          name: 'Card',
          last4: cardFormData.cardNumber.slice(-4),
          expiryDate: cardFormData.expiryDate,
          isDefault: prev.length === 0,
          icon: 'credit-card',
        }]);
      }

      setIsAddCardModalVisible(false);
      setCardFormData({ cardNumber: '', expiryDate: '', cvv: '', cardholderName: '' });
      Alert.alert('Success', 'Card added successfully!');
    } catch (error) {
      Alert.alert('Error', 'Failed to add card. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddMobileMoney = async (): Promise<void> => {
    if (!mobileMoneyForm.phone) {
      Alert.alert('Error', 'Please enter your mobile money phone number.');
      return;
    }

    setIsSaving(true);
    try {
      const response = await paymentApi.addMobileMoney({
        phone: mobileMoneyForm.phone,
        provider: mobileMoneyForm.provider,
        accountName: mobileMoneyForm.accountName || undefined,
        setAsDefault: paymentMethods.length === 0,
      });

      if (response.success && response.data) {
        setPaymentMethods(prev => [...prev, mapSavedMethod(response.data!)]);
      } else {
        const providerLabel = MOBILE_MONEY_PROVIDERS.find(p => p.value === mobileMoneyForm.provider)?.label || 'Mobile Money';
        setPaymentMethods(prev => [...prev, {
          id: Date.now().toString(),
          type: 'mobile',
          name: providerLabel,
          phone: mobileMoneyForm.phone,
          provider: mobileMoneyForm.provider,
          isDefault: prev.length === 0,
          icon: 'phone-android',
        }]);
      }

      setIsAddMobileMoneyVisible(false);
      setMobileMoneyForm({ phone: '', provider: 'orange_money', accountName: '' });
      Alert.alert('Success', 'Mobile money account added!');
    } catch (error) {
      Alert.alert('Error', 'Failed to add mobile money. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const renderHeader = (): React.ReactNode => (
    <View style={styles.header}>
      <TouchableOpacity onPress={() => navigation.goBack()}>
        <Icon name="arrow-back" size={24} color={colors.text.primary} />
      </TouchableOpacity>
      <Text style={styles.headerTitle}>Payment Methods</Text>
      <TouchableOpacity onPress={() => setIsAddCardModalVisible(true)}>
        <Icon name="add" size={24} color={colors.primary} />
      </TouchableOpacity>
    </View>
  );

  const renderPaymentMethod = (method: PaymentMethod): React.ReactNode => (
    <View key={method.id} style={styles.paymentMethodCard}>
      <View style={styles.paymentMethodInfo}>
        <View style={styles.paymentMethodIcon}>
          <Icon name={method.icon} size={24} color={colors.primary} />
        </View>
        <View style={styles.paymentMethodDetails}>
          <View style={styles.paymentMethodHeader}>
            <Text style={styles.paymentMethodName}>{method.name}</Text>
            {method.isDefault && (
              <View style={styles.defaultBadge}>
                <Text style={styles.defaultBadgeText}>Default</Text>
              </View>
            )}
          </View>
          {method.last4 && (
            <Text style={styles.paymentMethodSubtitle}>
              •••• •••• •••• {method.last4}
            </Text>
          )}
          {method.phone && (
            <Text style={styles.paymentMethodSubtitle}>
              {method.phone}
            </Text>
          )}
          {method.expiryDate && (
            <Text style={styles.paymentMethodExpiry}>
              Expires {method.expiryDate}
            </Text>
          )}
        </View>
      </View>
      
      <View style={styles.paymentMethodActions}>
        {!method.isDefault && (
          <TouchableOpacity
            onPress={() => handleSetDefault(method.id)}
            style={styles.actionButton}
          >
            <Text style={styles.actionButtonText}>Set Default</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          onPress={() => handleDeletePaymentMethod(method.id, method.name)}
          style={[styles.actionButton, styles.deleteButton]}
        >
          <Icon name="delete" size={20} color={colors.error} />
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderAddCardModal = (): React.ReactNode => (
    <Modal
      visible={isAddCardModalVisible}
      animationType="slide"
      presentationStyle="pageSheet"
    >
      <SafeAreaView style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={() => setIsAddCardModalVisible(false)}>
            <Icon name="close" size={24} color={colors.text.primary} />
          </TouchableOpacity>
          <Text style={styles.modalTitle}>Add New Card</Text>
          <TouchableOpacity onPress={handleAddCard}>
            <Text style={styles.modalSaveButton}>Save</Text>
          </TouchableOpacity>
        </View>
        
        <ScrollView style={styles.modalContent}>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Card Number</Text>
            <TextInput
              style={styles.input}
              value={cardFormData.cardNumber}
              onChangeText={(value) => setCardFormData(prev => ({ ...prev, cardNumber: value }))}
              placeholder="1234 5678 9012 3456"
              keyboardType="numeric"
              maxLength={19}
            />
          </View>

          <View style={styles.rowInputs}>
            <View style={[styles.inputGroup, { flex: 1, marginRight: 10 }]}>
              <Text style={styles.label}>Expiry Date</Text>
              <TextInput
                style={styles.input}
                value={cardFormData.expiryDate}
                onChangeText={(value) => setCardFormData(prev => ({ ...prev, expiryDate: value }))}
                placeholder="MM/YY"
                keyboardType="numeric"
                maxLength={5}
              />
            </View>

            <View style={[styles.inputGroup, { flex: 1, marginLeft: 10 }]}>
              <Text style={styles.label}>CVV</Text>
              <TextInput
                style={styles.input}
                value={cardFormData.cvv}
                onChangeText={(value) => setCardFormData(prev => ({ ...prev, cvv: value }))}
                placeholder="123"
                keyboardType="numeric"
                maxLength={3}
                secureTextEntry
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Cardholder Name</Text>
            <TextInput
              style={styles.input}
              value={cardFormData.cardholderName}
              onChangeText={(value) => setCardFormData(prev => ({ ...prev, cardholderName: value }))}
              placeholder="John Doe"
              autoCapitalize="words"
            />
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );

  const renderAddOptions = (): React.ReactNode => (
    <View style={styles.addOptions}>
      <TouchableOpacity
        style={styles.addOptionCard}
        onPress={() => setIsAddCardModalVisible(true)}
      >
        <Icon name="credit-card" size={32} color={colors.primary} />
        <Text style={styles.addOptionTitle}>Add Credit/Debit Card</Text>
        <Text style={styles.addOptionSubtitle}>Visa, Mastercard, etc.</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.addOptionCard}
        onPress={() => setIsAddMobileMoneyVisible(true)}
      >
        <Icon name="phone-android" size={32} color={colors.primary} />
        <Text style={styles.addOptionTitle}>Add Mobile Money</Text>
        <Text style={styles.addOptionSubtitle}>Orange Money, M-Pesa, MTN MoMo, FNB eWallet</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      {renderHeader()}
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {paymentMethods.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Your Payment Methods</Text>
            {paymentMethods.map(renderPaymentMethod)}
          </View>
        )}
        
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Add New Payment Method</Text>
          {renderAddOptions()}
        </View>
      </ScrollView>
      {renderAddCardModal()}

      {/* Add Mobile Money Modal */}
      <Modal
        visible={isAddMobileMoneyVisible}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setIsAddMobileMoneyVisible(false)}>
              <Icon name="close" size={24} color={colors.text.primary} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Add Mobile Money</Text>
            <TouchableOpacity onPress={handleAddMobileMoney} disabled={isSaving}>
              <Text style={[styles.modalSaveButton, isSaving && { opacity: 0.5 }]}>
                {isSaving ? 'Saving...' : 'Save'}
              </Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Provider</Text>
              <View style={styles.providerGrid}>
                {MOBILE_MONEY_PROVIDERS.map((provider) => (
                  <TouchableOpacity
                    key={provider.value}
                    style={[
                      styles.providerOption,
                      mobileMoneyForm.provider === provider.value && styles.providerSelected,
                    ]}
                    onPress={() => setMobileMoneyForm(prev => ({ ...prev, provider: provider.value }))}
                  >
                    <Icon
                      name={provider.icon}
                      size={22}
                      color={mobileMoneyForm.provider === provider.value ? colors.primary : colors.text.secondary}
                    />
                    <Text
                      style={[
                        styles.providerLabel,
                        mobileMoneyForm.provider === provider.value && styles.providerLabelSelected,
                      ]}
                    >
                      {provider.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Phone Number</Text>
              <TextInput
                style={styles.input}
                value={mobileMoneyForm.phone}
                onChangeText={(value) => setMobileMoneyForm(prev => ({ ...prev, phone: value }))}
                placeholder="+267 7X XXX XXX"
                keyboardType="phone-pad"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Account Name (optional)</Text>
              <TextInput
                style={styles.input}
                value={mobileMoneyForm.accountName}
                onChangeText={(value) => setMobileMoneyForm(prev => ({ ...prev, accountName: value }))}
                placeholder="Name on the account"
                autoCapitalize="words"
              />
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text.primary,
  },
  content: {
    flex: 1,
  },
  section: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text.primary,
    marginBottom: 16,
  },
  paymentMethodCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.background.secondary,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  paymentMethodInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  paymentMethodIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: colors.background.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  paymentMethodDetails: {
    flex: 1,
  },
  paymentMethodHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  paymentMethodName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text.primary,
    marginRight: 8,
  },
  defaultBadge: {
    backgroundColor: colors.success,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  defaultBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text.inverse,
  },
  paymentMethodSubtitle: {
    fontSize: 14,
    color: colors.text.secondary,
    marginBottom: 2,
  },
  paymentMethodExpiry: {
    fontSize: 12,
    color: colors.text.secondary,
  },
  paymentMethodActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: colors.background.primary,
    marginLeft: 8,
  },
  actionButtonText: {
    fontSize: 12,
    color: colors.primary,
    fontWeight: '600',
  },
  deleteButton: {
    paddingHorizontal: 8,
  },
  addOptions: {
    gap: 12,
  },
  addOptionCard: {
    backgroundColor: colors.background.secondary,
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
    borderStyle: 'dashed',
  },
  addOptionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text.primary,
    marginTop: 8,
    marginBottom: 4,
  },
  addOptionSubtitle: {
    fontSize: 14,
    color: colors.text.secondary,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text.primary,
  },
  modalSaveButton: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.primary,
  },
  modalContent: {
    flex: 1,
    padding: 20,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: 8,
  },
  input: {
    backgroundColor: colors.background.secondary,
    borderWidth: 1,
    borderColor: colors.border.light,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: colors.text.primary,
  },
  rowInputs: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  providerGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  providerOption: {
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border.light,
    backgroundColor: colors.background.secondary,
    minWidth: 100,
  },
  providerSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primary + '10',
  },
  providerLabel: {
    fontSize: 12,
    color: colors.text.secondary,
    marginTop: 4,
    textAlign: 'center',
  },
  providerLabelSelected: {
    color: colors.primary,
    fontWeight: '600',
  },
});

export default PaymentMethodsScreen;