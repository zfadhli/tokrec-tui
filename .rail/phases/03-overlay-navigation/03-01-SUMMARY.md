# Summary

## AC Results

| AC | Status | Evidence |
|----|--------|----------|
| AC-1 | Pass | detailTexts expanded to 6 lines; line 5 shows "[s] Stop   [r] Restart" |
| AC-2 | Pass | stopSelectedUser()/restartSelectedUser() act on selected user directly |
| AC-3 | Pass | handleStopMode/handleRestartMode deleted, no overlay appears |

## Files Changed

| File | Change |
|------|--------|
| src/cli.ts | Expanded detailTexts to 6, added action hints, replaced overlay stop/restart with direct actions, added inNewMode guard |

## Deviations

| What | Why | Impact |
|------|-----|--------|
| Added inNewMode guard to key handler | Bug: 's'/'r' fired during new user overlay | Prevents unintended stop/restart |
