# Commit Workflow (When to Commit)

## Rule of thumb
Commit when one meaningful unit of work is complete and still passing basic checks.

## Good commit boundaries for this project
1. `chore: initialize frontend and backend structure`
2. `feat(api): implement upload endpoint`
3. `feat(api): implement retrieval and download endpoints`
4. `feat(api): add expiry cleanup job`
5. `feat(ui): build upload form and result view`
6. `feat(ui): add retrieve page with text copy and file download`
7. `docs: add README, architecture, and setup instructions`

## Commit quality checklist
- Message is specific.
- Change is small enough to review quickly.
- App still runs locally.
- No secrets in commit.
- `node_modules` not tracked.

## Message format
Use conventional commits:
- `feat:` new feature
- `fix:` bug fix
- `docs:` documentation
- `chore:` setup/tooling
- `refactor:` code cleanup without behavior change
