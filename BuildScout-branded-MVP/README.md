# BuildScout

A build-first learning discovery MVP for the TinyFish × UCL AI Society buildathon.

## What it does

- Collects interests (including custom skills and project ideas), skill level, time, budget, hardware and goals.
- Lets you search and multi-select interests, hardware and goals, with select-all and clear controls.
- Generates project-focused searches across selected interests and maker/open-source sources through TinyFish Search.
- Optionally makes one Gemini web-grounded discovery call per search and merges its cited project pages with the TinyFish results.
- Deduplicates, diversifies by source, and ranks candidate projects using the fetched project content.
- Extracts skills and tools dynamically from project pages instead of relying on a fixed technology list.
- Reads the strongest candidate pages through TinyFish Fetch.
- Builds personalised project cards and a four-stage build path from the fetched evidence.
- Lets you search and sort project results, shortlist options, and filter to your shortlist.
- Creates a real TinyMonitor topic monitor from the same profile.

## Run

Requires Node 20+.

1. Copy `.env.example` to `.env`.
2. Set `TINYFISH_API_KEY` to your TinyFish key.
3. Optionally set `GEMINI_API_KEY` to a Google AI Studio API key to include Gemini-discovered projects.
4. Run `node server.js`.
5. Open `http://localhost:3000`.

API keys are only read by the server and are never sent to the browser. Gemini search grounding may incur usage charges depending on your Google account and billing setup; the app makes one Gemini API call for each search, but does not enforce an account-wide spending cap.

## Architecture

Browser → local Node server → TinyFish Search → TinyFish Fetch → ranking/extraction → browser

Browser → local Node server → optional Gemini + Google Search grounding → cited project pages

Browser → local Node server → TinyFish Monitor

## Notes

This is intentionally dependency-light for a 90-minute buildathon. It uses the TinyFish REST APIs directly rather than adding a framework or database that would not improve the demo.
