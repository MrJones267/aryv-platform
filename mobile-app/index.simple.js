/**
 * Simple React Native entry point for testing
 */

import {AppRegistry, Text, View} from 'react-native';
import React from 'react';

const SimpleApp = () => (
  <View style={{flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#2196F3'}}>
    <Text style={{fontSize: 48, color: 'white', fontWeight: 'bold'}}>ARYV</Text>
    <Text style={{fontSize: 18, color: 'white', marginTop: 10}}>Mobile App Working!</Text>
  </View>
);

AppRegistry.registerComponent('aryv-mobile', () => SimpleApp);