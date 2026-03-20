import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

interface ConfirmDialogProps {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  visible,
  title,
  message,
  confirmLabel = 'Löschen',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>
          <View style={styles.actions}>
            <Pressable style={styles.cancelButton} onPress={onCancel}>
              <Text style={styles.cancelText}>Abbrechen</Text>
            </Pressable>
            <Pressable style={styles.confirmButton} onPress={onConfirm}>
              <Text style={styles.confirmText}>{confirmLabel}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  card: {
    backgroundColor: '#1a1a1a',
    borderRadius: 22,
    padding: 24,
    borderWidth: 1,
    borderColor: '#2c2c2c',
    gap: 12,
    width: '100%',
  },
  title: { color: '#ffffff', fontSize: 18, fontWeight: '800' },
  message: { color: '#9a9a9a', fontSize: 14, lineHeight: 21 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 8 },
  cancelButton: {
    flex: 1,
    backgroundColor: '#242424',
    borderWidth: 1,
    borderColor: '#3a3a3a',
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: 'center',
  },
  cancelText: { color: '#ffffff', fontSize: 15, fontWeight: '700' },
  confirmButton: {
    flex: 1,
    backgroundColor: '#412024',
    borderWidth: 1,
    borderColor: '#70313b',
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: 'center',
  },
  confirmText: { color: '#ff9d9d', fontSize: 15, fontWeight: '700' },
});
