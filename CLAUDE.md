- Always follow the guidelines in this file, unless explicitly told otherwise by the user or overided in the CLAUDE.local.md file.

## Push Notification System

- **Only send notificaitons when Claude is truly done and waiting for user input** - this helps with workflow awareness
- **Send notifications when asking for permission** - especially for commands, tool use approvals, file operations, or any user decision
- **CRITICAL**: Use the exact curl format below with NO LINE BREAKS in the command
- **When completing tasks**: Only send completion notifications when the ENTIRE
  user request is finished and Claude is waiting for the next instruction.
  Send completion notifications via:
  ```bash
  curl -X POST https://us-central1-doulaconnect-messaging.cloudfunctions.net/sendClaudeNotification -H "Content-Type: application/json" -d '{"message": "Task completed: [brief description]", "type": "completed"}'
  ```
- **When waiting for input**: Send waiting notifications via:
  ```bash
  curl -X POST https://us-central1-doulaconnect-messaging.cloudfunctions.net/sendClaudeNotification -H "Content-Type: application/json" -d '{"message": "Waiting for your input", "type": "waiting"}'
  ```
- **When asking for permission**: Send waiting notifications when asking user to approve tool use or make decisions:
  ```bash
  curl -X POST https://us-central1-doulaconnect-messaging.cloudfunctions.net/sendClaudeNotification -H "Content-Type: application/json" -d '{"message": "Need your permission to proceed", "type": "waiting"}'
  ```
- **When errors occur**: Send error notifications via:
  ```bash
  curl -X POST https://us-central1-doulaconnect-messaging.cloudfunctions.net/sendClaudeNotification -H "Content-Type: application/json" -d '{"message": "Error: [brief description]", "type": "error"}'
  ```
- **For significant milestones**: Send info notifications for important updates
- **IMPORTANT FORMATTING RULES**:
  - Keep the entire curl command on ONE LINE - no line breaks in the URL
  - Use single quotes around the JSON data: `'{"message": "text", "type": "info"}'`
  - If you get "Bad Request" error, it's likely due to line breaks in the command
- **Test interface**: Use `/test-claude-notifications.html` for debugging notifications

## Project Overview

- Full-stack TypeScript app: React + Vite + TanStack Router (frontend), Firebase (backend)
- Development: Use `mcp__shell-commands__launch-dev-all` to start servers, then monitor output streams for validation
- **DEV SERVER TROUBLESHOOTING**: If `pnpm run dev` hangs but shows "VITE ready", run `node_modules/.bin/vite &` directly. The `--open` flag causes hanging in headless environments. Test with `curl http://localhost:5173` to verify server is running even if command appears hung.
- Import alias: `@/` maps to `src/` directory
- Tailwind CSS 4, daisyUI 5: All config in `src/index.css` via CSS syntax, NOT tailwind.config.js
- Typography: Uses `@tailwindcss/typography` with `prose prose-invert` at root level, use `not-prose` to escape (e.g., for buttons/tables)
- Environment variables: Client vars need `VITE_` prefix
- Package manager: Always use `pnpm`, not npm

## Deployment

- **Primary deployment**: `dcmsg2` project on Vercel (https://dcmsg2.vercel.app)
- Deploy with: `npx vercel --prod --yes` (project is already linked to dcmsg2)
- **DEPRECATED**: `full-stack-vibe-coding-day1` and `dcmsg1` projects are no longer used

## Git Workflow

- **Commit after each user request**: When completing what the user asked for, immediately commit: `git add -A && git commit -m "[action]: [what was accomplished]"`
- Commits should happen WITHOUT asking - they're for checkpoints, not cleanliness (will be squashed later)
- Commits are restore points - if user says something like "let's go back to before X" or "Lets undo that", find the appropriate commit and run `git reset --hard [commit-hash]` to restore the state. Always verify the commit hash via `git log` or `git reflog` first.
- If you've reset to a previous commit and need to go forward again, use `git reflog` to see all recent commits (including those "lost" by reset), then `git reset --hard [commit-hash]` to jump forward to any commit shown in the reflog.
- **ALWAYS update claude-notes.md and include it in EVERY commit** - this preserves context so future Claude Code sessions can continue from any restore point. Maintain a list of the commit messages made during the session/feature.
- When feature complete and user approves or asks to push perform a squash: run `pnpm run lint` first, then find the first commit for the session/feature, then `git reset --soft [starting-commit]` then CLEAR claude-notes.md and commit with `"feat: [complete feature description]"`
- Before major feature work: Tell user "Starting [feature], will make frequent commits as checkpoints then squash when complete"
- Claude Code notes file should include:
  - Current feature being worked on
  - List of commits made during the session/feature
  - Progress status and next steps
  - Important context or decisions made
  - Relevant file locations or dependencies

## Testing & Validation

- Validation: Monitor MCP output streams for TypeScript/compilation errors
- Test UI with Playwright MCP: full browser automation with element interaction and console access
- Responsive testing: Use `mcp__playwright__browser_resize` to test mobile (375x667), tablet (768x1024), desktop (1200x800)
- Debug with `mcp__playwright__browser_console_messages` to view all browser console output
- If you run into an issue you don't know how to fix, look for relevant documentation or a reference implementation

## Firebase

- Use Firebase SDK v11 for all operations
- Firestore for database operations
- Storage for file uploads
- Cloud Functions for server-side logic

## TanStack Router

- Avoid `const search = useSearch()` - use `select` option instead
- Route params update quirks - preserve location when updating
- Search params as filters: validate with zod schema in route definition
- Navigate programmatically: `const navigate = useNavigate()` then `navigate({ to: '/path' })`
- Type-safe links: always use `<Link to="/path">` not `<a href>`
- Nested routes require parent to have `<Outlet />`, use `.index.tsx` files to show content at parent paths

## TanStack Query + Firebase Integration

- Use standard React Query with Firebase SDK
- Preload in route loaders: `loader: async ({ context: { queryClient } }) => await queryClient.ensureQueryData(queryOptions)`
- Use `useSuspenseQuery` in components: `const { data } = useSuspenseQuery(queryOptions)`
- For mutations, use standard React Query mutations with Firebase operations

## TanStack Form

- Field validation can override form validation - design hierarchy carefully
- Submit handler: `onSubmit: async ({ value }) => { await mutate(value); form.reset(); }`
- Field errors: `{field.state.meta.errors && <span>{field.state.meta.errors}</span>}`
- Disable during submit: `<button disabled={!form.state.canSubmit || form.state.isSubmitting}>`
- Async validation: use `onChangeAsync` for server-side checks

## Component Architecture & Best Practices

### Feature-Based Organization
- **ALWAYS use feature-based structure**: `src/features/{feature-name}/components/`
- **Use barrel exports**: Import from `@/features` not individual component files
- **Follow established patterns**: Check existing components before creating new ones

### Component Guidelines
- **Extract large components**: Keep components focused and under 1,000 lines
- **Use navigation context**: All sleep logging components use `useNavigation()` for shared state
- **Handle real-time updates**: Use Firebase listeners with proper cleanup in `useEffect`
- **Preserve component relationships**: Maintain parent-child navigation patterns

### Import Patterns
```typescript
// ✅ Preferred - Clean barrel exports
import { SleepLogModal, LogDetailView } from "@/features";

// ✅ Feature-specific imports  
import { SleepLogModal } from "@/features/sleep-logging";

// ❌ Avoid - Direct component imports
import { SleepLogModal } from "@/features/sleep-logging/components/SleepLogModal";
```

### Sleep Logging Component Map
- **SleepLogModal** (1,164 lines) - New log creation interface
- **EditLogModal** (883 lines) - Advanced log editing with interjections
- **LogDetailView** (665 lines) - Detailed view with comments and statistics
- **LogsListView** (580 lines) - Main list with date navigation and dual views
- **CommentsModal** (275 lines) - Standalone comments management

### Navigation Context Patterns
```typescript
const { 
  state, 
  navigateToLogDetail, 
  navigateToEditLog, 
  navigateBack 
} = useNavigation();

// Navigate to specific views
navigateToLogDetail(logId);
navigateToEditLog(logId);  
navigateBack();
```

### Documentation
- **Component documentation**: See `docs/component-map.md` for complete architecture
- **API reference**: See `docs/api-reference.md` for all functions and types
- **Developer guide**: See `docs/developer-guide.md` for practical patterns

## Component Search Protocol

When searching for component usage, ALWAYS follow this 3-step process:

1. **Broad search first**: Use `grep -r "ComponentName" src/` 
2. **If no results**: Read the most likely files directly with Read tool
3. **Human checkpoint**: Ask "Does this match what you see in the UI?"

Never conclude a component is "unused" without completing all 3 steps.

## Naming Conventions (LLM-Friendly)

**CRITICAL**: Follow these naming conventions consistently for optimal LLM readability and searchability:

### File Names: `kebab-case.tsx`
- Components: `log-modal.tsx`, `user-profile.tsx`, `sleep-log-tile.tsx`
- Hooks: `use-sleep-log-modal.ts`, `use-bubble-auth.ts`
- Utils: `logo-utils.ts`, `sleep-statistics.ts`

### Components: `PascalCase`
- `LogModal`, `UserProfile`, `SleepLogTile`
- Matches React conventions and TypeScript interfaces

### Functions/Variables: `camelCase`
- `handleSave`, `getCurrentUser`, `isLogComplete`
- Includes React hooks: `useState`, `useEffect`, `useNavigation`

### Constants: `SCREAMING_SNAKE_CASE`
- `API_BASE_URL`, `MAX_RETRY_ATTEMPTS`, `DEFAULT_TIMEZONE`

### Types/Interfaces: `PascalCase`
- `LogModalProps`, `UserData`, `SleepEvent`
- End interfaces with `Props` for component props

### **Consistency Enforcement**
- **BEFORE starting any task**: Check if files/components being worked on follow these conventions
- **If inconsistencies found**: Ask user "I notice [specific inconsistencies]. Should we take a moment to rename these for consistency before proceeding?"
- **When creating new files**: Always use these conventions from the start
- **When refactoring**: Use this as an opportunity to fix naming inconsistencies

## Other Guidelines

- When stuck: check official docs first (firebase.google.com/docs, tanstack.com)
- Ask before installing new dependencies
- Verify responsive design at multiple breakpoints
- Document non-obvious implementation choices in this file
- Import icons from `lucide-react`
- When making identical changes to multiple occurrences, use Edit with `replace_all: true` instead of MultiEdit. Avoid MultiEdit whenever possible, it is unreliable.
- Never leave floating promisses, use void when needed
