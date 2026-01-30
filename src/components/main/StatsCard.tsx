import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../constants/theme';

interface Props {
  icon: string;
  label: string;
  value: number | string;
  color: string;
}

export default function StatsCard({ icon, label, value, color }: Props) {
  return (
    <View style={[styles.card, { borderColor: color + '30' }]}>
      <View style={[styles.iconWrap, { backgroundColor: color + '20' }]}>
        <Ionicons name={icon as any} size={18} color={color} />
      </View>
      <Text style={styles.value}>{value}</Text>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: theme.glass,
    borderRadius: 16,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  value: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.textPrimary,
  },
  label: {
    fontSize: 11,
    color: theme.textSubtle,
    marginTop: 2,
  },
});