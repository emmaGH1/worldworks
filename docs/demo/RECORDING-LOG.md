# WORLDWORKS demo video: recording log

Recorded and assembled 2026-11-13 (UTC) from [STORYBOARD.md](STORYBOARD.md). Every product frame is the live app on **NEAR testnet + Sepolia**. No mock data appears; the recorder refuses to record when it does. Title card, captions, speed tags, the cut card and the end card are the only drawn parts.

## Outputs

Video files are kept outside the repo, under `/opt/ww-video/`.

| File | Length | Format |
|---|---|---|
| `/opt/ww-video/out/worldworks-demo-76s.mp4` | 76.0 s | 1920×1080, 30 fps, H.264 + AAC 48 kHz |
| `/opt/ww-video/out/worldworks-demo-15s.mp4` | 15.0 s | 1920×1080, 30 fps, H.264 + AAC 48 kHz |
| `/opt/ww-video/out/contact-sheet.png` | 15 key frames of the 76 s cut | PNG |

The HyperFrames projects are in `/opt/ww-video/ww-demo-76` and `/opt/ww-video/ww-demo-15`. Their HTML is generated from the take's `marks.json` by `/opt/ww-video/build/gen.mjs`, and the as-built edit list is `/opt/ww-video/build/edl.json`.

## Links shown in the video

| Where | Link |
|---|---|
| S5a, NEAR proof (order tx + the contract's `sign` call to `v1.signer-prod.testnet`) | https://testnet.near.rocks/tx/Gah48XxvFzjks1uDVrN5Poi3DYMc8XPp7KzRyL4csGBe |
| S5b, Sepolia proof (payout 15, nonce 15, 0.0001 ETH, Success, from `0x694Ad574…15A8b7`) | https://eth-sepolia.blockscout.com/tx/0xe1037289c605bd67737874942182d66a755ea3b1c74aaa601e818f46614f5eb5 |
| End card | https://github.com/emmaGH1/worldworks and "Live demo link in the post" |

Same transactions on the explorers the app links to (not shown in the video):

- NEAR: https://explorer.testnet.near.org/transactions/Gah48XxvFzjks1uDVrN5Poi3DYMc8XPp7KzRyL4csGBe. This is now an explorer *selector* page listing NEAR Rocks (marked "Recommended") and NearBlocks, so the video shows the transaction on NEAR Rocks. NearBlocks served a Cloudflare challenge to the headless recorder.
- Sepolia: https://sepolia.etherscan.io/tx/0xe1037289c605bd67737874942182d66a755ea3b1c74aaa601e818f46614f5eb5. Etherscan served a Cloudflare "Just a moment…" challenge to headless Chrome on every attempt (wait 15 s plus one reload), so the script used the planned Blockscout fallback. The recorder does not try to get past challenges.

Standalone payment from the same take (shown in S7, not opened on an explorer): NEAR https://explorer.testnet.near.org/transactions/2C1Qj2Kvt7wZi6Sb9LQbZPkt1qm59hbVBn7ir8fG2Jkq, Sepolia payout 16 https://sepolia.etherscan.io/tx/0xf99f6d274079eddf43e5c4d7889f214c1a19ff4ec637340cd8db684cf50cd1f1. Published machine `lemonade-57d8acb0-7f8447674319` (publish tx `EYC8kGDhbEVDJDbJUDnScYGUqR3WSRRGfR1nVQbUpT99`); sponsored session tx `AxAuCLQpB1aX3vTkLJaMVLD87MPdjxKWhNH56sqg1BTy`.

Two-RPC proofs returned by `/api/payout` during the take:

| Payout | Sepolia block | Both RPCs (ethpandaops, tenderly) |
|---|---|---|
| 15 (workshop) | 12122335 | status 1, head 12122338, depth 3 |
| 16 (standalone page) | 12122342 | status 1, head 12122345, depth 3 |

## Configuration as seen in the take

These match the README "Current configuration" and CLAIMS:

- Serve button: "seeded customer pays 0.10 NEAR + 1.32 storage fee · testnet"
- Checkout: price 0.10, storage fee 1.32, total 1.42 NEAR
- Portal payout: 0.0001 Sepolia ETH
- "Confirmed" only after the API reported matching receipts on two RPC hosts at depth 3
- The take used 2 of the epoch's 20 payouts
- Blockscout shows 21,000 gas, max fee 3 gwei and priority 1 gwei

Funds before the take: sponsor `ww-sponsor-g4-261112.testnet` 11.74 NEAR, treasury 0.514 Sepolia ETH, Sepolia base fee 15 wei. The take created a fresh sponsored session (9 NEAR).

## Takes

| Take | What | Result |
|---|---|---|
| Rehearsal | `record-demo.mjs` against the **mock** build on :4203, from a scratch copy with the mock guard disabled, to check the drag, cursor and encoder | Native drag registered (no fallback). Footage deleted, never used. |
| **Take 1** | Live workshop + standalone page + /verify, 00:13:54–00:16:56 UTC | **Used.** No `drag-fallback`, no unexpected Portal status (`awaiting_signature → signed → broadcast → confirmed`, twice). `ws.mp4`: 181.3 s. |
| Take 1, explorer pass 1 | Explorer pages recorded at the end of the take | Not used: the NEAR link opened the selector page, and Etherscan was challenged (Blockscout fallback). |
| Take 1, explorer pass 2 | `DEMO_EXPLORERS_FROM`, NEAR Rocks + Blockscout with a scroll to From | Not used: Blockscout filled its "Sponsored" row with a display ad. |
| **Take 1, explorer pass 3** | Same, with third-party ad hosts blocked (doubleclick, googlesyndication, adx.ws, …), 00:34:39 and 00:35:43 UTC | **Used.** `near.mp4` 20.1 s, `sepolia.mp4` 11.8 s. Explorer content is not altered. |

Raw files: `/opt/ww-video/take-1/` holds `ws.mp4`, `near.mp4`, `sepolia.mp4`, `marks.json` (`marks-pass1.json` and `marks-pass2.json` are the superseded explorer passes) and `stills/`. The log is `/opt/ww-video/take-1.log`.

## Step timestamps (take 1)

Source seconds are measured from the first frame of each clip (`mark.epoch − clips[label].t0`).

| Mark | Clip | Source s | UTC |
|---|---|---|---|
| ready (BROKE, recording) | ws | 0.40 | 00:13:55.3 |
| drag-start | ws | 6.59 | 00:14:01.5 |
| splitter-drop | ws | 7.79 | 00:14:02.7 |
| splitter-in (RUNNING) | ws | 8.49 | 00:14:03.4 |
| serve-click | ws | 13.19 | 00:14:08.1 |
| order-done / portal-visible (Signing on NEAR) | ws | 32.38 | 00:14:27.3 |
| portal-signed | ws | 37.68 | 00:14:32.6 |
| portal-broadcast | ws | 42.99 | 00:14:37.9 |
| portal-confirmed | ws | 83.14 | 00:15:18.1 |
| ledger-open | ws | 89.21 | 00:15:24.1 |
| open-app-click | ws | 95.17 | 00:15:30.1 |
| app-loaded | ws | 95.96 | 00:15:30.9 |
| app-ready ("Pay 1.42 NEAR") | ws | 101.05 | 00:15:36.0 |
| app-pay-click | ws | 102.36 | 00:15:37.3 |
| app-portal-signed | ws | 116.63 | 00:15:51.5 |
| app-portal-broadcast | ws | 121.49 | 00:15:56.4 |
| app-portal-confirmed | ws | 169.02 | 00:16:43.9 |
| verify-loaded | ws | 174.87 | 00:16:49.8 |
| near-loaded / near-scroll / near-signer | near | 8.30 / 13.36 / 15.47 | 00:34:48–00:34:55 |
| sepolia-fallback (Etherscan challenged) | sepolia | −8.87 | 00:35:34.1 |
| sepolia-loaded / scroll / scrolled | sepolia | 0.34 / 5.35 / 7.15 | 00:35:43–00:35:50 |

Real waits:

- Serve → order done: 19.2 s
- Signing → Signed: 5.3 s
- Signed → Broadcast: 5.3 s
- Broadcast → Confirmed (Sepolia block + 3 blocks on both RPCs): 40.2 s
- Signing → Confirmed: 50.8 s
- Standalone Pay → Confirmed: 66.7 s

## The edit (76 s cut, root times)

| Root s | Shot | Source | Speed |
|---|---|---|---|
| 0.0–3.5 | S0 title | drawn | — |
| 3.5–16.3 | S1–S3a broken machine, drag, RUNNING, Serve click (punch-in 1.15 on the socket during the drag) | ws 0.5–13.3 | 1× |
| 16.3–21.07 | S3b customer walks in, order placed | ws 13.3–32.38 | **4×**, tag "▶▶ 4× speed · real time 0.1→19.2 s" |
| 21.07–23.07 | S3c reserve 70%, "vault on chain 0.07" (punch-in 1.3) | ws 32.38–34.38 | 1× |
| 23.07–27.37 | S4 Signing → Signed → Broadcast | ws 34.38–42.99 | **2×**, tag "real time 2.0→10.6 s" |
| 27.37–32.39 | S4 waiting for 3 more blocks | ws 42.99–83.14 | **8×**, tag "· 3 more blocks on 2 RPCs · real time 10.6→50.8 s" |
| 32.39–36.25 | S4 Confirmed + receipts (punch-in 1.35) | ws 83.14–87.0 | 1× |
| 36.25–42.45 | S5a NEAR Rocks, scroll to the `sign` receipt | near 10.6–16.8 | 1× |
| 42.45–49.45 | S5b Blockscout: Success, then scroll to From | sepolia 1.0–8.0 | 1× |
| 49.45–53.45 | S6 ledger drawer | ws 87.7–91.7 | 1× |
| 53.45–57.45 | S7a–b Open as app → payment page | ws 94.2–98.2 | 1× |
| 57.45–61.35 | S7c type address, click "Pay 1.42 NEAR" | ws 99.0–102.9 | 1× |
| 61.35–62.85 | S7d cut card "⏭ 66 s later · cut · same steps as above" | drawn | — |
| 62.85–66.85 | S7e receipts, all four steps green | ws 169.2–173.2 | 1× |
| 66.85–70.85 | S8 /verify | ws 175.0–179.0 | 1× |
| 70.85–76.0 | S9 end card | drawn | — |

Every caption is checked in STORYBOARD §7 against [CLAIMS.md](../CLAIMS.md). The 15 s cut runs:

1. 0–1.7: BROKE
2. 1.7–4.1: drag → RUNNING
3. 4.1–4.8: Serve
4. 4.8–7.78: order + signing + broadcast at **10×**, with a tag
5. 7.78–8.88: cut card "⏭ 40 s later · cut", covering the three-block wait
6. 8.88–9.78: Confirmed
7. 9.78–12.58: Blockscout, push toward Success and From
8. 12.58–15: the standalone receipts, with the strip "WORLDWORKS · testnet · github.com/emmaGH1/worldworks"

Audio:

- Music bed: HeyGen music catalog track "Astral Generated Music: 38f70230" (92 s, trimmed), retrieved through the HyperFrames sign-in. 1 s fade-in, fade-out over the end card.
- SFX: bundled Pixabay-licence pop, click-soft, chime and whoosh-short, on the Splitter drop, the clicks, the Portal steps and the cut.
- No voiceover.
- Integrated loudness: −16.6 LUFS (76 s) and −17.6 LUFS (15 s). The first render, with the bed at 0.45, measured −22.1 LUFS and was replaced.

## Commands

From `app/`, with secrets loaded only through `--env-file` and never printed:

```sh
API_PORT=3009 node --env-file=/opt/ww-secrets/live.env --import tsx scripts/dev-api.ts
VITE_CONTRACT_ID=ww-portal-261112.testnet VITE_RELAYER_URL=http://127.0.0.1:3009 npx vite build --outDir /data/tmp/ww-demo/dist-live --emptyOutDir
npx vite preview --outDir /data/tmp/ww-demo/dist-live --host 127.0.0.1 --port 4202 --strictPort
UI_BASE=http://127.0.0.1:4202 INSTABOX_HEADLESS=1 DEMO_OUT=/opt/ww-video/take-1 node ui-tests/record-demo.mjs
# explorer pages only, no new transactions:
INSTABOX_HEADLESS=1 DEMO_OUT=/opt/ww-video/take-1 DEMO_EXPLORERS_FROM=/opt/ww-video/take-1 node ui-tests/record-demo.mjs
```

Screens, as viewport stills at 1920×1080 → 1440×810 palette PNG (`live-03-pending` is a frame of `ws.mp4` at 34.0 s, because the script took no still there):

```sh
ffmpeg -i stills/<name>.png -vf "scale=1440:810:flags=lanczos,split[a][b];[a]palettegen=max_colors=192:stats_mode=full[p];[b][p]paletteuse=dither=none" docs/design/screens/<name>.png
```

Assembly and render. ffmpeg/ffprobe are the static builds under `~/.local/bin`. `TMPDIR` is moved off the 2 GB `/tmp` tmpfs because the render refuses to start when `/tmp` is low on space.

```sh
node /opt/ww-video/build/gen.mjs
cd /opt/ww-video/ww-demo-76 && npx hyperframes check --json        # 0 errors (warnings: nested media basis info, 20 px URL bar text)
export TMPDIR=/opt/ww-video/tmp HYPERFRAMES_EXTRACT_CACHE_DIR=/opt/ww-video/cache
npx hyperframes render --quality delivery --frames-cache-dir /opt/ww-video/cache -o /opt/ww-video/out/worldworks-demo-76s.mp4
cd /opt/ww-video/ww-demo-15 && npx hyperframes render --quality delivery --frames-cache-dir /opt/ww-video/cache -o /opt/ww-video/out/worldworks-demo-15s.mp4
ffprobe -v error -show_entries format=duration -of csv=p=0 /opt/ww-video/out/worldworks-demo-76s.mp4   # 76.000000
```

## Notes and limits

- **Viewport.** Recorded at 1440×810 CSS px with device scale 4/3, so frames are 1920×1080 and UI text is about 33% larger than with a 1920 px viewport.
- **Cursor and drag image.** The cursor is drawn by the script, and so is the semi-transparent chip under it during the drag (a clone of the real palette chip). Headless Chrome paints neither. Both appear in the refreshed `docs/design/screens/live-*.png`.
- **Ads.** Blockscout ads were blocked for the final explorer pass; nothing else on the explorer pages was changed. Blockscout also lists the native transfer under "Tokens transferred … 100,000,000,000,000 Unnamed token". That is Blockscout's own display of the 0.0001 ETH value transfer and appears briefly at the bottom of S5b.
- **Not shown.** The reserve "Withdraw" control is visible in the workshop footage but is never used or captioned.
