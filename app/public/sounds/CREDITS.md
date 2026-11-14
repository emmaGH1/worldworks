# Sound credits

Kenney, Interface Sounds 1.0. CC0 1.0: https://creativecommons.org/publicdomain/zero/1.0/
Source: https://kenney.nl/assets/interface-sounds
Downloaded mirror: https://opengameart.org/sites/default/files/kenney_interfaceSounds.zip
The archive License.txt explicitly identifies Kenney and CC0.

| Shipped files (both formats) | Original archive file | Licence |
|---|---|---|
| click_003.ogg, click_003.mp3 | Audio/click_003.ogg at the source URLs above | CC0 1.0 |
| drop_002.ogg, drop_002.mp3 | Audio/drop_002.ogg at the source URLs above | CC0 1.0 |
| confirmation_002.ogg, confirmation_002.mp3 | Audio/confirmation_002.ogg at the source URLs above | CC0 1.0 |
| error_004.ogg, error_004.mp3 | Audio/error_004.ogg at the source URLs above | CC0 1.0 |
| glass_001.ogg, glass_001.mp3 | Audio/glass_001.ogg at the source URLs above | CC0 1.0 |
| select_002.ogg, select_002.mp3 | Audio/select_002.ogg at the source URLs above | CC0 1.0 |
| scroll_002.ogg, scroll_002.mp3 | Audio/scroll_002.ogg at the source URLs above | CC0 1.0 |
| tick_002.ogg, tick_002.mp3 | Audio/tick_002.ogg at the source URLs above | CC0 1.0 |
| maximize_003.ogg, maximize_003.mp3 | Audio/maximize_003.ogg at the source URLs above | CC0 1.0 |
| open_002.ogg, open_002.mp3 | Audio/open_002.ogg at the source URLs above | CC0 1.0 |

Converted to mono 44.1 kHz, 80 kbps, loudnorm target −16 LUFS / −1 dBTP. Short transients may not reach integrated target; see measured peaks in evidence. Music is an original procedural arrangement for WORLDWORKS: drums, bass, chords, melody. No external music assets.

## GAME-10 recorded music

- **Happy Clappy Loop** — **OwlishMedia**, [actual source and licence page](https://opengameart.org/content/happy-clappy-loop).
- Licence: **CC0 1.0 Universal**, https://creativecommons.org/publicdomain/zero/1.0/ . Verified on the source page on 2026-11-14: Author OwlishMedia; License(s) CC0. The author describes this as a seamless game loop adapted from *Cat's Sky*.
- Original: https://opengameart.org/sites/default/files/HappyClappyLoop.wav
- Shipped: `happy-clappy.ogg` (Vorbis quality 4) and `happy-clappy.mp3` (128 kbps fallback), stereo 44.1 kHz. Normalized with a static +5.45 dB gain (original measured −21.45 LUFS, target −16 LUFS). Static gain preserves the exact 17.440635-second source length, without loudnorm padding, trimming or fades. Combined 635,500 bytes.
- Playback: decoded AudioBuffer loop, synchronized dark/build and bright/factory low-pass layers, crossfaded into the music bus. Decoding avoids media restart gaps and honors MP3 encoder padding. Existing procedural score is used only if both music files fail to load.
