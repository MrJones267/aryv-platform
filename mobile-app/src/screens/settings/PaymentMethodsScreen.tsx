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

interface PaymentMethodsScreenProps {
  navigation: any;
}

interface PaymentMethod {
  id: string;
  type: 'card' | 'bank' | 'mobile';
  name: string;
  last4?: string;
  expiryDate?: string;
  isDefault: boolean;
  icon: string;
}

interface AddCardFormData {
  cardNumber: string;
  expiryDate: string;
  cvv: string;
  cardholderName: string;
}

const PaymentMethodsScreen: React.FC<PaymentMethodsScreenProps> = ({ navigation }) => {
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([
    {
      id: '1',
      type: 'card',
      name: 'Visa',
      last4: '4242',
      expiryDate: '12/25',
      isDefault: true,
      icon: 'credit-card',
    },
    {
      id: '2',
      type: 'mobile',
      name: 'Mobile Money',
      isDefault: false,
      icon: 'phone-android',
    },
  ]);

  const [isAddCardModalVisible, setIsAddCardModalVisible] = useState(false);
  const [cardFormData, setCardFormData] = useState<AddCardFormData>({
    cardNumber: '',
    expiryDate: '',
    cvv: '',
    cardholderName: '',
  });

  const handleSetDefault = (id: string): void => {
    setPaymentMethods(methods =>
      methods.map(method => ({
        ...method,
        isDefault: method.id === id,
      }))
    );
    Alert.alert('Success', 'Default payment method updated.');
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
          onPress: () => {
            setPaymentMethods(methods => methods.filter(method => method.id !== id));
          },
        },
      ]
    );
  };

  const handleAddCard = (): void => {
    if (!cardFormData.cardNumber || !cardFormData.expiryDate || 
        !cardFormData.cvv || !cardFormData.cardholderName) {
      Alert.alert('Error', 'Please fill in all fields.');
      return;
    }

    const newCard: PaymentMethod = {
      id: Date.now().toString(),
      type: 'card',
      name: 'New Card',
      last4: cardFormData.cardNumber.slice(-4),
      expiryDate: cardFormData.expiryDate,
      isDefault: paymentMethods.length === 0,
      icon: 'credit-card',
    };

    setPaymentMethods([...paymentMethods, newCard]);
    setIsAddCardModalVisible(false);
    setCardFormData({
      cardNumber: '',
      expiryDate: '',
      cvv: '',
      cardholderName: '',
    });
    Alert.alert('Success', 'Card added successfully!');
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

      <TouchableOpacity style={styles.addOptionCard}>
        <Icon name="phone-android" size={32} color={colors.primary} />
        <Text style={styles.addOptionTitle}>Add Mobile Money</Text>
        <Text style={styles.addOptionSubtitle}>MTN, Airtel, etc.</Text>
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
});

export default PaymentMethodsScreen;