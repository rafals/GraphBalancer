var _ = require('underscore');

var colours = {
  reset: "\x1B[0m",

  grey:    "\x1B[0;30m",
  red:     "\x1B[0;31m",
  green:   "\x1B[0;32m",
  yellow:  "\x1B[0;33m",
  blue:    "\x1B[0;34m",
  magenta: "\x1B[0;35m",
  cyan:    "\x1B[0;36m",
  white:   "\x1B[0;37m",

  bold: {
    grey:    "\x1B[1;30m",
    red:     "\x1B[1;31m",
    green:   "\x1B[1;32m",
    yellow:  "\x1B[1;33m",
    blue:    "\x1B[1;34m",
    magenta: "\x1B[1;35m",
    cyan:    "\x1B[1;36m",
    white:   "\x1B[1;37m",
  }
};

// examples:
// require('./colours').green("green terminal message");
// require('./colours').bold.red("bold red terminal message");

_(colours).each(function(val, key) {
  if(key == 'reset') return;
  if(_(val).isString()) {
    module.exports[key] = function(text) { return val + text + colours.reset; }
  } else {
    _(val).each(function(val2, key2) {
      if (module.exports[key] == undefined) { module.exports[key] = {}; }
      module.exports[key][key2] = function(text) { return val2 + text + colours.reset; }
    });
  }
});