/**
 * @fileoverview Terms & Conditions screen component
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
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { colors } from '../../theme';

interface TermsScreenProps {
  navigation: { navigate: (screen: string, params?: Record<string, unknown>) => void; goBack: () => void };
}

interface TermsSection {
  id: string;
  title: string;
  content: string;
  expanded: boolean;
}

const TermsScreen: React.FC<TermsScreenProps> = ({ navigation }) => {
  const [sections, setSections] = useState<TermsSection[]>([
    {
      id: '1',
      title: '1. Acceptance of Terms',
      content: `By accessing and using the ARYV mobile application and services, you accept and agree to be bound by the terms and provision of this agreement. If you do not agree to abide by the above, please do not use this service.

These Terms of Service constitute a legally binding agreement between you and ARYV regarding your use of our ride-sharing and courier services.`,
      expanded: false,
    },
    {
      id: '2',
      title: '2. Use License',
      content: `Permission is granted to temporarily download one copy of ARYV app for personal, non-commercial transitory viewing only. This is the grant of a license, not a transfer of title, and under this license you may not:

• Modify or copy the materials
• Use the materials for any commercial purpose or for any public display (commercial or non-commercial)
• Attempt to decompile or reverse engineer any software contained in ARYV
• Remove any copyright or other proprietary notations from the materials

This license shall automatically terminate if you violate any of these restrictions and may be terminated by ARYV at any time.`,
      expanded: false,
    },
    {
      id: '3',
      title: '3. User Accounts and Registration',
      content: `To use certain features of our service, you must register for an account. You are responsible for:

• Providing accurate, current, and complete information during registration
• Maintaining the security of your password and account
• All activities that occur under your account
• Notifying us immediately of any unauthorized use of your account

You must be at least 18 years old to create an account and use our services.`,
      expanded: false,
    },
    {
      id: '4',
      title: '4. Ride-Sharing Services',
      content: `ARYV provides a platform that connects passengers with drivers. Key terms for ride-sharing:

• Drivers are independent contractors, not employees of ARYV
• All rides are subject to driver acceptance
• Payment is processed through our secure payment system
• Cancellation policies apply as outlined in the app
• Both drivers and passengers must comply with safety guidelines
• Ratings and reviews help maintain service quality

ARYV reserves the right to suspend or terminate accounts that violate community guidelines.`,
      expanded: false,
    },
    {
      id: '5',
      title: '5. Courier and Package Delivery',
      content: `Our courier service allows users to send packages with the following terms:

• All packages must comply with prohibited items list
• Users are responsible for accurate package descriptions
• Insurance options are available for valuable items
• Delivery timeframes are estimates, not guarantees
• Photo confirmation required for package handoffs
• Disputes are resolved through our mediation process

ARYV is not liable for packages that are incorrectly described or contain prohibited items.`,
      expanded: false,
    },
    {
      id: '6',
      title: '6. Payment Terms',
      content: `By using our payment processing services, you agree to:

• Provide valid payment information
• Pay all charges incurred through your account
• Accept dynamic pricing during peak hours
• Understand that refunds are subject to our refund policy
• Allow ARYV to charge your default payment method

All payments are processed securely through encrypted channels.`,
      expanded: false,
    },
    {
      id: '7',
      title: '7. Privacy and Data Protection',
      content: `Your privacy is important to us. Our Privacy Policy explains:

• What information we collect and why
• How we use and share your information
• Your rights regarding your personal data
• Security measures we implement
• How to contact us about privacy concerns

By using our services, you consent to our collection and use of information as outlined in our Privacy Policy.`,
      expanded: false,
    },
    {
      id: '8',
      title: '8. Prohibited Uses',
      content: `You may not use our service:

• For any unlawful purpose or to solicit others to perform unlawful acts
• To violate any international, federal, provincial, or state regulations, rules, laws, or local ordinances
• To infringe upon or violate our intellectual property rights or the intellectual property rights of others
• To harass, abuse, insult, harm, defame, slander, disparage, intimidate, or discriminate
• To submit false or misleading information
• To upload or transmit viruses or any other type of malicious code`,
      expanded: false,
    },
    {
      id: '9',
      title: '9. Disclaimer',
      content: `The information on this app is provided on an 'as is' basis. To the fullest extent permitted by law, ARYV:

• Excludes all representations and warranties relating to this app and its contents
• Does not guarantee the accuracy, completeness, or timeliness of information
• Is not responsible for any losses arising from the use of this app
• Does not guarantee uninterrupted service availability

Use of our services is at your own risk.`,
      expanded: false,
    },
    {
      id: '10',
      title: '10. Limitations',
      content: `In no event shall ARYV or its suppliers be liable for any damages (including, without limitation, damages for loss of data or profit, or due to business interruption) arising out of the use or inability to use the materials on ARYV, even if ARYV or a ARYV authorized representative has been notified orally or in writing of the possibility of such damage.

Some jurisdictions do not allow limitations on implied warranties, or limitations of liability for consequential or incidental damages, so these limitations may not apply to you.`,
      expanded: false,
    },
    {
      id: '11',
      title: '11. Terms Modifications',
      content: `ARYV may revise these terms of service at any time without notice. By using this app, you are agreeing to be bound by the then current version of these terms of service.

We will notify users of significant changes through:
• In-app notifications
• Email notifications to registered users
• Updates posted on our website

Continued use of our services after changes constitutes acceptance of new terms.`,
      expanded: false,
    },
  ]);

  const toggleSection = (id: string): void => {
    setSections(sections =>
      sections.map(section =>
        section.id === id ? { ...section, expanded: !section.expanded } : section
      )
    );
  };

  const renderHeader = (): React.ReactNode => (
    <View style={styles.header}>
      <TouchableOpacity onPress={() => navigation.goBack()}>
        <Icon name="arrow-back" size={24} color={colors.text.primary} />
      </TouchableOpacity>
      <Text style={styles.headerTitle}>Terms & Conditions</Text>
      <View style={{ width: 24 }} />
    </View>
  );

  const renderSection = (section: TermsSection): React.ReactNode => (
    <View key={section.id} style={styles.sectionContainer}>
      <TouchableOpacity
        onPress={() => toggleSection(section.id)}
        style={styles.sectionHeader}
      >
        <Text style={styles.sectionTitle}>{section.title}</Text>
        <Icon
          name={section.expanded ? 'keyboard-arrow-up' : 'keyboard-arrow-down'}
          size={24}
          color={colors.text.secondary}
        />
      </TouchableOpacity>
      {section.expanded && (
        <View style={styles.sectionContent}>
          <Text style={styles.sectionText}>{section.content}</Text>
        </View>
      )}
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      {renderHeader()}
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.introduction}>
          <Text style={styles.introTitle}>Terms of Service</Text>
          <Text style={styles.introText}>
            Last updated: January 27, 2025
          </Text>
          <Text style={styles.introDescription}>
            Please read these Terms of Service carefully before using the ARYV application. 
            These terms govern your use of our ride-sharing and courier services.
          </Text>
        </View>

        <View style={styles.sectionsContainer}>
          {sections.map(renderSection)}
        </View>

        <View style={styles.contact}>
          <Text style={styles.contactTitle}>Questions?</Text>
          <Text style={styles.contactText}>
            If you have any questions about these Terms of Service, please contact us at:
          </Text>
          <Text style={styles.contactEmail}>legal@aryv-app.com</Text>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            By continuing to use ARYV, you acknowledge that you have read, understood, 
            and agree to be bound by these Terms of Service.
          </Text>
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
  introduction: {
    padding: 20,
    backgroundColor: colors.background.secondary,
  },
  introTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.text.primary,
    marginBottom: 8,
  },
  introText: {
    fontSize: 14,
    color: colors.text.secondary,
    marginBottom: 16,
  },
  introDescription: {
    fontSize: 16,
    color: colors.text.primary,
    lineHeight: 24,
  },
  sectionsContainer: {
    padding: 20,
  },
  sectionContainer: {
    backgroundColor: colors.background.secondary,
    borderRadius: 12,
    marginBottom: 8,
    overflow: 'hidden',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text.primary,
    flex: 1,
    marginRight: 12,
  },
  sectionContent: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
  },
  sectionText: {
    fontSize: 14,
    color: colors.text.secondary,
    lineHeight: 22,
    paddingTop: 12,
  },
  contact: {
    padding: 20,
    backgroundColor: colors.background.secondary,
    marginHorizontal: 20,
    marginBottom: 20,
    borderRadius: 12,
  },
  contactTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text.primary,
    marginBottom: 8,
  },
  contactText: {
    fontSize: 14,
    color: colors.text.secondary,
    lineHeight: 20,
    marginBottom: 8,
  },
  contactEmail: {
    fontSize: 16,
    color: colors.primary,
    fontWeight: '600',
  },
  footer: {
    padding: 20,
    backgroundColor: colors.primary + '10',
    marginHorizontal: 20,
    marginBottom: 20,
    borderRadius: 12,
  },
  footerText: {
    fontSize: 14,
    color: colors.text.primary,
    lineHeight: 20,
    textAlign: 'center',
    fontStyle: 'italic',
  },
});

export default TermsScreen;