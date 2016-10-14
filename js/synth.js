"use strict"
var synth = (function (audioCtx){
    var masterVolume = audioCtx.createGain(),
        currentNotes = [];

    function carrier(freq){
        var gain = audioCtx.createGain(),
            osc = audioCtx.createOscillator();

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

    //parameter constructor
    function p(duration, level, exponential = true){
        if (exponential){
            return {
                ramp: "exponentialRampToValueAtTime",
                duration: duration,
                //exponentials cannot be set to zero
                level: level==0?0.0001:level
            };
        }
        
        return {
            ramp: "linearRampToValueAtTime",
            duration: duration,
            level: level
        };
    }

    //node is oscillator being modified
    //phases: adsr env
    function adsr(node, ...phases) {
        var gain = node.gainSocket,
            param = gain.gain,
            now = audioCtx.currentTime;

        function schedule(state){
            now += state.duration/1000;
            param[state.ramp](state.level, now);
        }
        param.cancelScheduledValues(now);
        param.value = 0;
        //schedule all except last phase
        phases.slice(0,phases.length - 1).forEach(schedule);
        return {
            stop: () => {
                now = audioCtx.currentTime;
                param.cancelScheduledValues(now);
                //schedule last phase - release
                schedule(phases[phases.length -1]);
                return now;
            }
        };
    };

    masterVolume.gain.value = 0.05;
    masterVolume.connect(audioCtx.destination);

    return {
        noteOn: function (id, midiKey, velocity){
            var hz = Math.floor(Math.pow(2,(midiKey- 69)/12) * 440),
                level = velocity/127,
                carry = carrier(hz),
                mod = fmod(carry, 2.1, .3),
                env = adsr(carry, p(10,level,false), p(500,0,false));

            //save release function
            currentNotes[id] = function(){
                var release = env.stop()+.01;
                carry.stop(release);
                mod.stop(release);
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
