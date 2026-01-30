import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../constants/theme';

type DreamType = 'dream' | 'nightmare' | null;

interface DreamTag {
  id: string;
  icon: string;
  label: string;
}

interface Props {
  dreamType: DreamType;
  selectedTag: string | null;
  onDreamTypeChange: (type: DreamType) => void;
  onTagChange: (tagId: string | null) => void;
}

const DREAM_TAGS: DreamTag[] = [
  { id: 'sparkles', icon: '✨', label: 'Stardust' },
  { id: 'butterfly', icon: '🦋', label: 'Butterfly' },
];

const NIGHTMARE_TAGS: DreamTag[] = [
  { id: 'cobweb', icon: '🕸️', label: 'Cobwebs' },
];

export default function DreamTypeSelector({
  dreamType,
  selectedTag,
  onDreamTypeChange,
  onTagChange,
}: Props) {
  const availableTags = dreamType === 'dream' ? DREAM_TAGS : dreamType === 'nightmare' ? NIGHTMARE_TAGS : [];

  const handleTypeSelect = (type: DreamType) => {
    onDreamTypeChange(dreamType === type ? null : type);
  };

  return (
    <>
      {/* Dream Type Selection */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>What kind of dream?</Text>
        <View style={styles.typeRow}>
          <TouchableOpacity
            style={[styles.typeChip, dreamType === 'dream' && styles.typeChipActiveDream]}
            onPress={() => handleTypeSelect('dream')}
          >
            <Text style={[styles.typeLabel, dreamType === 'dream' && styles.typeLabelActive]}>
              Dream
            </Text>
            <Text style={styles.typeDesc}>Pleasant</Text>
            {dreamType === 'dream' && (
              <Ionicons name="checkmark-circle" size={16} color={theme.primary} style={styles.checkIcon} />
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.typeChip, dreamType === 'nightmare' && styles.typeChipActiveNightmare]}
            onPress={() => handleTypeSelect('nightmare')}
          >
            <Text
              style={[styles.typeLabel, dreamType === 'nightmare' && styles.typeLabelActiveNightmare]}
            >
              Nightmare
            </Text>
            <Text style={styles.typeDesc}>Unsettling</Text>
            {dreamType === 'nightmare' && (
              <Ionicons name="checkmark-circle" size={16} color={theme.danger} style={styles.checkIcon} />
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* Tag Selection */}
      {dreamType && availableTags.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>
            {dreamType === 'dream' ? 'Add a vibe' : 'Set the mood'}
          </Text>
          <View style={styles.tagRow}>
            {availableTags.map((tag) => {
              const isSelected = selectedTag === tag.id;
              const isNightmare = dreamType === 'nightmare';

              return (
                <TouchableOpacity
                  key={tag.id}
                  style={[
                    styles.tagChip,
                    isSelected && (isNightmare ? styles.tagChipActiveNightmare : styles.tagChipActive),
                  ]}
                  onPress={() => onTagChange(isSelected ? null : tag.id)}
                >
                  <Text style={styles.tagEmoji}>{tag.icon}</Text>
                  <Text
                    style={[
                      styles.tagLabel,
                      isSelected && (isNightmare ? styles.tagLabelActiveNightmare : styles.tagLabelActive),
                    ]}
                  >
                    {tag.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  section: {
    marginBottom: 20,
  },
  sectionLabel: {
    fontSize: 14,
    color: theme.textSecondary,
    marginBottom: 10,
  },
  typeRow: {
    flexDirection: 'row',
    gap: 10,
  },
  typeChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: theme.glass,
    borderWidth: 1,
    borderColor: theme.glassBorder,
    gap: 8,
  },
  typeChipActiveDream: {
    backgroundColor: 'rgba(96, 165, 250, 0.1)',
    borderColor: theme.primary,
  },
  typeChipActiveNightmare: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderColor: theme.danger,
  },
  typeLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.textSecondary,
  },
  typeLabelActive: {
    color: theme.primary,
  },
  typeLabelActiveNightmare: {
    color: theme.danger,
  },
  typeDesc: {
    fontSize: 11,
    color: theme.textMuted,
    flex: 1,
  },
  checkIcon: {
    marginLeft: 'auto',
  },
  tagRow: {
    flexDirection: 'row',
    gap: 10,
  },
  tagChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: theme.glass,
    borderWidth: 1,
    borderColor: theme.glassBorder,
  },
  tagChipActive: {
    backgroundColor: 'rgba(96, 165, 250, 0.15)',
    borderColor: theme.primary,
  },
  tagChipActiveNightmare: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderColor: theme.danger,
  },
  tagEmoji: {
    fontSize: 16,
  },
  tagLabel: {
    fontSize: 13,
    color: theme.textSecondary,
    fontWeight: '500',
  },
  tagLabelActive: {
    color: theme.primary,
  },
  tagLabelActiveNightmare: {
    color: theme.danger,
  },
});