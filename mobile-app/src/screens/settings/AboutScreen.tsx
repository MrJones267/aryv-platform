/**
 * @fileoverview About app screen component
 * @author Oabona-Majoko
 * @created 2025-01-27
 * @lastModified 2025-01-27
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Linking,
  Image,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { colors } from '../../theme';

interface AboutScreenProps {
  navigation: any;
}

interface LinkItem {
  id: string;
  title: string;
  subtitle: string;
  icon: string;
  url: string;
}

const AboutScreen: React.FC<AboutScreenProps> = ({ navigation }) => {
  const appVersion = '1.0.0';
  const buildNumber = '100';
  
  const socialLinks: LinkItem[] = [
    {
      id: 'website',
      title: 'Website',
      subtitle: 'Visit our official website',
      icon: 'public',
      url: 'https://aryv-app.com',
    },
    {
      id: 'twitter',
      title: 'Twitter',
      subtitle: 'Follow us for updates',
      icon: 'alternate-email',
      url: 'https://twitter.com/aryvapp',
    },
    {
      id: 'facebook',
      title: 'Facebook',
      subtitle: 'Like our page',
      icon: 'facebook',
      url: 'https://facebook.com/aryvapp',
    },
    {
      id: 'instagram',
      title: 'Instagram',
      subtitle: 'Follow our journey',
      icon: 'camera-alt',
      url: 'https://instagram.com/aryvapp',
    },
  ];

  const legalLinks: LinkItem[] = [
    {
      id: 'terms',
      title: 'Terms of Service',
      subtitle: 'Read our terms and conditions',
      icon: 'description',
      url: 'https://aryv-app.com/terms',
    },
    {
      id: 'privacy',
      title: 'Privacy Policy',
      subtitle: 'How we protect your data',
      icon: 'privacy-tip',
      url: 'https://aryv-app.com/privacy',
    },
    {
      id: 'licenses',
      title: 'Open Source Licenses',
      subtitle: 'Third-party software licenses',
      icon: 'code',
      url: 'https://aryv-app.com/licenses',
    },
  ];

  const handleLinkPress = (url: string): void => {
    Linking.openURL(url).catch(() => {
      console.error('Failed to open URL:', url);
    });
  };

  const renderHeader = (): React.ReactNode => (
    <View style={styles.header}>
      <TouchableOpacity onPress={() => navigation.goBack()}>
        <Icon name="arrow-back" size={24} color={colors.text.primary} />
      </TouchableOpacity>
      <Text style={styles.headerTitle}>About</Text>
      <View style={{ width: 24 }} />
    </View>
  );

  const renderAppInfo = (): React.ReactNode => (
    <View style={styles.appInfo}>
      <View style={styles.appIcon}>
        <Icon name="directions-car" size={40} color={colors.primary} />
      </View>
      <Text style={styles.appName}>ARYV</Text>
      <Text style={styles.appTagline}>Ride sharing made simple</Text>
      <View style={styles.versionInfo}>
        <Text style={styles.versionText}>Version {appVersion} ({buildNumber})</Text>
      </View>
    </View>
  );

  const renderDescription = (): React.ReactNode => (
    <View style={styles.section}>
      <Text style={styles.descriptionText}>
        ARYV is a comprehensive ride-sharing platform that connects passengers and drivers, 
        making transportation affordable, convenient, and sustainable. Our integrated courier 
        service also allows you to send packages quickly and securely.
      </Text>
      <Text style={styles.descriptionText}>
        Built with modern technology and a focus on safety, ARYV is transforming how people 
        move around and send items in their communities.
      </Text>
    </View>
  );

  const renderFeatures = (): React.ReactNode => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Key Features</Text>
      <View style={styles.featuresList}>
        {[
          'Find and offer rides instantly',
          'Real-time GPS tracking',
          'Secure payment system',
          'Package delivery service',
          'In-app messaging',
          'Safety features and ratings',
        ].map((feature, index) => (
          <View key={index} style={styles.featureItem}>
            <Icon name="check-circle" size={16} color={colors.success} />
            <Text style={styles.featureText}>{feature}</Text>
          </View>
        ))}
      </View>
    </View>
  );

  const renderLinkSection = (title: string, links: LinkItem[]): React.ReactNode => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {links.map(link => (
        <TouchableOpacity
          key={link.id}
          style={styles.linkItem}
          onPress={() => handleLinkPress(link.url)}
        >
          <View style={styles.linkIcon}>
            <Icon name={link.icon} size={24} color={colors.primary} />
          </View>
          <View style={styles.linkContent}>
            <Text style={styles.linkTitle}>{link.title}</Text>
            <Text style={styles.linkSubtitle}>{link.subtitle}</Text>
          </View>
          <Icon name="open-in-new" size={20} color={colors.text.secondary} />
        </TouchableOpacity>
      ))}
    </View>
  );

  const renderCredits = (): React.ReactNode => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Credits</Text>
      <Text style={styles.creditsText}>
        Made with ❤️ by the ARYV team
      </Text>
      <Text style={styles.creditsText}>
        Special thanks to our community of riders and drivers who make ARYV possible.
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      {renderHeader()}
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {renderAppInfo()}
        {renderDescription()}
        {renderFeatures()}
        {renderLinkSection('Connect With Us', socialLinks)}
        {renderLinkSection('Legal', legalLinks)}
        {renderCredits()}
        
        <View style={styles.footer}>
          <Text style={styles.copyrightText}>
            © 2025 ARYV. All rights reserved.
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
  appInfo: {
    alignItems: 'center',
    paddingVertical: 40,
    backgroundColor: colors.background.secondary,
  },
  appIcon: {
    width: 80,
    height: 80,
    borderRadius: 20,
    backgroundColor: colors.background.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  appName: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.text.primary,
    marginBottom: 8,
  },
  appTagline: {
    fontSize: 16,
    color: colors.text.secondary,
    marginBottom: 16,
  },
  versionInfo: {
    backgroundColor: colors.background.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  versionText: {
    fontSize: 14,
    color: colors.text.secondary,
    fontWeight: '500',
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
  descriptionText: {
    fontSize: 16,
    color: colors.text.secondary,
    lineHeight: 24,
    marginBottom: 16,
  },
  featuresList: {
    gap: 12,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
  },
  featureText: {
    fontSize: 16,
    color: colors.text.primary,
    marginLeft: 12,
  },
  linkItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  linkIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.background.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  linkContent: {
    flex: 1,
  },
  linkTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: 2,
  },
  linkSubtitle: {
    fontSize: 14,
    color: colors.text.secondary,
  },
  creditsText: {
    fontSize: 16,
    color: colors.text.secondary,
    lineHeight: 24,
    marginBottom: 12,
    textAlign: 'center',
  },
  footer: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  copyrightText: {
    fontSize: 14,
    color: colors.text.secondary,
  },
});

export default AboutScreen;