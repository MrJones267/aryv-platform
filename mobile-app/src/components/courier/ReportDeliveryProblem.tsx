/**
 * @fileoverview "Report a problem" for a delivery, for the sender or courier
 * @author Oabona-Majoko
 * @created 2026-10-30
 * @lastModified 2026-10-30
 *
 * Shows the latest reported problem and ARYV's decision once made, or a
 * button to report one. A problem can be reported once the courier has the
 * package, or after delivery; the server enforces this and the one-at-a-time
 * rule, so the button simply shows the server's answer when it refuses.
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';

import { colors } from '../../theme';
import PackageService, { DeliveryProblem, DeliveryProblemType } from '../../services/PackageService';

// Constants
const DESCRIPTION_MIN = 10;
const DESCRIPTION_MAX = 1000;

const PROBLEMS: Array<{ type: DeliveryProblemType; label: string }> = [
  { type: 'package_not_delivered', label: 'Package not delivered' },
  { type: 'package_damaged', label: 'Package damaged' },
  { type: 'incorrect_location', label: 'Delivered to the wrong place' },
  { type: 'wrong_recipient', label: 'Wrong recipient' },
  { type: 'late_delivery', label: 'Very late' },
  { type: 'courier_no_show', label: 'Courier did not show up' },
  { type: 'other', label: 'Something else' },
];

interface Props {
  agreementId: string;
  /** The delivery's status; reporting opens once the package is in transit. */
  deliveryStatus?: string;
  /** Called after a report, so the screen can reload the delivery's status. */
  onReported?: () => void;
}

const ReportDeliveryProblem: React.FC<Props> = ({ agreementId, deliveryStatus, onReported }) => {
  const [problem, setProblem] = useState<DeliveryProblem | null>(null);
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<DeliveryProblemType | null>(null);
  const [description, setDescription] = useState('');
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    const response = await PackageService.getDeliveryProblem(agreementId);
    if (response.success) setProblem(response.data?.dispute ?? null);
  }, [agreementId]);

  useEffect(() => {
    load();
  }, [load]);

  const send = async () => {
    if (!type) return;
    setSending(true);
    const response = await PackageService.reportDeliveryProblem(agreementId, {
      disputeType: type,
      description: description.trim(),
    });
    setSending(false);
    if (response.success) {
      setOpen(false);
      setType(null);
      setDescription('');
      Alert.alert('Problem reported', response.data?.message ?? 'ARYV will review it and tell you both what was decided.');
      load();
      onReported?.();
    } else {
      Alert.alert('Could not report the problem', response.error ?? 'Please try again.');
    }
  };

  const reportable = deliveryStatus === 'in_transit' || deliveryStatus === 'completed';
  const openProblem = problem && (problem.status === 'open' || problem.status === 'under_review');

  if (problem && (openProblem || !reportable)) {
    const label = PROBLEMS.find(p => p.type === problem.disputeType)?.label ?? 'Problem';
    return (
      <View style={styles.card}>
        <View style={styles.row}>
          <Icon name={openProblem ? 'report-problem' : 'gavel'} size={20} color={openProblem ? colors.warning : colors.primary} />
          <Text style={styles.title}>{openProblem ? `Reported: ${label}` : `Decided: ${label}`}</Text>
        </View>
        <Text style={styles.body}>
          {openProblem
            ? 'ARYV is reviewing this and will tell you and the other person what was decided.'
            : problem.resolutionNotes ?? 'This problem has been resolved.'}
        </Text>
      </View>
    );
  }

  if (!reportable) return null;

  const valid = type !== null && description.trim().length >= DESCRIPTION_MIN;

  return (
    <>
      <TouchableOpacity style={styles.button} onPress={() => setOpen(true)} accessibilityRole="button">
        <Icon name="report-problem" size={20} color={colors.error} />
        <Text style={styles.buttonText}>Report a problem with this delivery</Text>
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="slide" onRequestClose={() => !sending && setOpen(false)}>
        <View style={styles.backdrop}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>What went wrong?</Text>
            {PROBLEMS.map(p => (
              <TouchableOpacity
                key={p.type}
                style={[styles.option, type === p.type && styles.optionSelected]}
                onPress={() => setType(p.type)}
                accessibilityRole="radio"
                accessibilityState={{ selected: type === p.type }}
              >
                <Icon
                  name={type === p.type ? 'radio-button-checked' : 'radio-button-unchecked'}
                  size={20}
                  color={type === p.type ? colors.primary : colors.text.secondary}
                />
                <Text style={styles.optionText}>{p.label}</Text>
              </TouchableOpacity>
            ))}
            <TextInput
              style={styles.input}
              placeholder="Tell us what happened"
              placeholderTextColor={colors.text.light}
              value={description}
              onChangeText={setDescription}
              maxLength={DESCRIPTION_MAX}
              multiline
            />
            <Text style={styles.hint}>At least {DESCRIPTION_MIN} characters. The other person will be told a problem was reported.</Text>
            <View style={styles.actions}>
              <TouchableOpacity onPress={() => setOpen(false)} disabled={sending} style={styles.cancel}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={send}
                disabled={!valid || sending}
                style={[styles.submit, (!valid || sending) && styles.submitDisabled]}
              >
                {sending ? <ActivityIndicator color={colors.text.inverse} /> : <Text style={styles.submitText}>Report</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.background.secondary,
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 16,
    marginVertical: 8,
  },
  row: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  title: { marginLeft: 8, fontSize: 15, fontWeight: '600', color: colors.text.primary },
  body: { fontSize: 14, color: colors.text.secondary },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 16,
    marginVertical: 8,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border.medium,
  },
  buttonText: { marginLeft: 8, fontSize: 15, color: colors.error, fontWeight: '500' },
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: colors.background.modal },
  sheet: { backgroundColor: colors.background.card, borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 20 },
  sheetTitle: { fontSize: 18, fontWeight: '600', color: colors.text.primary, marginBottom: 12 },
  option: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 8, borderRadius: 8 },
  optionSelected: { backgroundColor: colors.background.secondary },
  optionText: { marginLeft: 10, fontSize: 15, color: colors.text.primary },
  input: {
    marginTop: 12,
    minHeight: 80,
    borderWidth: 1,
    borderColor: colors.border.medium,
    borderRadius: 8,
    padding: 10,
    fontSize: 15,
    color: colors.text.primary,
    textAlignVertical: 'top',
  },
  hint: { fontSize: 12, color: colors.text.secondary, marginTop: 6 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 16 },
  cancel: { paddingVertical: 12, paddingHorizontal: 16 },
  cancelText: { fontSize: 15, color: colors.text.secondary },
  submit: { backgroundColor: colors.error, paddingVertical: 12, paddingHorizontal: 24, borderRadius: 8, minWidth: 100, alignItems: 'center' },
  submitDisabled: { opacity: 0.5 },
  submitText: { color: colors.text.inverse, fontSize: 15, fontWeight: '600' },
});

export default ReportDeliveryProblem;
