# Kebab-Case Conversion List

## Overview
This document lists all PascalCase and camelCase files that need to be converted to kebab-case for consistency across the codebase.

---

## 🎯 **Files to Convert**

### **Sleep Logging Components** (5 files)
```
src/features/sleep-logging/components/
├── CommentsModal.tsx         → comments-modal.tsx
├── EditLogModal.tsx          → edit-log-modal.tsx  
├── LogDetailView.tsx         → log-detail-view.tsx
├── LogsListView.tsx          → logs-list-view.tsx
└── SleepLogModal.tsx         → sleep-log-modal.tsx
```

### **Shared Components** (3 files)
```
src/components/
├── SleepLogTile.tsx          → sleep-log-tile.tsx

src/components/shared/
├── MessageInputBar.tsx       → message-input-bar.tsx
└── UniversalSkeleton.tsx     → universal-skeleton.tsx
```

### **Context Files** (1 file)
```
src/contexts/
└── NavigationContext.tsx    → navigation-context.tsx
```

### **Hook Files** (2 files)
```
src/hooks/
├── useBubbleAuth.ts          → use-bubble-auth.ts
└── useUnreadCounters.ts      → use-unread-counters.ts
```

### **Library Files** (4 files)
```
src/lib/
├── claude-notifications.ts   → claude-notifications.ts (already kebab-case ✅)
├── firebase-messaging.ts     → firebase-messaging.ts (already kebab-case ✅)
├── firebase.ts               → firebase.ts (already kebab-case ✅)
└── jwt-auth.ts               → jwt-auth.ts (already kebab-case ✅)
```

### **Utility Files** (2 files)
```
src/utils/
├── logoUtils.ts              → logo-utils.ts
└── sleepStatistics.ts        → sleep-statistics.ts
```

### **Route Files** (2 files)
```
src/routes/
├── __root.tsx                → __root.tsx (already kebab-case ✅)
└── index.tsx                 → index.tsx (already kebab-case ✅)
```

### **Feature Components** (1 file)
```
src/features/messaging/components/
└── messaging-view.tsx        → messaging-view.tsx (already kebab-case ✅)

src/features/shared/components/
└── media-messages.tsx        → media-messages.tsx (already kebab-case ✅)
```

### **Type Files** (1 file)
```
src/types/
└── firebase.ts               → firebase.ts (already kebab-case ✅)
```

### **Generated/Config Files** (3 files)
```
src/
├── main.tsx                  → main.tsx (already kebab-case ✅)
├── routeTree.gen.ts          → route-tree.gen.ts
└── vite-env.d.ts             → vite-env.d.ts (already kebab-case ✅)
```

---

## 📊 **Conversion Summary**

### **Files Requiring Conversion: 15**
- Sleep Logging Components: 5 files
- Shared Components: 3 files  
- Context Files: 1 file
- Hook Files: 2 files
- Utility Files: 2 files
- Generated Files: 1 file
- Root Config Files: 1 file

### **Files Already Compliant: 16**
- All folder names ✅
- All library files ✅  
- All route files ✅
- All feature component files ✅
- All type files ✅
- Most config files ✅

---

## 🔄 **Conversion Plan**

### **Phase 1: Component Files** 
Convert all React component files (.tsx) to kebab-case:
- Sleep logging components (5 files)
- Shared components (3 files)
- Context files (1 file)

### **Phase 2: Logic Files**
Convert TypeScript logic files (.ts):
- Hook files (2 files)
- Utility files (2 files)
- Generated files (1 file)
- Config files (1 file)

### **Phase 3: Update References**
- Update all import statements in files
- Update export statements in index.ts files
- Update documentation references

### **Phase 4: Documentation Update**
- Update docs/component-map.md
- Update docs/api-reference.md  
- Update docs/developer-guide.md
- Update CLAUDE.md

---

## ⚠️ **Critical Dependencies**

### **Import Chains to Update:**
1. **Sleep Logging Components** → Used in `/src/routes/index.tsx`
2. **Shared Components** → Used across multiple features
3. **NavigationContext** → Used by all sleep logging components
4. **Hook files** → Used across multiple components
5. **Utility files** → Used by components for calculations
6. **Barrel exports** → All `index.ts` files need updating

### **Documentation References:**
- Component names in docs/component-map.md
- File paths in docs/api-reference.md
- Import examples in docs/developer-guide.md  
- Best practices in CLAUDE.md

---

## 🎯 **Expected Benefits**

### **Consistency:**
- Universal kebab-case naming convention
- No mixing of camelCase/PascalCase/kebab-case
- Follows modern frontend standards

### **Developer Experience:**
- Predictable file naming
- Easier autocomplete in IDEs
- Consistent with folder structure

### **Future-Proof:**
- Establishes clear naming convention
- Easy to enforce in new development
- Matches industry best practices

---

*Total files to convert: **15***  
*Total imports/exports to update: **~50+***  
*Documentation files to update: **4***