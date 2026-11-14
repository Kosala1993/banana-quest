# Cartoon audio update

## Repository review

The active `develop` checkout had no audio implementation or assets. The existing implementation was found in `feature/funny-game-sounds` (commit `f7cc10e`). Its audio integration and public manager API were used as the basis for this update on the current checkout; no branch was switched or merged. No server, puzzle, authentication, database, scoring, life or checkpoint logic was changed.

That implementation generated oscillator tones and noise, not external recordings. Its error and Game Over presets used descending sawtooth waves; damage and bridge presets used square waves. Continuous oscillator/noise drones accompanied the scenes, including a low cave drone. These were identified as likely sources of harshness or an ominous atmosphere from code inspection, not a listening audit. No working Freesound integration was present (only an example key on the feature branch).

## Sources and licenses

All installed audio is CC0 1.0: https://creativecommons.org/publicdomain/zero/1.0/

* **K** — Kenney, [Interface Sounds](https://kenney.nl/assets/interface-sounds), downloaded from the [author's OpenGameArt upload](https://opengameart.org/content/interface-sounds): https://opengameart.org/sites/default/files/kenney_interfaceSounds.zip . Original filenames are preserved. Bundled license: `public/audio/LICENSE-Kenney-Interface.txt`.
* **J** — Kenney, [Music Jingles](https://kenney.nl/assets/music-jingles), downloaded from [85 Short music jingles](https://opengameart.org/content/85-short-music-jingles): https://opengameart.org/sites/default/files/jingleSounds_Kenney.zip . Bundled license: `public/audio/LICENSE-Kenney-Jingles.txt`. `jingles_STEEL00.ogg` comes from `OGG/jingles_STEEL/`.
* **B** — isaiah658, [Ambient Bird Sounds](https://opengameart.org/content/ambient-bird-sounds), CC0 as stated on the asset page. https://opengameart.org/sites/default/files/birds-isaiah658.ogg saved as `birds.ogg`, unmodified.
* **W** — TyberiusGames, [Waterflow Sound](https://opengameart.org/content/waterflow-sound), CC0 as stated on the asset page. https://opengameart.org/sites/default/files/waterflow.mp3 saved under its original name, unmodified.
* **P** — farfadet46, [bubbles 'pop'](https://opengameart.org/content/bubbles-pop), CC0 as stated on the asset page. https://opengameart.org/sites/default/files/pop.ogg saved under its original name, unmodified.
* **T** — TinyWorlds, [Different steps on wood, stone, leaves, gravel and mud](https://opengameart.org/content/different-steps-on-wood-stone-leaves-gravel-and-mud), CC0 as stated on the asset page. https://opengameart.org/sites/default/files/%5Bkdd%5DDifferentSteps_0.zip . `wood01.ogg` is preserved unmodified from the archive.

Verified and retrieved 2026-11-14. Kenney's old direct ZIP URLs returned HTML rather than audio; its signed-link endpoint returned HTTP 403. OpenGameArt supplied the usable packs. No commercial-game or movie audio was used. Credits to the authors are voluntary under CC0 and retained here.

## Event inventory

Previous sounds below refer to the feature branch, since develop had no sounds. “Installed” means a real licensed asset and event mapping exist, with automated playback checks; it does not mean a human listening review has been completed. All filenames are relative to `public/audio/`.

| Game event | Previous sound | Replacement | Source / license | Audio filename | Result |
|---|---|---|---|---|---|
| Start Adventure | Rising triangle/sine sweeps | Short steel-instrument jingle | J / CC0 | jingles_STEEL00.ogg | Installed |
| Correct Answer | Triangle/sine sweeps | Short confirmation cue | K / CC0 | confirmation_001.ogg | Installed |
| Incorrect Answer | Descending sawtooth/triangle | Quiet plucked boop | K / CC0 | pluck_002.ogg | Installed |
| Lose a Life | Low square/triangle sweeps | Soft bong | K / CC0 | bong_001.ogg | Installed |
| Mountain Climbing | Low triangle sweeps | Short plucked hop cue | K / CC0 | pluck_001.ogg | Installed |
| Bridge Crossing | Square/triangle sweep and drone | Quiet wooden footstep | T / CC0 | wood01.ogg | Installed; separate creak missing |
| Dark Forest | Synthesized tones/noise | Recorded birds, soft ambient loop | B / CC0 | birds.ogg | Installed; no monkey call |
| Hidden Cave | Low sine/triangle and drone | Short drop cue; no drone | K / CC0 | drop_001.ogg | Installed; no echo processing |
| Waterfall Crossing | Synthesized tones/sawtooth drone | Quiet recorded flowing water | W / CC0 | waterflow.mp3 | Installed; separate splash missing |
| Ancient Gate | Sine/triangle sweeps and drone | Glass chime | K / CC0 | glass_001.ogg | Installed |
| Obstacle Completed | No separate cue | Confirmation stinger | K / CC0 | confirmation_002.ogg | Added |
| Level 1 Victory | Rising triangle/sine sweeps | Steel-instrument celebration jingle | J / CC0 | jingles_STEEL00.ogg | Installed; no applause |
| Game Over | Low descending sawtooth/triangle | Brief minimize/downward UI cue | K / CC0 | minimize_001.ogg | Partial: trombone/wah-wah missing |
| Restart Game | Same as Start | Brief maximize/upward UI cue | K / CC0 | maximize_001.ogg | Installed |
| Button Click | Double triangle tone; duplicated handlers | Quiet bubble pop | P / CC0 | pop.ogg | Installed |
| Logout | Generic UI tone | Short back/goodbye UI cue | K / CC0 | back_001.ogg | Installed |

The natural recordings are not represented as jungle-specific species recordings. A friendly monkey call, wooden bridge creak, separate splash, trombone and applause are not bundled. The attempted `splash2.wav` URL returned HTTP 404. Approximate replacements are disclosed above instead of being mislabeled as those recordings.

## Playback and verification

The manager retains the feature branch's exported methods and default setting values (effects 0.9, ambience 0.55). Both mute buttons work together. Separate volume sliders expose the existing volume API. Zero now means zero. No existing persistence behavior was removed; the old implementation did not persist audio settings.

Foreground cues use one sequential lane with at most two scheduled voices; stale pending loads are invalidated on mute, restart and terminal outcomes. Ambience uses a separate, much quieter channel (maximum gain 0.09). Ordinary cues are capped at 0.25–1 second; start/victory allow 2.5/3.5 seconds (the bundled steel jingle itself lasts 0.933 seconds). Several source UI cues are naturally shorter than 0.2 seconds. Playback applies short attack/release fades. Continuous drones are removed; only forest birds and waterfall water loop. Other areas use event cues with silent backgrounds. Background audio stops when leaving gameplay or hiding the tab. Loading, decoding, autoplay and unsupported-Web-Audio failures never block game requests or throw into gameplay. Failed assets can retry later, with a five-second fetch timeout.

`test/audio.test.js` checks actual app event handlers with a stub DOM and checks the audio manager with a mock Web Audio context: all six movement cues, correct/wrong answers, life loss, boundary transitions, obstacle completion, victory, Game Over, start, restart, logout, ordering, overlap limits, mute/unmute, volume adjustment including zero, quiet ambience, same-scene reuse, missing asset recovery and unsupported audio. It checks installed assets have audio headers rather than downloaded HTML. Existing server tests cover the protected game rules and account behavior.

Final automated result: `npm.cmd test` passed 8/8 tests, including all 6 pre-existing tests. `npm.cmd run check` and syntax checks for both frontend JavaScript modules passed. These are automated event/playback-contract checks, not a real browser or speaker audition. Browser autoplay behavior, actual decoding on target devices, perceived timbre, loop seams and comfortable listening levels still need a listening pass before calling the sound design fully verified.
