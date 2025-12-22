/**
 * @fileoverview Revenue Analytics Dashboard Screen
 * @author Oabona-Majoko
 * @created 2025-01-25
 * @lastModified 2025-01-25
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PieChart, LineChart, BarChart } from 'react-native-chart-kit';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { colors, spacing, typography } from '../theme';

const { width: screenWidth } = Dimensions.get('window');
const chartWidth = screenWidth - (spacing.md * 2);

interface RevenueData {
  totalRevenue: number;
  commissionRevenue: number;
  subscriptionRevenue: number;
  serviceFeesRevenue: number;
  financialServicesRevenue: number;
  advertisingRevenue: number;
  growthRate: number;
  period: string;
}

interface MetricCard {
  title: string;
  value: string;
  change: number;
  icon: string;
  color: string;
}

export const RevenueAnalyticsScreen: React.FC = () => {
  const [selectedPeriod, setSelectedPeriod] = useState<'day' | 'week' | 'month' | 'year'>('month');
  const [revenueData, setRevenueData] = useState<RevenueData | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadRevenueData();
  }, [selectedPeriod]);

  const loadRevenueData = async () => {
    setLoading(true);
    try {
      // Simulate API call - in production, this would fetch real data
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Mock revenue data based on our model
      const mockData: RevenueData = {
        totalRevenue: selectedPeriod === 'month' ? 125000 : 
                     selectedPeriod === 'week' ? 31250 :
                     selectedPeriod === 'day' ? 4464 : 1500000,
        commissionRevenue: 0, // Will be calculated
        subscriptionRevenue: 0,
        serviceFeesRevenue: 0,
        financialServicesRevenue: 0,
        advertisingRevenue: 0,
        growthRate: 24.5,
        period: selectedPeriod
      };

      // Calculate breakdown based on our revenue model (70%, 15%, 10%, 3%, 2%)
      mockData.commissionRevenue = mockData.totalRevenue * 0.70;
      mockData.subscriptionRevenue = mockData.totalRevenue * 0.15;
      mockData.serviceFeesRevenue = mockData.totalRevenue * 0.10;
      mockData.financialServicesRevenue = mockData.totalRevenue * 0.03;
      mockData.advertisingRevenue = mockData.totalRevenue * 0.02;

      setRevenueData(mockData);
    } catch (error) {
      console.error('Error loading revenue data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadRevenueData();
  };

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatPercentage = (value: number): string => {
    return `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`;
  };

  const getMetricCards = (): MetricCard[] => {
    if (!revenueData) return [];

    return [
      {
        title: 'Total Revenue',
        value: formatCurrency(revenueData.totalRevenue),
        change: revenueData.growthRate,
        icon: 'trending-up',
        color: colors.success
      },
      {
        title: 'Commission Revenue',
        value: formatCurrency(revenueData.commissionRevenue),
        change: 22.3,
        icon: 'car',
        color: colors.primary
      },
      {
        title: 'Subscriptions',
        value: formatCurrency(revenueData.subscriptionRevenue),
        change: 31.7,
        icon: 'card',
        color: colors.warning
      },
      {
        title: 'Service Fees',
        value: formatCurrency(revenueData.serviceFeesRevenue),
        change: 15.8,
        icon: 'receipt',
        color: colors.info
      }
    ];
  };

  const getRevenueBreakdownData = () => {
    if (!revenueData) return [];

    return [
      {
        name: 'Commissions',
        population: revenueData.commissionRevenue,
        color: colors.primary,
        legendFontColor: colors.text.primary,
        legendFontSize: 12,
      },
      {
        name: 'Subscriptions',
        population: revenueData.subscriptionRevenue,
        color: colors.warning,
        legendFontColor: colors.text.primary,
        legendFontSize: 12,
      },
      {
        name: 'Service Fees',
        population: revenueData.serviceFeesRevenue,
        color: colors.info,
        legendFontColor: colors.text.primary,
        legendFontSize: 12,
      },
      {
        name: 'Financial Services',
        population: revenueData.financialServicesRevenue,
        color: colors.success,
        legendFontColor: colors.text.primary,
        legendFontSize: 12,
      },
      {
        name: 'Advertising',
        population: revenueData.advertisingRevenue,
        color: colors.error,
        legendFontColor: colors.text.primary,
        legendFontSize: 12,
      },
    ];
  };

  const getGrowthTrendData = () => {
    // Mock historical data for growth trend
    const periods = selectedPeriod === 'month' ? 
      ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'] :
      ['Week 1', 'Week 2', 'Week 3', 'Week 4'];

    const data = selectedPeriod === 'month' ?
      [85000, 92000, 98000, 105000, 118000, 125000] :
      [28000, 29500, 30200, 31250];

    return {
      labels: periods,
      datasets: [{
        data: data,
        color: (opacity = 1) => colors.primary + Math.round(opacity * 255).toString(16),
        strokeWidth: 3,
      }]
    };
  };

  const renderPeriodSelector = () => (
    <View style={styles.periodSelector}>
      {(['day', 'week', 'month', 'year'] as const).map((period) => (
        <TouchableOpacity
          key={period}
          style={[
            styles.periodButton,
            selectedPeriod === period && styles.periodButtonActive
          ]}
          onPress={() => setSelectedPeriod(period)}
        >
          <Text style={[
            styles.periodButtonText,
            selectedPeriod === period && styles.periodButtonTextActive
          ]}>
            {period.charAt(0).toUpperCase() + period.slice(1)}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  const renderMetricCards = () => (
    <View style={styles.metricsContainer}>
      {getMetricCards().map((metric, index) => (
        <View key={index} style={styles.metricCard}>
          <View style={styles.metricHeader}>
            <Ionicons name={metric.icon as any} size={24} color={metric.color} />
            <View style={[styles.changeIndicator, { backgroundColor: metric.change >= 0 ? colors.success : colors.error }]}>
              <Text style={styles.changeText}>{formatPercentage(metric.change)}</Text>
            </View>
          </View>
          <Text style={styles.metricValue}>{metric.value}</Text>
          <Text style={styles.metricTitle}>{metric.title}</Text>
        </View>
      ))}
    </View>
  );

  const renderRevenueBreakdown = () => (
    <View style={styles.chartContainer}>
      <Text style={styles.chartTitle}>Revenue Breakdown</Text>
      <PieChart
        data={getRevenueBreakdownData()}
        width={chartWidth}
        height={220}
        chartConfig={{
          color: (opacity = 1) => colors.primary + Math.round(opacity * 255).toString(16),
          labelColor: (opacity = 1) => colors.text + Math.round(opacity * 255).toString(16),
        }}
        accessor="population"
        backgroundColor="transparent"
        paddingLeft="15"
        absolute
      />
    </View>
  );

  const renderGrowthTrend = () => (
    <View style={styles.chartContainer}>
      <Text style={styles.chartTitle}>Revenue Growth Trend</Text>
      <LineChart
        data={getGrowthTrendData()}
        width={chartWidth}
        height={220}
        chartConfig={{
          backgroundColor: colors.surface,
          backgroundGradientFrom: colors.surface,
          backgroundGradientTo: colors.surface,
          decimalPlaces: 0,
          color: (opacity = 1) => colors.primary + Math.round(opacity * 255).toString(16),
          labelColor: (opacity = 1) => colors.textSecondary + Math.round(opacity * 255).toString(16),
          style: { borderRadius: 12 },
          propsForDots: {
            r: "6",
            strokeWidth: "2",
            stroke: colors.primary
          }
        }}
        bezier
        style={styles.chart}
        withInnerLines={false}
        withOuterLines={false}
        withVerticalLabels={true}
        withHorizontalLabels={true}
      />
    </View>
  );

  const renderCommissionBreakdown = () => {
    const commissionData = {
      labels: ['Standard', 'Premium', 'Group', 'Delivery'],
      datasets: [{
        data: [45, 25, 20, 10] // Percentage breakdown
      }]
    };

    return (
      <View style={styles.chartContainer}>
        <Text style={styles.chartTitle}>Commission Revenue by Type</Text>
        <BarChart
          data={commissionData}
          width={chartWidth}
          height={220}
          yAxisLabel="$"
          chartConfig={{
            backgroundColor: colors.surface,
            backgroundGradientFrom: colors.surface,
            backgroundGradientTo: colors.surface,
            decimalPlaces: 0,
            color: (opacity = 1) => colors.primary + Math.round(opacity * 255).toString(16),
            labelColor: (opacity = 1) => colors.textSecondary + Math.round(opacity * 255).toString(16),
            style: { borderRadius: 12 },
          }}
          style={styles.chart}
          yAxisSuffix="%"
          withInnerLines={false}
          showValuesOnTopOfBars={true}
        />
      </View>
    );
  };

  const renderRevenueProjections = () => (
    <View style={styles.projectionContainer}>
      <Text style={styles.sectionTitle}>Revenue Projections</Text>
      
      <View style={styles.projectionGrid}>
        <View style={styles.projectionCard}>
          <Text style={styles.projectionTitle}>Next Month</Text>
          <Text style={styles.projectionValue}>$145K</Text>
          <Text style={styles.projectionGrowth}>+16% growth</Text>
        </View>
        
        <View style={styles.projectionCard}>
          <Text style={styles.projectionTitle}>Next Quarter</Text>
          <Text style={styles.projectionValue}>$425K</Text>
          <Text style={styles.projectionGrowth}>+22% growth</Text>
        </View>
        
        <View style={styles.projectionCard}>
          <Text style={styles.projectionTitle}>Annual Target</Text>
          <Text style={styles.projectionValue}>$1.8M</Text>
          <Text style={styles.projectionGrowth}>+28% growth</Text>
        </View>
      </View>
    </View>
  );

  const renderKeyMetrics = () => (
    <View style={styles.keyMetricsContainer}>
      <Text style={styles.sectionTitle}>Key Performance Indicators</Text>
      
      <View style={styles.kpiGrid}>
        <View style={styles.kpiCard}>
          <MaterialIcons name="trending-up" size={32} color={colors.success} />
          <Text style={styles.kpiTitle}>Average Order Value</Text>
          <Text style={styles.kpiValue}>$28.50</Text>
          <Text style={styles.kpiChange}>+8.2%</Text>
        </View>
        
        <View style={styles.kpiCard}>
          <MaterialIcons name="people" size={32} color={colors.primary} />
          <Text style={styles.kpiTitle}>Monthly Active Users</Text>
          <Text style={styles.kpiValue}>15.2K</Text>
          <Text style={styles.kpiChange}>+12.5%</Text>
        </View>
        
        <View style={styles.kpiCard}>
          <MaterialIcons name="attach-money" size={32} color={colors.warning} />
          <Text style={styles.kpiTitle}>Revenue per User</Text>
          <Text style={styles.kpiValue}>$8.22</Text>
          <Text style={styles.kpiChange}>+5.1%</Text>
        </View>
        
        <View style={styles.kpiCard}>
          <MaterialIcons name="speed" size={32} color={colors.info} />
          <Text style={styles.kpiTitle}>Commission Rate</Text>
          <Text style={styles.kpiValue}>17.5%</Text>
          <Text style={styles.kpiChange}>+0.2%</Text>
        </View>
      </View>
    </View>
  );

  if (loading && !revenueData) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading revenue analytics...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Revenue Analytics</Text>
        <TouchableOpacity onPress={handleRefresh}>
          <Ionicons name="refresh" size={24} color={colors.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
        showsVerticalScrollIndicator={false}
      >
        {renderPeriodSelector()}
        {renderMetricCards()}
        {renderRevenueBreakdown()}
        {renderGrowthTrend()}
        {renderCommissionBreakdown()}
        {renderRevenueProjections()}
        {renderKeyMetrics()}
        
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Data updated {new Date().toLocaleString()}
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
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
    backgroundColor: colors.surface,
  },
  headerTitle: {
    fontSize: typography.fontSize.title,
    color: colors.text.primary,
  },
  content: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: typography.fontSize.body,
    color: colors.textSecondary,
  },
  periodSelector: {
    flexDirection: 'row',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    justifyContent: 'space-around',
  },
  periodButton: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: 20,
    backgroundColor: colors.surface,
    minWidth: 70,
    alignItems: 'center',
  },
  periodButtonActive: {
    backgroundColor: colors.primary,
  },
  periodButtonText: {
    fontSize: typography.fontSize.caption,
    color: colors.text.primary,
    fontWeight: '600',
  },
  periodButtonTextActive: {
    color: colors.white,
  },
  metricsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: spacing.md,
    marginBottom: spacing.lg,
  },
  metricCard: {
    width: '48%',
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.sm,
    marginHorizontal: '1%',
  },
  metricHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  changeIndicator: {
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderRadius: 8,
  },
  changeText: {
    fontSize: 10,
    color: colors.white,
    fontWeight: 'bold',
  },
  metricValue: {
    fontSize: typography.fontSize.title,
    fontWeight: 'bold',
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  metricTitle: {
    fontSize: typography.fontSize.caption,
    color: colors.textSecondary,
  },
  chartContainer: {
    paddingHorizontal: spacing.md,
    marginBottom: spacing.lg,
  },
  chartTitle: {
    fontSize: typography.fontSize.h3,
    color: colors.text.primary,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  chart: {
    borderRadius: 12,
  },
  sectionTitle: {
    fontSize: typography.fontSize.h3,
    color: colors.text.primary,
    marginBottom: spacing.md,
  },
  projectionContainer: {
    paddingHorizontal: spacing.md,
    marginBottom: spacing.lg,
  },
  projectionGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  projectionCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.md,
    marginHorizontal: spacing.xs,
    alignItems: 'center',
  },
  projectionTitle: {
    fontSize: typography.fontSize.caption,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  projectionValue: {
    fontSize: typography.fontSize.title,
    fontWeight: 'bold',
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  projectionGrowth: {
    fontSize: typography.fontSize.caption,
    color: colors.success,
    fontWeight: '600',
  },
  keyMetricsContainer: {
    paddingHorizontal: spacing.md,
    marginBottom: spacing.lg,
  },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  kpiCard: {
    width: '48%',
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.sm,
    alignItems: 'center',
  },
  kpiTitle: {
    fontSize: typography.fontSize.caption,
    color: colors.textSecondary,
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
    textAlign: 'center',
  },
  kpiValue: {
    fontSize: typography.fontSize.title,
    fontWeight: 'bold',
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  kpiChange: {
    fontSize: typography.fontSize.caption,
    color: colors.success,
    fontWeight: '600',
  },
  footer: {
    padding: spacing.lg,
    alignItems: 'center',
  },
  footerText: {
    fontSize: typography.fontSize.caption,
    color: colors.textSecondary,
  },
});

export default RevenueAnalyticsScreen;