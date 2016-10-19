# mml-synth 

html based synth and music player.  The idea is to create a diagram tool which will define the tone shape - the synthesis part. Then the mml player will use play the notes with the given tone.  For now index.html has a hard coded tone, working on the diagraming part in editor.html with jsplumb - eventually will be merged into one page.

The music player is using web-workers so that the setTimeouts will stay accurate even when the page loses focus.

## [demo](https://richardwa.github.io/mml-synth/)
