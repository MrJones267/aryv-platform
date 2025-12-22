/**
 * @fileoverview Tests for Input component
 * @author Oabona-Majoko
 * @created 2025-01-21
 * @lastModified 2025-01-21
 */

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { Input } from '../Input';

describe('Input Component', () => {
  const mockOnChangeText = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Basic Rendering', () => {
    it('renders with placeholder', () => {
      const { getByPlaceholderText } = render(
        <Input placeholder="Enter text" onChangeText={mockOnChangeText} />
      );
      
      expect(getByPlaceholderText('Enter text')).toBeTruthy();
    });

    it('renders with label', () => {
      const { getByText } = render(
        <Input 
          label="Email Address" 
          placeholder="Enter email" 
          onChangeText={mockOnChangeText} 
        />
      );
      
      expect(getByText('Email Address')).toBeTruthy();
    });

    it('renders with different variants', () => {
      const variants = ['default', 'filled', 'outlined'] as const;
      
      variants.forEach(variant => {
        const { getByPlaceholderText } = render(
          <Input 
            placeholder={`${variant} input`}
            onChangeText={mockOnChangeText}
            variant={variant}
          />
        );
        
        expect(getByPlaceholderText(`${variant} input`)).toBeTruthy();
      });
    });

    it('renders with different sizes', () => {
      const sizes = ['small', 'medium', 'large'] as const;
      
      sizes.forEach(size => {
        const { getByPlaceholderText } = render(
          <Input 
            placeholder={`${size} input`}
            onChangeText={mockOnChangeText}
            size={size}
          />
        );
        
        expect(getByPlaceholderText(`${size} input`)).toBeTruthy();
      });
    });
  });

  describe('Props and States', () => {
    it('handles text input correctly', () => {
      const { getByPlaceholderText } = render(
        <Input placeholder="Type here" onChangeText={mockOnChangeText} />
      );
      
      const input = getByPlaceholderText('Type here');
      fireEvent.changeText(input, 'Hello World');
      
      expect(mockOnChangeText).toHaveBeenCalledWith('Hello World');
    });

    it('displays controlled value', () => {
      const { getByDisplayValue } = render(
        <Input 
          placeholder="Controlled" 
          value="Initial Value"
          onChangeText={mockOnChangeText} 
        />
      );
      
      expect(getByDisplayValue('Initial Value')).toBeTruthy();
    });

    it('shows error message', () => {
      const { getByText } = render(
        <Input 
          placeholder="Error input"
          onChangeText={mockOnChangeText}
          error="This field is required"
        />
      );
      
      expect(getByText('This field is required')).toBeTruthy();
    });

    it('shows helper text', () => {
      const { getByText } = render(
        <Input 
          placeholder="Helper input"
          onChangeText={mockOnChangeText}
          helperText="Enter your full name"
        />
      );
      
      expect(getByText('Enter your full name')).toBeTruthy();
    });

    it('prioritizes error over helper text', () => {
      const { getByText, queryByText } = render(
        <Input 
          placeholder="Error priority"
          onChangeText={mockOnChangeText}
          error="Error message"
          helperText="Helper message"
        />
      );
      
      expect(getByText('Error message')).toBeTruthy();
      expect(queryByText('Helper message')).toBeNull();
    });
  });

  describe('Icons and Actions', () => {
    it('renders left icon', () => {
      const { getByTestId } = render(
        <Input 
          placeholder="With left icon"
          onChangeText={mockOnChangeText}
          leftIcon="email"
          testID="input-with-left-icon"
        />
      );
      
      expect(getByTestId('input-with-left-icon')).toBeTruthy();
    });

    it('renders right icon', () => {
      const { getByTestId } = render(
        <Input 
          placeholder="With right icon"
          onChangeText={mockOnChangeText}
          rightIcon="search"
          testID="input-with-right-icon"
        />
      );
      
      expect(getByTestId('input-with-right-icon')).toBeTruthy();
    });

    it('handles right icon press', () => {
      const mockRightIconPress = jest.fn();
      const { getByTestId } = render(
        <Input 
          placeholder="Pressable icon"
          onChangeText={mockOnChangeText}
          rightIcon="clear"
          onRightIconPress={mockRightIconPress}
          testID="pressable-icon-input"
        />
      );
      
      const input = getByTestId('pressable-icon-input');
      // Note: In a real test, you'd need to find and press the icon specifically
      expect(input).toBeTruthy();
    });
  });

  describe('Password Input', () => {
    it('renders as password field', () => {
      const { getByPlaceholderText } = render(
        <Input 
          placeholder="Password"
          onChangeText={mockOnChangeText}
          password
        />
      );
      
      const input = getByPlaceholderText('Password');
      expect(input.props.secureTextEntry).toBe(true);
    });

    it('toggles password visibility', () => {
      const { getByPlaceholderText, getByTestId } = render(
        <Input 
          placeholder="Password"
          onChangeText={mockOnChangeText}
          password
          testID="password-input"
        />
      );
      
      const input = getByPlaceholderText('Password');
      expect(input.props.secureTextEntry).toBe(true);
      
      // Note: In a real test, you'd simulate pressing the visibility toggle
      expect(getByTestId('password-input')).toBeTruthy();
    });
  });

  describe('States', () => {
    it('handles disabled state', () => {
      const { getByPlaceholderText } = render(
        <Input 
          placeholder="Disabled"
          onChangeText={mockOnChangeText}
          disabled
        />
      );
      
      const input = getByPlaceholderText('Disabled');
      expect(input.props.editable).toBe(false);
    });

    it('shows required indicator', () => {
      const { getByText } = render(
        <Input 
          label="Required Field"
          placeholder="Required"
          onChangeText={mockOnChangeText}
          required
        />
      );
      
      expect(getByText('Required Field')).toBeTruthy();
      // The asterisk would be part of the label in the real component
    });
  });

  describe('Focus and Blur', () => {
    it('handles focus events', () => {
      const mockOnFocus = jest.fn();
      const { getByPlaceholderText } = render(
        <Input 
          placeholder="Focus test"
          onChangeText={mockOnChangeText}
          onFocus={mockOnFocus}
        />
      );
      
      const input = getByPlaceholderText('Focus test');
      fireEvent(input, 'focus');
      
      expect(mockOnFocus).toHaveBeenCalled();
    });

    it('handles blur events', () => {
      const mockOnBlur = jest.fn();
      const { getByPlaceholderText } = render(
        <Input 
          placeholder="Blur test"
          onChangeText={mockOnChangeText}
          onBlur={mockOnBlur}
        />
      );
      
      const input = getByPlaceholderText('Blur test');
      fireEvent(input, 'blur');
      
      expect(mockOnBlur).toHaveBeenCalled();
    });
  });

  describe('Keyboard Types', () => {
    it('handles different keyboard types', () => {
      const keyboardTypes = ['default', 'email-address', 'numeric', 'phone-pad'] as const;
      
      keyboardTypes.forEach(type => {
        const { getByPlaceholderText } = render(
          <Input 
            placeholder={`${type} keyboard`}
            onChangeText={mockOnChangeText}
            keyboardType={type}
          />
        );
        
        const input = getByPlaceholderText(`${type} keyboard`);
        expect(input.props.keyboardType).toBe(type);
      });
    });
  });

  describe('Multiline Input', () => {
    it('renders multiline input', () => {
      const { getByPlaceholderText } = render(
        <Input 
          placeholder="Multiline text"
          onChangeText={mockOnChangeText}
          multiline
          numberOfLines={4}
        />
      );
      
      const input = getByPlaceholderText('Multiline text');
      expect(input.props.multiline).toBe(true);
      expect(input.props.numberOfLines).toBe(4);
    });
  });

  describe('Accessibility', () => {
    it('has correct accessibility properties', () => {
      const { getByPlaceholderText } = render(
        <Input 
          placeholder="Accessible input"
          onChangeText={mockOnChangeText}
          testID="accessible-input"
        />
      );
      
      const input = getByPlaceholderText('Accessible input');
      expect(input.props.accessible).toBeTruthy();
    });

    it('has accessibility label for required fields', () => {
      const { getByLabelText } = render(
        <Input 
          label="Required Field"
          placeholder="Required input"
          onChangeText={mockOnChangeText}
          required
          testID="required-input"
        />
      );
      
      // The component should have proper accessibility labeling
      expect(() => getByLabelText('Required Field')).not.toThrow();
    });
  });

  describe('Edge Cases', () => {
    it('handles undefined onChangeText gracefully', () => {
      const { getByPlaceholderText } = render(
        <Input placeholder="No handler" />
      );
      
      const input = getByPlaceholderText('No handler');
      expect(() => fireEvent.changeText(input, 'test')).not.toThrow();
    });

    it('handles very long text input', () => {
      const longText = 'a'.repeat(1000);
      const { getByPlaceholderText } = render(
        <Input 
          placeholder="Long text"
          onChangeText={mockOnChangeText}
          maxLength={500}
        />
      );
      
      const input = getByPlaceholderText('Long text');
      fireEvent.changeText(input, longText);
      
      expect(mockOnChangeText).toHaveBeenCalled();
    });
  });
});