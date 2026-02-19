# CRBL Fight Clock

A standalone CRBL fight clock web app that runs as a local page using Python's built-in web server.

## Run locally

```bash
python server.py
```

Open `http://localhost:8000`.

## Controls

- `Space`: start sequence / pause / resume
- `r`: reset to configured fight time
- Fight time input supports `M:SS` or `MM:SS` from `0:01` to `59:59`
