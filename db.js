var httpRequest = require('request');
var urlParser = require('url');
var host = require('./config').set('db host');
var name = require('./config').set('db name');
var url = host + '/' + name;
var out = require('./out');

// private

function toJSON(obj) {
  // zamienia funkcje na stringi
  return JSON.stringify(obj, function(key, val) {
    if (typeof val === 'function') {
      return val.toString();
    } else {
      return val;
    }
  });
}

function parseJSON(text) {
  try {
    return JSON.parse(text);
  } catch(err) {
    if (err.type === 'unexpected_token') {
      return text;
    } else {
      throw err;
    }
  }
}

// public

var request = module.exports.request = function(config, callback) {
  /* zmiany wobec https://github.com/mikeal/request
   * pole body robi to co json + zamienia funkcje na stringi
   * callback przyjmuje 2 wartości: code i response, gdzie code to statusCode w przypadku poprawnej odpowiedzi serwera, albo null w przypadku wystąpienia błędu. W przypadku wystąpienia błędu, response przechowuje błąd. W przypadku poprawnej odpowiedzi serwera Response jest zparsowanym JSONem.
   */
  var path = config.path || '';
  var urlObj = urlParser.parse(url + path);
  urlObj.query = config.params || {};
  config.url = urlParser.format(urlObj);
  
  if(config.body && typeof config.body !== 'string') {
      config.body = toJSON(config.body);
      config.headers = config.headers || {};
      config.headers['Content-type'] = 'application/json';    
  }
  
  httpRequest(config, function(error, res, body) {
    var code = error ? 0 : res.statusCode;
    var doc = error ? error : parseJSON(body);
    callback(code, doc, res);
  });
}

var put = exports.put = function(path, doc, callback) {
  request({path: path, method: 'PUT', body: doc}, callback);
}

var post = exports.post = function(path, doc, callback) {
  request({path: path, method: 'POST', body: doc}, callback);
}

var get = exports.get = function(path, params, callback) {
  request({path: path, method: 'GET', params: params}, callback);
}

var forcePut = exports.forcePut = function(path, doc, callback) {
  put(path, doc, function(code, res) {
    if (code == 409) {
      get(path, {}, function(code, old) {
        if (code == 200) {
          doc._rev = old._rev;
          put(path, doc, callback);
        } else {
          callback(code, old);
        }
      });
    } else if (code == 201) {
      callback(code, res);
    } else {
      return callback(code, res);
    }
  });
}

var create = exports.create = function(callback) {
  request({method: 'PUT'}, callback);
}

var info = exports.info = function(callback) {
  request({method: 'GET'}, callback);
}

var dump = exports.dump = function(callback) {
  request({method: 'DELETE'}, callback);
}

exports.url = url;