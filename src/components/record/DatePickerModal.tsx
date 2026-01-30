import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, Pressable, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../constants/theme';

interface Props {
  visible: boolean;
  selectedDate: Date;
  onClose: () => void;
  onSelectDate: (date: Date) => void;
}

export default function DatePickerModal({ visible, selectedDate, onClose, onSelectDate }: Props) {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const twoDaysAgo = new Date(today);
  twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

  const quickDates = [
    { label: 'Last Night', date: today },
    { label: 'Night Before', date: yesterday },
    { label: '2 Days Ago', date: twoDaysAgo },
  ];

  const handleSelect = (date: Date) => {
    onSelectDate(date);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.content} onPress={(e) => e.stopPropagation()}>
          <View style={styles.header}>
            <Text style={styles.title}>When did you dream this?</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={24} color={theme.textSecondary} />
            </TouchableOpacity>
          </View>

          <View style={styles.quickDates}>
            {quickDates.map((item, index) => (
              <TouchableOpacity
                key={index}
                style={[
                  styles.quickDateBtn,
                  selectedDate.toDateString() === item.date.toDateString() && styles.quickDateBtnActive,
                ]}
                onPress={() => handleSelect(item.date)}
              >
                <Text
                  style={[
                    styles.quickDateText,
                    selectedDate.toDateString() === item.date.toDateString() &&
                      styles.quickDateTextActive,
                  ]}
                >
                  {item.label}
                </Text>
                <Text style={styles.quickDateSub}>
                  {item.date.toLocaleDateString('en-US', {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                  })}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or pick a date</Text>
            <View style={styles.dividerLine} />
          </View>

          <View style={styles.olderSection}>
            <Text style={styles.olderHint}>For dreams older than 2 days</Text>
            <TouchableOpacity
              style={styles.olderBtn}
              onPress={() => {
                Alert.alert(
                  'Select Date',
                  'For MVP, dreams can be logged from the last 3 nights. Full calendar coming soon!',
                  [{ text: 'OK' }]
                );
              }}
            >
              <Ionicons name="calendar-outline" size={20} color={theme.textSecondary} />
              <Text style={styles.olderBtnText}>Choose from Calendar</Text>
              <View style={styles.soonPill}>
                <Text style={styles.soonPillText}>Soon</Text>
              </View>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  content: {
    backgroundColor: theme.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 40,
    borderWidth: 1,
    borderColor: theme.glassBorder,
    borderBottomWidth: 0,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.textPrimary,
  },
  closeBtn: {
    padding: 4,
  },
  quickDates: {
    gap: 10,
  },
  quickDateBtn: {
    padding: 16,
    borderRadius: 14,
    backgroundColor: theme.glass,
    borderWidth: 1,
    borderColor: theme.glassBorder,
  },
  quickDateBtnActive: {
    backgroundColor: 'rgba(96, 165, 250, 0.1)',
    borderColor: theme.primary,
  },
  quickDateText: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.textSecondary,
  },
  quickDateTextActive: {
    color: theme.primary,
  },
  quickDateSub: {
    fontSize: 13,
    color: theme.textMuted,
    marginTop: 4,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
    gap: 12,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: theme.glassBorder,
  },
  dividerText: {
    fontSize: 12,
    color: theme.textMuted,
  },
  olderSection: {},
  olderHint: {
    fontSize: 12,
    color: theme.textMuted,
    marginBottom: 10,
  },
  olderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 14,
    borderRadius: 12,
    backgroundColor: theme.glass,
    borderWidth: 1,
    borderColor: theme.glassBorder,
  },
  olderBtnText: {
    flex: 1,
    fontSize: 14,
    color: theme.textSecondary,
  },
  soonPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: theme.glass,
  },
  soonPillText: {
    fontSize: 10,
    color: theme.textMuted,
    fontWeight: '500',
  },
});