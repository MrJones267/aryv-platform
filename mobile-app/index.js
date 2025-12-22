/**
 * @format
 * React Native entry point for ARYV mobile app
 */

import {AppRegistry} from 'react-native';
import App from './src/App';

// Register with the name expected by Android MainActivity
AppRegistry.registerComponent('aryv-mobile', () => App);