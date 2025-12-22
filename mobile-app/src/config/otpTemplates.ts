/**
 * @fileoverview OTP templates for SMS and Email notifications
 * @author Oabona-Majoko
 * @created 2025-09-07
 * @lastModified 2025-09-07
 */

export interface SMSTemplate {
  id: string;
  message: string;
  variables: string[];
}

export interface EmailTemplate {
  id: string;
  subject: string;
  html: string;
  text: string;
  variables: string[];
}

// SMS Templates for Twilio
export const SMS_TEMPLATES: Record<string, SMSTemplate> = {
  registration: {
    id: 'registration_otp',
    message: 'Welcome to Hitch! Your verification code is: {{code}}. This code will expire in {{expiry}} minutes.',
    variables: ['code', 'expiry'],
  },
  
  login: {
    id: 'login_otp',
    message: 'Your Hitch login code is: {{code}}. If you didn\'t request this, please ignore this message.',
    variables: ['code'],
  },
  
  password_reset: {
    id: 'password_reset_otp',
    message: 'Your Hitch password reset code is: {{code}}. This code will expire in {{expiry}} minutes.',
    variables: ['code', 'expiry'],
  },
  
  phone_verification: {
    id: 'phone_verification_otp',
    message: 'Your Hitch phone verification code is: {{code}}. Enter this code to verify your phone number.',
    variables: ['code'],
  },
};

// Email Templates for SendGrid
export const EMAIL_TEMPLATES: Record<string, EmailTemplate> = {
  registration: {
    id: 'registration_email_otp',
    subject: 'Welcome to Hitch - Verify Your Email',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #2196F3; margin: 0;">Hitch</h1>
        </div>
        
        <div style="background: #f8f9fa; padding: 30px; border-radius: 10px; text-align: center;">
          <h2 style="color: #333; margin-bottom: 20px;">Welcome to Hitch!</h2>
          <p style="font-size: 16px; color: #666; margin-bottom: 30px;">
            Thank you for signing up. Please verify your email address with the code below:
          </p>
          
          <div style="background: #2196F3; color: white; font-size: 32px; font-weight: bold; letter-spacing: 8px; padding: 20px; border-radius: 8px; margin: 20px 0;">
            {{code}}
          </div>
          
          <p style="font-size: 14px; color: #999; margin-top: 30px;">
            This code will expire in {{expiry}} minutes.<br>
            If you didn't create a Hitch account, please ignore this email.
          </p>
        </div>
        
        <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee;">
          <p style="font-size: 12px; color: #999;">
            © 2025 Hitch. All rights reserved.
          </p>
        </div>
      </div>
    `,
    text: 'Welcome to Hitch! Your email verification code is: {{code}}. This code will expire in {{expiry}} minutes. If you didn\'t create a Hitch account, please ignore this email.',
    variables: ['code', 'expiry'],
  },
  
  login: {
    id: 'login_email_otp',
    subject: 'Hitch Login Verification Code',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #2196F3; margin: 0;">Hitch</h1>
        </div>
        
        <div style="background: #f8f9fa; padding: 30px; border-radius: 10px; text-align: center;">
          <h2 style="color: #333; margin-bottom: 20px;">Login Verification</h2>
          <p style="font-size: 16px; color: #666; margin-bottom: 30px;">
            Use the code below to log into your Hitch account:
          </p>
          
          <div style="background: #2196F3; color: white; font-size: 32px; font-weight: bold; letter-spacing: 8px; padding: 20px; border-radius: 8px; margin: 20px 0;">
            {{code}}
          </div>
          
          <p style="font-size: 14px; color: #999; margin-top: 30px;">
            If you didn't try to log in, please secure your account immediately.
          </p>
        </div>
        
        <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee;">
          <p style="font-size: 12px; color: #999;">
            © 2025 Hitch. All rights reserved.
          </p>
        </div>
      </div>
    `,
    text: 'Your Hitch login verification code is: {{code}}. If you didn\'t try to log in, please secure your account immediately.',
    variables: ['code'],
  },
  
  password_reset: {
    id: 'password_reset_email_otp',
    subject: 'Hitch Password Reset Code',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #2196F3; margin: 0;">Hitch</h1>
        </div>
        
        <div style="background: #f8f9fa; padding: 30px; border-radius: 10px; text-align: center;">
          <h2 style="color: #333; margin-bottom: 20px;">Password Reset</h2>
          <p style="font-size: 16px; color: #666; margin-bottom: 30px;">
            Use the code below to reset your password:
          </p>
          
          <div style="background: #FF5722; color: white; font-size: 32px; font-weight: bold; letter-spacing: 8px; padding: 20px; border-radius: 8px; margin: 20px 0;">
            {{code}}
          </div>
          
          <p style="font-size: 14px; color: #999; margin-top: 30px;">
            This code will expire in {{expiry}} minutes.<br>
            If you didn't request a password reset, please ignore this email.
          </p>
        </div>
        
        <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee;">
          <p style="font-size: 12px; color: #999;">
            © 2025 Hitch. All rights reserved.
          </p>
        </div>
      </div>
    `,
    text: 'Your Hitch password reset code is: {{code}}. This code will expire in {{expiry}} minutes. If you didn\'t request a password reset, please ignore this email.',
    variables: ['code', 'expiry'],
  },
  
  email_verification: {
    id: 'email_verification_otp',
    subject: 'Verify Your Email - Hitch',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #2196F3; margin: 0;">Hitch</h1>
        </div>
        
        <div style="background: #f8f9fa; padding: 30px; border-radius: 10px; text-align: center;">
          <h2 style="color: #333; margin-bottom: 20px;">Email Verification</h2>
          <p style="font-size: 16px; color: #666; margin-bottom: 30px;">
            Please verify your email address with the code below:
          </p>
          
          <div style="background: #4CAF50; color: white; font-size: 32px; font-weight: bold; letter-spacing: 8px; padding: 20px; border-radius: 8px; margin: 20px 0;">
            {{code}}
          </div>
          
          <p style="font-size: 14px; color: #999; margin-top: 30px;">
            This verification is required to secure your account.
          </p>
        </div>
        
        <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee;">
          <p style="font-size: 12px; color: #999;">
            © 2025 Hitch. All rights reserved.
          </p>
        </div>
      </div>
    `,
    text: 'Your Hitch email verification code is: {{code}}. This verification is required to secure your account.',
    variables: ['code'],
  },
};

// Template helper functions
export const getSMSTemplate = (purpose: string): SMSTemplate | null => {
  return SMS_TEMPLATES[purpose] || null;
};

export const getEmailTemplate = (purpose: string): EmailTemplate | null => {
  return EMAIL_TEMPLATES[purpose] || null;
};

export const renderSMSTemplate = (template: SMSTemplate, variables: Record<string, string>): string => {
  let message = template.message;
  
  template.variables.forEach(variable => {
    const value = variables[variable] || '';
    message = message.replace(new RegExp(`{{${variable}}}`, 'g'), value);
  });
  
  return message;
};

export const renderEmailTemplate = (
  template: EmailTemplate, 
  variables: Record<string, string>
): { subject: string; html: string; text: string } => {
  let { subject, html, text } = template;
  
  template.variables.forEach(variable => {
    const value = variables[variable] || '';
    const regex = new RegExp(`{{${variable}}}`, 'g');
    
    subject = subject.replace(regex, value);
    html = html.replace(regex, value);
    text = text.replace(regex, value);
  });
  
  return { subject, html, text };
};