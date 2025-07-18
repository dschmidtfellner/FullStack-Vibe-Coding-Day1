# Documentation

This directory contains comprehensive documentation for the sleep logging application after the major component extraction refactor.

## 📚 Available Documentation

### [Component Map & Architecture Guide](./component-map.md)

**Comprehensive technical reference**

- Complete component structure and relationships
- Detailed feature breakdown (3,567 lines extracted!)
- Data flow and state management patterns
- Performance optimizations and testing strategies
- Future enhancement roadmap

### [Developer Quick Start Guide](./developer-guide.md)

**Practical guide for daily development**

- Quick component reference
- Import patterns and best practices
- Common code patterns and examples
- Debugging tips and troubleshooting
- Performance optimization techniques

### [API Reference](./api-reference.md)

**Comprehensive function and type reference**

- All Firebase functions and React hooks
- Complete TypeScript interfaces and types
- Navigation functions and state management
- Component props and styling patterns
- Common code patterns and error handling

```
src/features/
├── logging/    # several components
├── messaging/        # Real-time chat
├── shared/          # Reusable utilities
└── index.ts         # Clean barrel exports
```

## 🚀 Key Improvements

- **Maintainability:** Clear separation of concerns
- **Reusability:** Standalone, focused components
- **Developer Experience:** Clean imports with barrel exports
- **Performance:** Optimized Firebase listeners and state management
- **Scalability:** Feature-based organization ready for team development

## 🔧 Quick Start

1. **Finding components:** Use the [Component Map](./component-map.md)
2. **Adding features:** Follow the [Developer Guide](./developer-guide.md)
3. **Clean imports:** Use `import { Component } from "@/features"`

---

_Documentation last updated: Post-extraction optimization phase_
