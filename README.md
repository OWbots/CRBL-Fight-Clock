# CRBL Fight Clock

A standalone CRBL match timer page that mirrors your Scratch workflow while adding richer timing, keyboard controls, and audio cues.

## Run locally

```bash
python3 server.py
```

Then open <http://localhost:8000>.

## Controls

- `Space`: Start (with black screen + 3-2-1-GO), pause, or resume (3-2-1-GO)
- `r`: Reset to the configured fight duration
- Duration controls: Set any value from `0:01` to `59:59`

## Match behavior implemented

- Defaults to `2:00`
- One-digit minute display below 10 minutes (e.g. `1:24`), two digits at 10+
- 5-second black pre-start screen, then `3`, `2`, `1`, `GO!`
- Pause overlay with `Match Paused`, plus resume/reset prompts
- Last 10 seconds display in red
- Last 10 seconds ticking sound while running
- Final buzzer and 2-second flashing timer at `0:00`
- Countdown buzzers for `3`, `2`, `1`; triple higher-pitch buzz for `GO!`
