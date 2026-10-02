# andrewix-statusline

Styled statusline footer for [Command Code](https://commandcode.ai), matching an Oh My Posh theme.

```
~/Projects/andrewix-statusline on  main via claude-sonnet-5  93% (2h30m)
```

## Install

```bash
commandcode mods add hoanhxlyn/commandcode-statusline
```

Or add to your `~/.commandcode/settings.json`:

```json
{
  "mods": {
    "sources": [
      "hoanhxlyn/commandcode-statusline"
    ]
  }
}
```

Then `/reload` to activate.

## What it shows

| Segment | Example | Meaning |
| --- | --- | --- |
| path | `~/Projects/foo` | Current working directory |
| branch | `main` | Git branch (with  icon) |
| model | `claude-sonnet-5` | Active model ID |
| budget | `93% (2h30m)` | Remaining usage window percentage + time until reset |

## Commands

| Command | Effect |
| --- | --- |
| `/statusline` | Show current state |
| `/statusline on` | Enable |
| `/statusline off` | Disable |
| `/statusline refresh` | Refetch usage + branch |

## Colours

Matches the Oh My Posh theme:

- Path: `#56B6C2` (cyan)
- Branch: `#D4AAFC` (purple)
- Model: `#98C379` (green)
- Budget: `#DCB977` (yellow)

## Development

```bash
bun install
bun run check  # type check
```

## Usage data

Reads `~/.commandcode/auth.json` (or `COMMAND_CODE_API_KEY`) to call `api.commandcode.ai` for billing info. Read-only requests only.
