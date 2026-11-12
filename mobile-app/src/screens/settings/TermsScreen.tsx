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
  // The same terms as aryv-app.com/terms. The earlier text promised a payment
  // system, insurance and photo confirmation the app does not have.
  const [sections, setSections] = useState<TermsSection[]>([
    {
      id: '1',
      title: '1. What ARYV is',
      content: `ARYV is a platform that puts people in touch: passengers with drivers who are making a trip, and people sending a package with couriers who can carry it.

ARYV does not provide transport or delivery itself. Drivers and couriers are independent users of the platform, not employees or agents of ARYV, and the trip or delivery is an arrangement between the users who agree to it.

By creating an account or using ARYV you agree to these terms.`,
      expanded: false,
    },
    {
      id: '2',
      title: '2. Your account',
      content: `• You must be at least 18 years old
• Give accurate, current information and keep it up to date
• Keep your password safe; you are responsible for what happens under your account
• Tell us straight away if you think someone else has used your account
• One person, one account. Do not let someone else drive or deliver under yours`,
      expanded: false,
    },
    {
      id: '3',
      title: '3. Rides',
      content: `• To offer rides you need a valid driving licence, a roadworthy, registered and insured vehicle, and documents approved by ARYV
• Every booking is a request until the driver accepts it. Drivers may decline
• The driver sets the price per seat. The price shown when you book is the price you pay
• Either side may cancel a booking before the ride. Please cancel as early as you can
• Drivers must follow the road traffic laws and carry no more passengers than the vehicle is licensed for
• Ratings must be honest`,
      expanded: false,
    },
    {
      id: '4',
      title: '4. Package delivery',
      content: `• The sender describes the package and names the price. A courier who accepts agrees to deliver it for that price
• Describe the package accurately. Do not send anything illegal, dangerous or stolen, and do not send cash or items you cannot afford to lose
• When the courier collects the package, the recipient is sent a delivery code. The delivery is complete when the courier enters it. Only give the code once you have the package
• Delivery times are estimates, not guarantees
• ARYV does not insure packages. A package is carried at the risk of the sender and the courier
• Either side can report a problem with a delivery. ARYV reviews it and records an outcome`,
      expanded: false,
    },
    {
      id: '5',
      title: '5. Payment and commission',
      content: `• Rides and deliveries are paid in cash, directly between users. ARYV does not hold or transfer this money
• Both sides confirm a cash payment in the app so each has a record
• ARYV charges drivers and couriers a commission on what they earn through the platform. The app shows the amount owed
• An account that owes more than its limit cannot take new cash work until it is settled
• Promotional discounts are applied when you book and cannot be exchanged for cash`,
      expanded: false,
    },
    {
      id: '6',
      title: '6. How you must behave',
      content: `You must not:
• Use ARYV for anything unlawful
• Harass, threaten, discriminate against or endanger another user
• Give false information, impersonate someone, or submit documents that are not yours
• Arrange a trip or delivery through ARYV and complete it outside the app to avoid commission
• Manipulate ratings, promotions or disputes
• Interfere with the app, access other users' data, or copy or reverse engineer the software`,
      expanded: false,
    },
    {
      id: '7',
      title: '7. Safety',
      content: `ARYV checks drivers' and couriers' documents and provides safety tools such as the pickup PIN, trip photos, emergency alerts, blocking and reporting. These reduce risk; they do not remove it.

Use your own judgment about who you travel with and what you carry. In an emergency, contact the emergency services first.`,
      expanded: false,
    },
    {
      id: '8',
      title: '8. Suspension and closing accounts',
      content: `We may suspend or close an account that breaks these terms, puts other users at risk, or owes commission that is not settled. When an account is suspended, its upcoming rides and bookings are cancelled and the people affected are told.

You may delete your own account at any time under Settings, Privacy.`,
      expanded: false,
    },
    {
      id: '9',
      title: '9. Privacy',
      content: `Our Privacy Policy explains what information we collect, how we use and share it, how long we keep it, and your rights. A trip's chat is deleted 24 hours after the trip is completed, unless the people in it vote to keep it.

Read it at aryv-app.com/privacy.`,
      expanded: false,
    },
    {
      id: '10',
      title: '10. Our responsibility to you',
      content: `ARYV is provided "as is". To the fullest extent the law allows:
• We do not guarantee that a ride or courier will be available, or that a trip or delivery will be completed
• We are not responsible for the acts or omissions of other users, including drivers and couriers
• We are not liable for indirect loss, or for loss of or damage to a package

Nothing in these terms limits liability that cannot be limited by law, or takes away your rights under consumer protection law.`,
      expanded: false,
    },
    {
      id: '11',
      title: '11. Changes and governing law',
      content: `We may update these terms. We will post the new version at aryv-app.com/terms, and for significant changes we will tell you in the app or by email before they take effect.

These terms are governed by the laws of the Republic of Botswana.

Contact: hello@aryv-app.com, or ARYV, Box 440, Masunga, Botswana.`,
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
            Last updated: 10 November 2026
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
          <Text style={styles.contactEmail}>privacy@aryv-app.com</Text>
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