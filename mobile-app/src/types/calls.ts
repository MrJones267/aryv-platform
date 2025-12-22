/**
 * @fileoverview Centralized call-related type definitions
 * @author Oabona-Majoko
 * @created 2025-01-25
 */

// Centralized call type definition
export type CallType = 'voice' | 'video' | 'emergency';

// Call status types
export type CallStatus = 'idle' | 'dialing' | 'ringing' | 'connected' | 'ended' | 'failed';

// Common call participant interface
export interface CallParticipant {
  id: string;
  name: string;
  profilePicture?: string;
}

// Base call interface
export interface BaseCall {
  id: string;
  callType: CallType;
  status: CallStatus;
  participants: CallParticipant[];
  startTime?: Date;
  endTime?: Date;
  duration?: number;
}