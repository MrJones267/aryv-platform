/**
 * @fileoverview Tests for Button component
 * @author Oabona-Majoko
 * @created 2025-01-21
 * @lastModified 2025-01-21
 */

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { Button } from '../Button';

describe('Button Component', () => {
  const mockOnPress = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Basic Rendering', () => {
    it('renders with title', () => {
      const { getByText } = render(
        <Button title="Test Button" onPress={mockOnPress} />
      );
      
      expect(getByText('Test Button')).toBeTruthy();
    });

    it('renders with different variants', () => {
      const variants = ['primary', 'secondary', 'outline', 'ghost', 'danger'] as const;
      
      variants.forEach(variant => {
        const { getByText } = render(
          <Button 
            title={`${variant} button`} 
            onPress={mockOnPress} 
            variant={variant}
            testID={`button-${variant}`}
          />
        );
        
        expect(getByText(`${variant} button`)).toBeTruthy();
      });
    });

    it('renders with different sizes', () => {
      const sizes = ['small', 'medium', 'large'] as const;
      
      sizes.forEach(size => {
        const { getByText } = render(
          <Button 
            title={`${size} button`} 
            onPress={mockOnPress} 
            size={size}
            testID={`button-${size}`}
          />
        );
        
        expect(getByText(`${size} button`)).toBeTruthy();
      });
    });
  });

  describe('Props and States', () => {
    it('handles onPress correctly', () => {
      const { getByText } = render(
        <Button title="Clickable" onPress={mockOnPress} />
      );
      
      fireEvent.press(getByText('Clickable'));
      expect(mockOnPress).toHaveBeenCalledTimes(1);
    });

    it('does not call onPress when disabled', () => {
      const { getByText } = render(
        <Button title="Disabled" onPress={mockOnPress} disabled />
      );
      
      fireEvent.press(getByText('Disabled'));
      expect(mockOnPress).not.toHaveBeenCalled();
    });

    it('shows loading state', () => {
      const { getByText } = render(
        <Button title="Submit" onPress={mockOnPress} loading />
      );
      
      expect(getByText('Loading...')).toBeTruthy();
    });

    it('does not call onPress when loading', () => {
      const { getByText } = render(
        <Button title="Submit" onPress={mockOnPress} loading />
      );
      
      fireEvent.press(getByText('Loading...'));
      expect(mockOnPress).not.toHaveBeenCalled();
    });

    it('renders with icon on left', () => {
      const { getByTestId } = render(
        <Button 
          title="With Icon" 
          onPress={mockOnPress} 
          icon="add"
          testID="icon-button"
        />
      );
      
      expect(getByTestId('icon-button')).toBeTruthy();
    });

    it('renders with icon on right', () => {
      const { getByTestId } = render(
        <Button 
          title="With Icon" 
          onPress={mockOnPress} 
          icon="arrow-forward"
          iconPosition="right"
          testID="icon-right-button"
        />
      );
      
      expect(getByTestId('icon-right-button')).toBeTruthy();
    });

    it('renders full width', () => {
      const { getByTestId } = render(
        <Button 
          title="Full Width" 
          onPress={mockOnPress} 
          fullWidth
          testID="full-width-button"
        />
      );
      
      expect(getByTestId('full-width-button')).toBeTruthy();
    });
  });

  describe('Accessibility', () => {
    it('has correct accessibility properties', () => {
      const { getByRole } = render(
        <Button title="Accessible Button" onPress={mockOnPress} />
      );
      
      const button = getByRole('button');
      expect(button).toBeTruthy();
      expect(button.props.accessible).toBe(true);
    });

    it('has disabled accessibility state when disabled', () => {
      const { getByRole } = render(
        <Button title="Disabled Button" onPress={mockOnPress} disabled />
      );
      
      const button = getByRole('button');
      expect(button.props.accessibilityState?.disabled).toBe(true);
    });
  });

  describe('Custom Styles', () => {
    it('applies custom styles', () => {
      const customStyle = { marginTop: 20 };
      const customTextStyle = { fontSize: 18 };
      
      const { getByTestId } = render(
        <Button 
          title="Custom Style" 
          onPress={mockOnPress}
          style={customStyle}
          textStyle={customTextStyle}
          testID="custom-style-button"
        />
      );
      
      expect(getByTestId('custom-style-button')).toBeTruthy();
    });
  });

  describe('Edge Cases', () => {
    it('handles empty title gracefully', () => {
      const { getByTestId } = render(
        <Button 
          title="" 
          onPress={mockOnPress} 
          testID="empty-title-button"
        />
      );
      
      expect(getByTestId('empty-title-button')).toBeTruthy();
    });

    it('handles very long titles', () => {
      const longTitle = 'This is a very long button title that might overflow';
      const { getByText } = render(
        <Button title={longTitle} onPress={mockOnPress} />
      );
      
      expect(getByText(longTitle)).toBeTruthy();
    });

    it('handles rapid taps gracefully', () => {
      const { getByText } = render(
        <Button title="Rapid Tap" onPress={mockOnPress} />
      );
      
      const button = getByText('Rapid Tap');
      
      // Simulate rapid taps
      fireEvent.press(button);
      fireEvent.press(button);
      fireEvent.press(button);
      
      expect(mockOnPress).toHaveBeenCalledTimes(3);
    });
  });
});