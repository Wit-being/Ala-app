import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../constants/theme';

type InterpretationMode = 'disabled' | 'public' | 'private';

interface Props {
  isPublic: boolean;
  interpretationMode: InterpretationMode;
  onPublicChange: (isPublic: boolean) => void;
  onInterpretationModeChange: (mode: InterpretationMode) => void;
}

const INTERPRETATION_OPTIONS = [
  { id: 'public', label: 'Anyone can interpret', icon: 'globe-outline' },
  { id: 'private', label: 'Only I see interpretations', icon: 'eye-off-outline' },
  { id: 'disabled', label: 'No interpretations', icon: 'close-circle-outline' },
];

export default function VisibilitySelector({
  isPublic,
  interpretationMode,
  onPublicChange,
  onInterpretationModeChange,
}: Props) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionLabel}>Who can see this dream?</Text>
      
      {/* Visibility Toggle - Same style as Dream Type */}
      <View style={styles.visibilityRow}>
        <TouchableOpacity
          style={[styles.visibilityChip, isPublic && styles.visibilityChipActive]}
          onPress={() => onPublicChange(true)}
        >
          <Ionicons 
            name="globe-outline" 
            size={18} 
            color={isPublic ? theme.primary : theme.textMuted} 
          />
          <Text style={[styles.visibilityLabel, isPublic && styles.visibilityLabelActive]}>
            Community
          </Text>
          {isPublic && (
            <Ionicons name="checkmark-circle" size={16} color={theme.primary} style={styles.checkIcon} />
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.visibilityChip, !isPublic && styles.visibilityChipActiveGold]}
          onPress={() => onPublicChange(false)}
        >
          <Ionicons 
            name="lock-closed" 
            size={18} 
            color={!isPublic ? theme.gold : theme.textMuted} 
          />
          <Text style={[styles.visibilityLabel, !isPublic && styles.visibilityLabelActiveGold]}>
            Private
          </Text>
          {!isPublic && (
            <Ionicons name="checkmark-circle" size={16} color={theme.gold} style={styles.checkIcon} />
          )}
        </TouchableOpacity>
      </View>

      {/* Interpretation Options - Shows only when Public (like tags show for dream type) */}
      {isPublic && (
        <View style={styles.interpretationSection}>
          <Text style={styles.subLabel}>Interpretations</Text>
          <View style={styles.interpretationRow}>
            {INTERPRETATION_OPTIONS.map((option) => {
              const isSelected = interpretationMode === option.id;
              return (
                <TouchableOpacity
                  key={option.id}
                  style={[styles.interpChip, isSelected && styles.interpChipActive]}
                  onPress={() => onInterpretationModeChange(option.id as InterpretationMode)}
                >
                  <Ionicons
                    name={option.icon as any}
                    size={14}
                    color={isSelected ? theme.primary : theme.textMuted}
                  />
                  <Text style={[styles.interpLabel, isSelected && styles.interpLabelActive]}>
                    {option.id === 'public' ? 'Open' : option.id === 'private' ? 'Hidden' : 'Off'}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <Text style={styles.interpHint}>
            {interpretationMode === 'public' && 'Others can share their interpretations publicly'}
            {interpretationMode === 'private' && 'You\'ll see interpretations, others won\'t'}
            {interpretationMode === 'disabled' && 'No one can add interpretations'}
          </Text>
        </View>
      )}

      {/* Private hint */}
      {!isPublic && (
        <Text style={styles.privateHint}>Only you can see this dream in your journal</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginBottom: 24,
  },
  sectionLabel: {
    fontSize: 14,
    color: theme.textSecondary,
    marginBottom: 10,
  },
  visibilityRow: {
    flexDirection: 'row',
    gap: 10,
  },
  visibilityChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 14,
    backgroundColor: theme.glass,
    borderWidth: 1,
    borderColor: theme.glassBorder,
  },
  visibilityChipActive: {
    backgroundColor: 'rgba(96, 165, 250, 0.1)',
    borderColor: theme.primary,
  },
  visibilityChipActiveGold: {
    backgroundColor: 'rgba(212, 175, 55, 0.1)',
    borderColor: theme.gold,
  },
  visibilityLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.textSecondary,
  },
  visibilityLabelActive: {
    color: theme.primary,
  },
  visibilityLabelActiveGold: {
    color: theme.gold,
  },
  checkIcon: {
    marginLeft: 4,
  },
  interpretationSection: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: theme.glassBorder,
  },
  subLabel: {
    fontSize: 13,
    color: theme.textSubtle,
    marginBottom: 10,
  },
  interpretationRow: {
    flexDirection: 'row',
    gap: 8,
  },
  interpChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: theme.glass,
    borderWidth: 1,
    borderColor: theme.glassBorder,
  },
  interpChipActive: {
    backgroundColor: 'rgba(96, 165, 250, 0.1)',
    borderColor: theme.primary,
  },
  interpLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: theme.textMuted,
  },
  interpLabelActive: {
    color: theme.primary,
  },
  interpHint: {
    fontSize: 12,
    color: theme.textMuted,
    marginTop: 10,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  privateHint: {
    fontSize: 12,
    color: theme.textMuted,
    marginTop: 10,
    textAlign: 'center',
    fontStyle: 'italic',
  },
});