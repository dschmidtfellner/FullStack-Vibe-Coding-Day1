- Always follow the guidelines in this file, unless explicitly told otherwise by the user or overided in the CLAUDE.local.md file.

## Push Notification System

- **Always send notifications after completing user requests** - this helps with workflow awareness
- **Send notifications when asking for permission** - especially for tool use approvals, file operations, or any user decision
- **CRITICAL**: Use the exact curl format below with NO LINE BREAKS in the command
- **When completing tasks**: Send completion notifications via:
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

- Full-stack TypeScript app: React + Vite + TanStack Router (frontend), Firebase (backend), Clerk (auth)
- Development: Use `mcp__shell-commands__launch-dev-all` to start servers, then monitor output streams for validation
- **DEV SERVER TROUBLESHOOTING**: 
  - The `--open` flag in `pnpm run dev` causes hanging in headless environments but server starts normally
  - Use timeout of 10-15 seconds max when running `pnpm run dev` - server is ready when you see "VITE ready"
  - If command times out but shows "VITE ready", the server is running successfully
  - Test with `curl http://localhost:5174` to verify server is accessible
  - Alternative: Run `node_modules/.bin/vite --port 5174` directly to avoid --open flag
- Import alias: `@/` maps to `src/` directory
- Tailwind CSS 4: All config in `src/index.css` via CSS syntax, NOT tailwind.config.js
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
- Clerk verification: sign in with your_email+clerk_test@example.com and 424242 as the verification code. Type all 6 digits at once in first field - UI auto-distributes to separate inputs
- Debug with `mcp__playwright__browser_console_messages` to view all browser console output
- If you run into an issue you don't know how to fix, look for relevant documentation or a reference implementation

## Firebase

- Use Firebase SDK v11 for all operations
- Authentication handled by Clerk integration
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

## Styling Guidelines

- Use custom color variables defined in `src/index.css`: `--brand-pink`, `--brand-purple`, `--brand-purple-light`
- Match existing app design patterns from Rested and DoulaConnect screenshots
- Use Tailwind utility classes for styling, not component libraries
- Typography plugin adds default margins to headings (h1, h2, h3, etc.) - use `mt-0` to override when precise spacing is needed
- Custom fonts: Poppins (default), Domine (`.font-domine`), Karla (`.font-karla`)

## Other Guidelines

- When stuck: check official docs first (firebase.google.com/docs, tanstack.com, tailwindcss.com)
- Ask before installing new dependencies
- Verify responsive design at multiple breakpoints
- Document non-obvious implementation choices in this file
- Import icons from `lucide-react`
- When making identical changes to multiple occurrences, use Edit with `replace_all: true` instead of MultiEdit. Avoid MultiEdit whenever possible, it is unreliable.
- Never leave floating promisses, use void when needed
