- Always follow the guidelines in this file, unless explicitly told otherwise by the user or overided in the CLAUDE.local.md file.

## Project Overview

- Full-stack TypeScript app: React + Vite + TanStack Router (frontend), Firebase (backend), Clerk (auth)
- Development: Use `mcp__shell-commands__launch-dev-all` to start servers, then monitor output streams for validation
- **DEV SERVER TROUBLESHOOTING**: If `pnpm run dev` hangs but shows "VITE ready", run `node_modules/.bin/vite &` directly. The `--open` flag causes hanging in headless environments. Test with `curl http://localhost:5173` to verify server is running even if command appears hung.
- Import alias: `@/` maps to `src/` directory
- Tailwind CSS 4, daisyUI 5: All config in `src/index.css` via CSS syntax, NOT tailwind.config.js
- Typography: Uses `@tailwindcss/typography` with `prose prose-invert` at root level, use `not-prose` to escape (e.g., for buttons/tables)
- Environment variables: Client vars need `VITE_` prefix
- Package manager: Always use `pnpm`, not npm

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

## Styling with DaisyUI

### Class Organization

- `component`: Main class (btn), `part`: Child elements (card-title), `style`: Visual variants (btn-outline)
- `behavior`: State (btn-active), `color`: Colors (btn-primary), `size`: Sizes (btn-lg)
- `placement`: Position (dropdown-top), `direction`: Orientation (menu-horizontal), `modifier`: Special (btn-wide)

### Key or Unfamiliar Components Reference

- When using a component you aren't familiar with, always check its docs page.
- `dock`: Bottom navigation bar with `dock-label` parts, see [docs](https://daisyui.com/components/dock/)
- `filter`: Radio button groups with `filter-reset` for clearing selection, see [docs](https://daisyui.com/components/filter/)
- `list`: Vertical layout for data rows using `list-row` class for each item
- `fieldset`: Form grouping with `fieldset-legend` for titles and `label` for descriptions
- `floating-label`: Labels that float above inputs when focused, use as parent wrapper
- `status`: Tiny status indicators (`status-success`, `status-error`, etc.)
- `validator`: Automatic form validation styling with `validator-hint` for error messages
- `theme-controller`: Controls page theme via checkbox/radio with `value="{theme-name}"`
- `diff`: Side-by-side comparison with `diff-item-1`, `diff-item-2`, `diff-resizer` parts
- `calendar`: Apply `cally`, `pika-single`, or `react-day-picker` classes to respective libraries
- `swap`: Toggle visibility of elements using `swap-on`/`swap-off` with checkbox or `swap-active` class
- [Modal](https://daisyui.com/components/modal/): use with HTML dialog
- [Drawer](https://daisyui.com/components/drawer/): Grid layout with sidebar toggle using `drawer-toggle` checkbox
- [Dropdown](https://daisyui.com/components/dropdown/): Details/summary, popover API, or CSS focus methods
- [Accordion](https://daisyui.com/components/accordion/): Radio inputs for exclusive opening using `collapse` class

### Usage Rules

- Use `!` suffix for forced overrides: `btn bg-red-500!`
- Responsive patterns: `lg:menu-horizontal`, `sm:card-horizontal`
- Prefer daisyUI colors (`bg-primary`) over Tailwind colors (`bg-blue-500`) for theme consistency
- Use `*-content` colors for text on colored backgrounds
- Typography plugin adds default margins to headings (h1, h2, h3, etc.) - use `mt-0` to override when precise spacing is needed

### Color System

- Semantic colors: `primary`, `secondary`, `accent`, `neutral`, `base-100/200/300`
- Status colors: `info`, `success`, `warning`, `error`
- Each color has matching `-content` variant for contrasting text
- Custom themes use OKLCH format, create at [theme generator](https://daisyui.com/theme-generator/)

## Other Guidelines

- When stuck: check official docs first (firebase.google.com/docs, tanstack.com, daisyui.com)
- Ask before installing new dependencies
- Verify responsive design at multiple breakpoints
- Document non-obvious implementation choices in this file
- Import icons from `lucide-react`
- When making identical changes to multiple occurrences, use Edit with `replace_all: true` instead of MultiEdit. Avoid MultiEdit whenever possible, it is unreliable.
- Never leave floating promisses, use void when needed
