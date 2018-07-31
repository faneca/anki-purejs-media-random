// window onload emulation (Anki's a little special)
setTimeout(function() {
  // Get (and check) the script's required parameters.
  var this_script;
  var count;

  function show_error(errorTxt) {
    var parentNode = this_script? this_script.parentNode: document.body;
    var errorDiv = document.createElement("div");
    var textNode = document.createTextNode("* random-media.js - " + errorTxt);
    errorDiv.id = "random-media-warning";
    errorDiv.appendChild(textNode);
    parentNode.appendChild(errorDiv);
  }

  for (var i = 0; i < document.scripts.length; i++) {
    var script = document.scripts[i];
    var cnt = script.getAttribute("random-media-count");
    if (cnt !== null) {
      this_script = script;
      count = parseFloat(cnt);
      break;
    }
  }

  if (typeof this_script === "undefined") {
    show_error("Error: either you forgot to include the 'random-media-count' " +
               "parameter or I can't properly work on this Anki client :-(");
    return;
  }

  if (isNaN(count) || (count | 0) !== count || count == 0) {
    show_error("Error: 'random-media-count' must be an integer > 0");
    return;
  }


  // Try to persist data to the back side, if at the front;
  // try to read that data if at the back.

  var persist_datastore = function(datastore) {
    window.console.anki_datastore = datastore;
  };
  var get_datastore = function(datastore) {
    return window.console.anki_datastore || {};
  };

  try {
    if (window.sessionStorage) {
      persist_datastore = function(datastore) {
        sessionStorage.setItem('anki_datastore', JSON.stringify(datastore));
      }
      get_datastore = function(datastore) {
        json_datastore = sessionStorage.getItem('anki_datastore');
        return json_datastore? JSON.parse(json_datastore): {};
      }
    }
  } catch (e) {
    if (!(e instanceof Error && e.message.substr(0, 13) === "SecurityError")) {
      throw ex;
    }
  }


  // Init the datastore.
  // To workaround the problem of the desktop client preview windows,
  // we'll need a custom random() implementation which is time-seedable.
  // Lehmer's LCG implementation is more than enough for our purposes.
  // We chose to base our seed on current time in whole seconds since the
  // epoch (new Date/1000). More than that seems uneasy for reviews, and
  // while this works for the template editor window (except for a negligible
  // probablity), which shows front and back at the same time, it won't work
  // for the previewer launched from the card explorer: we can't control how
  // much time passes until the back is shown and we can't save the state as
  // in a "real" review; and even if we could we still can traverse the list
  // of cards backwards, so it wouldn't make sense anyway :-/.

  function LCG(seed) {
    function lcg(a) { return a * 48271 % 2147483647; }
    var seed = seed ? lcg(seed) : lcg(Math.random());
    return function() { return (seed = lcg(seed)) / 2147483648; }
  }

  function init_datastore(datastore) {
    datastore.options_count = count;
    datastore.option_chosen = Math.floor((LCG(new Date/1e3|0)()) * count) + 1;
    datastore.current_time = null;
    datastore.playback_rate = 1;
    datastore.looping = false;

    persist_datastore(datastore);
  };


  // Time to check what to do -- based on which side of the card we are

  var atfrontside = !document.getElementById("answer");
  var datastore = get_datastore();

  if (atfrontside) {
    init_datastore(datastore);
  } else if (typeof datastore.options_count === "undefined") {
    init_datastore(datastore);
    show_error("Preview window - Synchonization with front side not granted");
    // But keep going, this is bearable.
  }


  // Finally, use all the obtained data to manipulate the page.

  var option_fills = document.getElementsByClassName("random-media-option");
  var count_fills = document.getElementsByClassName("random-media-count");
  var unhides = document.getElementsByClassName("random-media-hidden-" +
                                                datastore.option_chosen);

  // Fill placeholders with corresponding persisted data
  for (var i = 0; i < option_fills.length; i++) {
    option_fills[i].innerHTML = datastore.option_chosen;
  }
  for (var i = 0; i < count_fills.length; i++) {
    count_fills[i].innerHTML = datastore.options_count;
  }


  // Implement looping of the media.

  var loopm = document.getElementById("random-media-loop");
  loopm.addEventListener("change", function(e) {
    for (var i = 0; i < medias.length; i++) {
      var elem = medias[i];
      if (this.checked) {
        elem.setAttribute("loop", true);
        elem.play();
      } else {
        elem.removeAttribute("loop");
      }
    }
  });


  // Implement replay at different speeds.

  var playnorm = document.getElementById("random-media-play");
  var playslow = document.getElementById("random-media-play-slow");
  var slow_rate = parseFloat(playslow.getAttribute("data-playrate"));

  if (isNaN(slow_rate) || (slow_rate | 0) !== slow_rate || slow_rate == 0) {
    playslow.setAttribute("data-playrate", (slow_rate = 0.5).toString());
    // show_error("Warning: incorrect 'data-playrate' coerced to 0.5");
  }
  playnorm.addEventListener("click", function (e) {
    for (var i = 0; i < medias.length; i++) {
      medias[i].addEventListener("seeked", function seeked(e) {
        this.removeEventListener("seeked", seeked);
        this.playbackRate = 1;
        this.play();
      });
      medias[i].currentTime = 0;
    }
  });
  playslow.addEventListener("click", function (e) {
    for (var i = 0; i < medias.length; i++) {
      medias[i].addEventListener("seeked", function seeked(e) {
        this.removeEventListener("seeked", seeked);
        this.playbackRate = slow_rate;
        this.play();
      });
      medias[i].currentTime = 0;
    }
  });


  // Show the elements corresponding to the chosen option, and if at the
  // frontside, play the media.
  // Also adds a hook so the video replay controls are shown when finished
  // and do what they are supposed to.

  var playcontrols = document.getElementById("random-media-play-controls");
  var medias = [];

  for (var i = 0; i < unhides.length; i++) {
    var elem = unhides[i];
    elem.classList.add("shownforced");

    if (elem.play) {
      medias.push(elem);

      elem.addEventListener("ended", function(e) {
        if (this.getAttribute("loop"))
          return;
        playcontrols.classList.add("shownforced");
        this.load();
      });

      elem.addEventListener("play", function(e) {
        playcontrols.classList.remove("shownforced");
      });

      elem.src = elem.getAttribute("data-src"); // Preload only shown videos
      elem.load();

      elem.addEventListener("timeupdate", function(e) {
        // Try to pause a little before the true end to avoid flickering
        if (!this.getAttribute("loop") && 
            this.currentTime >= this.duration - 0.1) {
          playcontrols.classList.add("shownforced");
          this.pause();
        }
        // Save the state to resume playing on the back side
        if (atfrontside && this.currentTime !== 0) {
          datastore.current_time = this.currentTime;
          datastore.playback_rate = this.playbackRate;
          datastore.looping = loopm.checked;
          persist_datastore(datastore);
        }
      });
      elem.play();

      if (!atfrontside) {
        // Resume the playing as we left it on the front side
        var ctime = datastore.current_time;
        if (ctime !== null) {
          elem.addEventListener("seeked", function seeked(e) {
            this.removeEventListener("seeked", seeked);
            this.playbackRate = datastore.playback_rate;
            if (datastore.looping)
              loopm.click();
            else
              this.play();
          });
          elem.addEventListener("canplay", function canplay(e) {
            this.removeEventListener("canplay", canplay);
            this.currentTime = (ctime !== null)? ctime: this.duration + 1;
            // + 1 => Make reeeaaally sure we position the video at the end
          });
        }
      } // if (atfrontside) + else
    } // if (elem.play) # if it is a video
  } // for (unhides)

}, 0);  // setTimeout (emulated window onload)
