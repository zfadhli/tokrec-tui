# Summary

## AC Results

| AC | Status | Evidence |
|----|--------|----------|
| AC-1 | Pass | Sidebar changed to ScrollBox with scrollY:true; child extraction uses wrapper > viewport > content path |
| AC-2 | Pass | scrollSidebarToSelected() adjusts scrollTop based on viewport height and selectedIndex |

## Files Changed

| File | Change |
|------|--------|
| src/cli.ts | Sidebar Box → ScrollBox; added scrollSidebarToSelected(); updated addNewUser() for ScrollBox structure |

## Deviations

| What | Why | Impact |
|------|-----|--------|
| None | — | — |
