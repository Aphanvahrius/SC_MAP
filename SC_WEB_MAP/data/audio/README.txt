Ambient audio for the 3D star view
==================================

Drop any audio files (.mp3, .ogg, .wav, .m4a, .flac, .opus) into this folder and
the 3D view's "Ambient space sound" toggle will pick them ALL up and loop through
them (shuffling between tracks is sequential with wrap-around).

How the files are discovered:
1. On a local dev server (VS Code Live Server) the folder listing is read
   automatically — just drop files in, no other step needed.
2. On static hosting (Netlify) directory listings don't exist, so ALSO list the
   files in playlist.json in this folder, e.g.:  ["drone1.mp3", "pads2.ogg"]
   (If playlist.json exists it is used as-is.)
3. Fallbacks if this folder yields nothing: data/ambient.mp3 / data/ambient.ogg,
   and finally the built-in procedural WebAudio drone.
