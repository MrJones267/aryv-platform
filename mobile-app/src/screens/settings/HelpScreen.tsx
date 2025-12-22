/**
 * @fileoverview Help & Support screen component
 * @author Oabona-Majoko
 * @created 2025-01-27
 * @lastModified 2025-01-27
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Linking,
  Alert,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { colors } from '../../theme';

interface HelpScreenProps {
  navigation: any;
}

interface FAQItem {
  id: string;
  question: string;
  answer: string;
  expanded: boolean;
}

interface ContactMethod {
  id: string;
  title: string;
  subtitle: string;
  icon: string;
  action: () => void;
}

const HelpScreen: React.FC<HelpScreenProps> = ({ navigation }) => {
  const [faqItems, setFaqItems] = useState<FAQItem[]>([
    {
      id: '1',
      question: 'How do I book a ride?',
      answer: 'To book a ride, go to the Home screen, tap "Find a Ride", enter your pickup and destination locations, select your preferred ride, and confirm your booking.',
      expanded: false,
    },
    {
      id: '2',
      question: 'How do I offer a ride?',
      answer: 'Tap "Offer a Ride" on the Home screen, enter your route details, set your departure time and price, then publish your ride for others to book.',
      expanded: false,
    },
    {
      id: '3',
      question: 'What payment methods are accepted?',
      answer: 'We accept credit/debit cards, mobile money (MTN, Airtel), and bank transfers. You can manage your payment methods in Settings > Payment Methods.',
      expanded: false,
    },
    {
      id: '4',
      question: 'How does the courier service work?',
      answer: 'You can send packages through our courier service. Create a package request, set pickup and delivery locations, and a verified courier will handle the delivery with real-time tracking.',
      expanded: false,
    },
    {
      id: '5',
      question: 'Is my personal information safe?',
      answer: 'Yes, we use advanced encryption and security measures to protect your data. You can control your privacy settings in Settings > Privacy Settings.',
      expanded: false,
    },
    {
      id: '6',
      question: 'How do I cancel a ride?',
      answer: 'You can cancel a ride from the "My Rides" section. Cancellation policies may apply depending on how close to departure time you cancel.',
      expanded: false,
    },
  ]);

  const contactMethods: ContactMethod[] = [
    {
      id: 'email',
      title: 'Email Support',
      subtitle: 'support@aryv-app.com',
      icon: 'email',
      action: () => handleContactMethod('email'),
    },
    {
      id: 'phone',
      title: 'Phone Support',
      subtitle: '+256 700 000 000',
      icon: 'phone',
      action: () => handleContactMethod('phone'),
    },
    {
      id: 'chat',
      title: 'Live Chat',
      subtitle: 'Chat with our support team',
      icon: 'chat',
      action: () => handleContactMethod('chat'),
    },
    {
      id: 'whatsapp',
      title: 'WhatsApp',
      subtitle: 'Message us on WhatsApp',
      icon: 'message',
      action: () => handleContactMethod('whatsapp'),
    },
  ];

  const toggleFAQ = (id: string): void => {
    setFaqItems(items =>
      items.map(item =>
        item.id === id ? { ...item, expanded: !item.expanded } : item
      )
    );
  };

  const handleContactMethod = (method: string): void => {
    switch (method) {
      case 'email':
        Linking.openURL('mailto:support@aryv-app.com?subject=Support Request')
          .catch(() => Alert.alert('Error', 'Unable to open email app'));
        break;
      case 'phone':
        Linking.openURL('tel:+256700000000')
          .catch(() => Alert.alert('Error', 'Unable to make phone call'));
        break;
      case 'chat':
        Alert.alert('Live Chat', 'Live chat feature coming soon!');
        break;
      case 'whatsapp':
        Linking.openURL('whatsapp://send?phone=256700000000&text=Hi, I need help with ARYV')
          .catch(() => {
            Linking.openURL('https://wa.me/256700000000?text=Hi, I need help with ARYV');
          });
        break;
    }
  };

  const renderHeader = (): React.ReactNode => (
    <View style={styles.header}>
      <TouchableOpacity onPress={() => navigation.goBack()}>
        <Icon name="arrow-back" size={24} color={colors.text.primary} />
      </TouchableOpacity>
      <Text style={styles.headerTitle}>Help & Support</Text>
      <View style={{ width: 24 }} />
    </View>
  );

  const renderFAQItem = (item: FAQItem): React.ReactNode => (
    <View key={item.id} style={styles.faqItem}>
      <TouchableOpacity
        onPress={() => toggleFAQ(item.id)}
        style={styles.faqQuestion}
      >
        <Text style={styles.faqQuestionText}>{item.question}</Text>
        <Icon
          name={item.expanded ? 'keyboard-arrow-up' : 'keyboard-arrow-down'}
          size={24}
          color={colors.text.secondary}
        />
      </TouchableOpacity>
      {item.expanded && (
        <View style={styles.faqAnswer}>
          <Text style={styles.faqAnswerText}>{item.answer}</Text>
        </View>
      )}
    </View>
  );

  const renderContactMethod = (method: ContactMethod): React.ReactNode => (
    <TouchableOpacity
      key={method.id}
      style={styles.contactMethod}
      onPress={method.action}
    >
      <View style={styles.contactIcon}>
        <Icon name={method.icon} size={24} color={colors.primary} />
      </View>
      <View style={styles.contactContent}>
        <Text style={styles.contactTitle}>{method.title}</Text>
        <Text style={styles.contactSubtitle}>{method.subtitle}</Text>
      </View>
      <Icon name="chevron-right" size={24} color={colors.text.secondary} />
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      {renderHeader()}
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Frequently Asked Questions</Text>
          {faqItems.map(renderFAQItem)}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Contact Support</Text>
          <Text style={styles.sectionDescription}>
            Need more help? Our support team is here to assist you.
          </Text>
          {contactMethods.map(renderContactMethod)}
        </View>

        <View style={styles.section}>
          <View style={styles.emergencyCard}>
            <View style={styles.emergencyIcon}>
              <Icon name="emergency" size={24} color={colors.error} />
            </View>
            <View style={styles.emergencyContent}>
              <Text style={styles.emergencyTitle}>Emergency Support</Text>
              <Text style={styles.emergencyDescription}>
                For urgent safety concerns during a ride
              </Text>
              <TouchableOpacity
                style={styles.emergencyButton}
                onPress={() => Linking.openURL('tel:911')}
              >
                <Text style={styles.emergencyButtonText}>Call Emergency Services</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </ScrollView>
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
  sectionDescription: {
    fontSize: 14,
    color: colors.text.secondary,
    marginBottom: 16,
    lineHeight: 20,
  },
  faqItem: {
    backgroundColor: colors.background.secondary,
    borderRadius: 12,
    marginBottom: 8,
    overflow: 'hidden',
  },
  faqQuestion: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  faqQuestionText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text.primary,
    flex: 1,
    marginRight: 12,
  },
  faqAnswer: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
  },
  faqAnswerText: {
    fontSize: 14,
    color: colors.text.secondary,
    lineHeight: 20,
    paddingTop: 12,
  },
  contactMethod: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  contactIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: colors.background.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  contactContent: {
    flex: 1,
  },
  contactTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: 2,
  },
  contactSubtitle: {
    fontSize: 14,
    color: colors.text.secondary,
  },
  emergencyCard: {
    flexDirection: 'row',
    backgroundColor: colors.error + '10',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.error + '20',
  },
  emergencyIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: colors.error + '20',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  emergencyContent: {
    flex: 1,
  },
  emergencyTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.error,
    marginBottom: 4,
  },
  emergencyDescription: {
    fontSize: 14,
    color: colors.text.secondary,
    marginBottom: 12,
    lineHeight: 18,
  },
  emergencyButton: {
    backgroundColor: colors.error,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    alignSelf: 'flex-start',
  },
  emergencyButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text.inverse,
  },
});

export default HelpScreen;