'use strict';

var allKeyBindings = [];

function RegisterKeyBindings(...bindings) {
  for (var b of bindings) {
    var mods = b[0];
    var key = b[1];
    var func = b[2];

    var e = {
      ctrlKey: false,
      shiftKey: false,
      metaKey: false,
      altKey: false
    }

    if (mods.indexOf('Ctrl') > -1) e.ctrlKey = true;
    if (mods.indexOf('Shift') > -1) e.shiftKey = true;
    if (mods.indexOf('Alt') > -1) e.altKey = true;
    if (mods.indexOf('Cmd') > -1) e.metaKey = true;

    if (key.indexOf('code:') > -1) {
      e.keyCode = key.split(':')[1];
    } else {
      e.key = key;
    }
    allKeyBindings.push({event: e, func: func});
  }
}

document.documentElement.addEventListener('keydown', e => {

  for (var oneKeyBinding of allKeyBindings) {
    var matches = true;
    for (var prop in oneKeyBinding.event) {
      if (e[prop] != oneKeyBinding.event[prop]) {
        matches = false;
        break;
      }
    }
    if (matches) {
      oneKeyBinding.func.apply(null);
    }
  }
});

exports.RegisterKeyBindings = RegisterKeyBindings;
