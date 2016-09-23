"use strict";
var mmlParse = (function () {
    //syntax symbols
    var modifiers = "+-#&.",
        noteEvents = "abcdefgr",
        stateEvents = "<>otvl,",
        midiMap = {
            c: 0,
            d: 2,
            e: 4,
            f: 5,
            g: 7,
            a: 9,
            b: 11
        };

    //strips away all non numbers then parseInt
    function getIntData(str){
        var x = str.replace(/[^0-9]/g,"");
        return parseInt(x);
    }

    function getMidiKey(octave, clause){
        var key = clause.charAt(0);
        if (key === 'r'){
            return null;
        }

        return octave * 12 
            + midiMap[key] 
            //sharps
            + (clause.match(/[\+#]/g) === null?0:1)
            //flats
            - (clause.match(/[\-]/g) === null?0:1)
    }

    
    //parse
    return function (mmlText) {
        //clean the mml
        var mml = mmlText.replace(/\#.*$/gm, o => "@".repeat(o.length)).toLowerCase();

        //state
        var tempo = 60,
            tiesNextNote = 0,
            noteLength = 4, 
            octave = 5,
            volume = 127,
            track = 0,
            time = 0, //current time tick in millis
            notes = []; //accumulate notes as we are parsing

        function stateEvent(clause){
            var cmd = clause.charAt(0);
            if (cmd  === '>'){
                octave++;
            }else if (cmd  === '<'){
                octave--;
            }else if (cmd  === 'o'){
                octave = getIntData(clause);
            }else if (cmd  === 't'){
                tempo = getIntData(clause);
            }else if (cmd  === 'l'){
                noteLength = getIntData(clause);
            }else if (cmd  === 'v'){
                volume = getIntData(clause);
            }else if (cmd  === ','){
                track++;
                time = 0;
            }
    
        }

        function noteEvent(clause, index){
            //calculate duration
            var duration = getIntData(clause)||noteLength,
                durationMillis = 240 / (tempo * duration) * 1000,
                numDots = (clause.match(/\./g)||[]).length,

            //account for dotted notes
            durationMillis = durationMillis * Math.pow(1.5, numDots); 

            //if this is a tie, save duration and add to next note
            if (clause.indexOf("&") > -1){
                tiesNextNote += durationMillis;
            }else{
                durationMillis += tiesNextNote;
                tiesNextNote = 0;
                let midiKey = getMidiKey(octave, clause);
                if (midiKey){
                    notes.push({
                        //some meta data, perhaps for character higlighting
                        foundAt: index,
                        clause: clause,
                        track: track,

                        //sound data         
                        volume: volume,
                        midiKey: midiKey,
                        startTime: time,
                        duration: durationMillis
                    });
                }
                   
                time += durationMillis;
            }
        }

        function parse(clause, index){
            if (noteEvents.indexOf(clause.charAt(0)) > -1){
                noteEvent(clause, index);
            } else if (stateEvents.indexOf(clause.charAt(0)) > -1){
                stateEvent(clause,index);
            }else{
                throw "unknown clause: "+clause +" at character: "+index;
            }
        }

        var events = stateEvents + noteEvents,
            prevEvent = -1;
        for (let i=0;i<mml.length;i++){
            if (events.indexOf(mml.charAt(i)) > -1) {
                if (prevEvent > -1){
                    parse(mml.substring(prevEvent,i),prevEvent);
                }
                prevEvent = i;
            }
        }
        parse(mml.substring(prevEvent,mml.length), prevEvent);

        return notes;
   }; 
})();


//add timings handler using webworker api
this.addEventListener("message", (function() {
    var timers = [],
        methods = {
            stop: function(){
                timers.forEach(id => clearTimeout(id));
                timers = [];
            },
            play: function (mml){
                var endTime = 0;
                mmlParse(mml).forEach(function (note){
                    timers.push(setTimeout(function (){
                        self.postMessage({type:"note-on", data:note});
                        setTimeout(function (){
                            self.postMessage({type:"note-off", data:note});
                        }, note.duration);
                    }, note.startTime));

                    endTime = Math.max(endTime, note.startTime+note.duration);
                });
                timers.push(setTimeout(function (){
                    self.postMessage({type:"end"});
                }, endTime));
            }
        };

    return function(ev){
        var msg = ev.data;
        methods[msg.type](msg.data);
    }
})());
