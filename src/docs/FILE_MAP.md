# File Map - Àlá App

## Quick Navigation

### Theme & Constants
- `constants/theme.ts` - All colors, gradients
- `constants/badges.ts` - Badge definitions

### Main Screen
- `screens/MainScreen.tsx` - Main orchestrator
- `hooks/useMainScreen.ts` - All state & logic
- `components/main/` - All UI pieces

### Record Screen  
- `screens/RecordDreamScreen.tsx` - Main screen
- `components/record/` - All UI pieces

### Shared Components
- `components/common/` - Reusable everywhere

### Types
- `types/dreams.ts` - Dream-related types
- `types/profile.ts` - Profile types
- `types/social.ts` - Social features types

## Common Changes

| Task | File |
|------|------|
| Change colors | `constants/theme.ts` |
| Change feed card | `components/main/FeedDreamCard.tsx` |
| Change journal card | `components/main/JournalEntryCard.tsx` |
| Change bottom nav | `components/main/BottomNav.tsx` |
| Add new dream field | `screens/RecordDreamScreen.tsx` + `types/dreams.ts` |