# Data Model

## Entities

### machine
Physical host running repos and collectors.
- `id`: stable key (`laptop`, `nuc1`, `nuc2`)
- `label`, `host`
- aggregate counters (commits, pushes, streak)

### repo
Canonical GitHub repository identity.
- `id` (slug)
- `name`, `owner`
- language metadata

### repoLocation
Specific clone of a repo on one machine/path.
- `id`
- `repoId` -> repo
- `machineId` -> machine
- `path`, `branch`
- `dirty`, `unpushedCommits`

### activityEvent
Timestamped behavior record.
- `id`
- `machineId`
- `repoId`
- `type`: `commit | push | status`
- `timestamp`, `message`

## Rules
- One repo can have many `repoLocation` records across machines.
- `repoLocation` is the source of dirty/unpushed state.
- `activityEvent` references canonical repo + machine, never only path.
