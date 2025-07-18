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

---

## ⚠️ **CRITICAL LESSONS FROM FAILED CONVERSION ATTEMPT**

### **What Went Wrong (Commit Range: 70eb68b → 284abfd)**

The initial kebab-case conversion appeared successful but resulted in multiple runtime failures due to **incomplete import reference updates**. Here's what a fresh Claude implementation MUST avoid:

### **1. Systematic Import Search Failures**
**Problem:** Manual grep searches missed critical import statements across different components.

**Missed Imports:**
- `src/features/sleep-logging/components/sleep-log-modal.tsx:2` - `useBubbleAuth` import
- `src/features/sleep-logging/components/sleep-log-modal.tsx:21` - `UniversalSkeleton` import  
- `src/features/messaging/components/messaging-view.tsx:3,4,5` - Multiple hook/component imports
- `src/main.tsx:7` - Route tree import reference

**SOLUTION:** Use **exhaustive automated search** before AND after file renames:
```bash
# Before renaming - catalog ALL import references
rg "from ['\"]@/hooks/useBubbleAuth" --type tsx --type ts
rg "from ['\"]@/contexts/NavigationContext" --type tsx --type ts
rg "from ['\"]@/components/shared/(MessageInputBar|UniversalSkeleton)" --type tsx --type ts

# After renaming - verify NO old references remain
rg "useBubbleAuth\"|NavigationContext\"|MessageInputBar\"|UniversalSkeleton\"" --type tsx --type ts
```

### **2. Route Tree Import Confusion**
**Problem:** Both `routeTree.gen.ts` and `route-tree.gen.ts` existed simultaneously, causing dynamic import failures.

**SOLUTION:** 
1. **Before renaming any generated files**, check what imports them
2. **Update imports BEFORE renaming the files**
3. **Verify only one version exists** after rename

### **3. TanStack Router Compatibility Issues**
**Problem:** `autoCodeSplitting: true` + incomplete imports = dynamic module fetch failures

**SOLUTION:**
1. **Test with `autoCodeSplitting: false` first** to isolate import issues
2. **Only re-enable code splitting after ALL imports are verified working**
3. **Regenerate route tree after any route-related file renames**

### **4. Incomplete Phase Execution**
**Problem:** Phase 3 (Update References) was marked complete while critical imports remained broken.

**SOLUTION - Enhanced Phase 3 Protocol:**
```bash
# Phase 3a: Pre-verification
echo "=== SEARCHING FOR ALL OLD REFERENCES ==="
rg "(useBubbleAuth|useUnreadCounters|NavigationContext|logoUtils|sleepStatistics)" --type tsx --type ts

# Phase 3b: Update imports systematically
# Phase 3c: Post-verification  
echo "=== VERIFYING NO OLD REFERENCES REMAIN ==="
rg "(useBubbleAuth|useUnreadCounters|NavigationContext|logoUtils|sleepStatistics)" --type tsx --type ts
# Should return: No matches found

# Phase 3d: Test compilation
pnpm run dev --no-open
# Should start without import errors
```

### **5. Server Testing Protocol**
**SOLUTION:** After Phase 3, ALWAYS verify:
```bash
# Start server and verify it stays running
pnpm run dev --no-open &
sleep 5
curl -I http://localhost:5174
# Should return 200 OK, not Connection refused
```

### **🔧 MANDATORY PRE-CONVERSION CHECKLIST**

**Before starting Phase 1:**
- [ ] Create comprehensive list of ALL files importing renamed components
- [ ] Test current dev server works: `pnpm run dev`
- [ ] Backup current route tree generation setup
- [ ] Verify all TypeScript compilation passes: `pnpm run build`

**After each Phase:**
- [ ] Run exhaustive import search to verify no old references remain
- [ ] Test dev server starts and stays running
- [ ] Test at least one page loads in browser
- [ ] Only mark phase complete after ALL verifications pass

**If ANY verification fails:**
- [ ] Do NOT proceed to next phase
- [ ] Fix all issues before continuing
- [ ] Re-run all verifications for current phase

### **🎯 Success Criteria**
Conversion is only successful when:
1. ✅ All 15 files renamed to kebab-case
2. ✅ Zero old import references remain (verified by exhaustive search)
3. ✅ Dev server starts and stays running
4. ✅ Application loads in browser without import errors
5. ✅ TypeScript compilation passes
6. ✅ All documentation updated

**Total estimated time with proper verification: 45-60 minutes**  
**Previous failed attempt time: 30 minutes (insufficient verification)**

---

*This analysis based on commit range 70eb68b → 284abfd*  
*Reverted to 39e256b for clean slate attempt*