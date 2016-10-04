var synth = (function (audioCtx){
    var masterVolume = audioCtx.createGain(),
        currentNotes = [];

    function carrier(freq){
        var gain = audioCtx.createGain(),
            osc = audioCtx.createOscillator();

        gain.gain.value = 1;
        gain.connect(masterVolume);

        osc.connect(gain);
        osc.type = 'sine';
        osc.frequency.value = freq;
        osc.start(0);

        return {
            baseFreq: freq,
            freqSocket: osc.frequency,
            gainSocket: gain,
            stop: (x) => osc.stop(x)
        }
    }

    //multiplier and depth are relative to node base freq
    function fmod(node, multiplier, depth){
        var gain = audioCtx.createGain(),
            osc = audioCtx.createOscillator(),
            freq = node.baseFreq;

        gain.connect(node.freqSocket);
        gain.gain.value = depth * freq;
        osc.frequency.value = multiplier * freq;
        osc.connect(gain);
        osc.type = 'sine';
        osc.start(0);

        return {
            baseFreq: freq,
            freqSocket: osc.frequency,
            gainSocket: gain,
            stop: (x) => osc.stop(x)
        }
    }

    //node is oscillator being modified
    //level should be under 1.0 (a percentage)
    //all other values in milliseconds
    function envelope(node, attack, decay, level, sustain, release) {
        var gain = node.gainSocket,
            param = gain.gain,
            now = audioCtx.currentTime;

        param.setValueAtTime(0, now);
        now += attack/1000;
        param.linearRampToValueAtTime(1, now);
        now += decay/1000;
        param.linearRampToValueAtTime(level, now);
        if (sustain){ 
            now += sustain/1000;
            param.linearRampToValueAtTime(zero, now);
        }

        return {
            stop: () => {
                var now = audioCtx.currentTime;
                param.cancelScheduledValues(now);
                now += release/1000;
                param.linearRampToValueAtTime(0, now); 
                return now;
            }
        };
    };

    masterVolume.gain.value = 0.05;
    masterVolume.connect(audioCtx.destination);

    return {
        noteOn: function (id, midiKey, velocity){
            var hz = Math.floor(Math.pow(2,(midiKey- 69)/12) * 440),
                carry = carrier(hz),
                mod = fmod(carry, 2, .5),
                env = envelope(carry, 200, 200, .6, 0, 500);

            //save release function
            currentNotes[id] = function(){
                var release = env.stop();
                mod.stop(release);
                carry.stop(release);
            };
        },
        noteOff: function (id){
            currentNotes[id]();
            delete currentNotes[id];
        },
        setVolume: function (val){
            masterVolume.gain.value = 0.1 * val/100;
        },
        createAnalyser: function (){
            var analyser = audioCtx.createAnalyser();
            masterVolume.connect(analyser);
            analyser.fftSize = 2048;
            return analyser;

        }
    };
})(new (window.AudioContext || window.webkitAudioContext));    
