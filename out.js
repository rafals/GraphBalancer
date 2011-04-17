var colours = require('./colours');
var sys = require('sys');
var _ = require('underscore');

var exports = module.exports;

var info = exports.info = function(message) {
  sys.puts(colours.cyan(message));
}

var ok = exports.ok = function(message) {
  sys.puts(colours.green(sys.inspect(message)));
}

var warning = exports.warning = function(message) {
  sys.puts(colours.yellow(sys.inspect(message)));
}

var error = exports.error = function(message) {
  sys.puts(colours.red(sys.inspect(message)));
}

var expect = exports.expect = function(expected, code, doc) {
  if(code == expected) {
    ok(doc);
  } else if (code) {
    warning(doc);
  } else {
    error(doc);
  }
}