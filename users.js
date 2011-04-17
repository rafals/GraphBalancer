#!/usr/bin/env node

var db = require('./db');
var _ = require('underscore');
var out = require('./out');

// private

var design = {
  language: 'javascript',
  
  views: {
    
    all: {
      // wyrzucamy informację o relacji sponsora z każdym ze spongerów (w obie strony)
      map: function(doc) {
        // pomijamy usunięte transakcje
        if(!doc.deleted_at) {
          // kasa przelana między nadawcą i jednym z odbiorców
          var singleCost = doc.cost/doc.to.length;

          // parsowanie daty w created_at
          var date = new Date(doc.created_at);
          var year = date.getFullYear();
          var month = date.getMonth(); // indeksowany od 0
          var monthIndex = year*12+month; // numer miesiąca od roku 0 indeksowany od 0

          // tworzymy statystyki transakcji
          var stats = {};
          stats[monthIndex] = 1;

          var sponsorID = doc.from;
          var sponger, sponsor;

          // dla każdego odbiorcy
          doc.to.forEach(function(spongerID) {
            // resetujemy 2 dokumenty wynikowe
            sponsor = {};
            sponger = {};
            // gdy odbiorca jest jednocześnie nadawcą to informację o aktywności
            // emitujemy tylko raz
            if(spongerID == sponsorID) {
              sponsor[sponsorID] = {balance: 0, transactions: 1, transferred: singleCost, stats: stats};
              emit(sponsorID, sponsor)
            // w przeciwnym wypadku emitujemy dla obu stron
            } else {
              // nadawca -> odbiorca
              sponsor[spongerID] = {balance: -singleCost, transactions: 1, transferred: singleCost, stats: stats};
              emit(sponsorID, sponsor);
              // odbiorca -> nadawca
              sponger[sponsorID] = {balance: singleCost, transactions: 1, transferred: singleCost, stats: stats};
              emit(spongerID, sponger);
            }
          });
        }
      },
      
      reduce: function(keys, parts) {
        
        // nieczytelne, ale możliwie wydajne scalanie miesięcznych statystyk transakcji
        function mergeStats(as, bs) {
          // znajdujemy ostatni zarejestrowany miesiąc
          var lastMonth = 0;
          // najpierw w lewym hashu
          for(key in as) {
            if(key > lastMonth) { lastMonth = key; }
          }
          // potem w prawym hashu
          // i jednoczesnie przerzucamy transakcje z prawego hasha do lewego
          for(key in bs) {
            if(as[key]) {
              as[key] += bs[key];
            } else {
              if(key > lastMonth) { lastMonth = key; }
              as[key] = bs[key];
            }
          }
          var result = {};
          // wyciągamy ilości transakcji z 6 ostatnich miesięcy (lub 0 przy braku danych)
          for(var limit = lastMonth - 6; lastMonth > limit; lastMonth--) {
            result[lastMonth] = as[lastMonth] || 0;
          }
          return result;
        }
        
        function merge(a, b) {
          if (a === undefined) { return b; }
          //a.first = a.first < b.first ? a.first : b.first;
          //a.lastMonth = a.lastMonth < b.lastMonth ? b.lastMonth : a.lastMonth
          a.balance += b.balance;
          a.transferred += b.transferred;
          a.transactions += b.transactions;
          a.stats = mergeStats(a.stats, b.stats);
          return a;
        }
        
        var friends = {};
        var p, part, id;
        for(p in parts) { // parts = [{1: {}, 2: {}, 3: {}}, {4: {}, 5: {}, 6: {}}]
          part = parts[p];
          for(id in part) { // part = {1: {}, 2: {}, 3: {}}
            friends[id] = merge(friends[id], part[id]);
          }
        }
        
        return friends;
      },
    },
     
  },
}

// public

var exports = module.exports;

var setup = exports.setup = function(callback) {
  db.forcePut('/_design/users', design, callback);
}

var all = exports.all = function(params, callback) {
  db.get('/_design/users/_view/all', _.extend({group: true}, params), function(code, doc) {
    if (code == 200) {
      var result = {};
      doc.rows.forEach(function(row) {
        result[row.key] = row.value;
      });
      doc = result;
    }
    callback(code, doc);
  });
}

var get = exports.get = function(id, callback) {
  db.get('/_design/users/_view/all', {group: true, key: id}, function(code, doc) {
    if (code == 200) {
      doc = doc.rows.length > 0 ? doc.rows[0].value : [];
    }
    callback(code, doc);
  });
}

var friends = module.exports.friends = function(id, callback) {
  get(id, function(code, me) {
    if (code !== 200) { callback(code, me); }
    var ids = _(me)
      .chain()
      .map(function(val, key) { return Number(key); })
      .without(id)
      .value();
    // pobieramy znajomych
    db.post('/_design/users/_view/all?group=true', {keys: ids}, function(code, doc) {
      if(code !== 200) { callback(code, doc); }
      var result = {};
      doc.rows.forEach(function(row) {
        result[row.key] = row.value;
      });
      doc = result;
      doc[id] = me;
      callback(code, balances(id, doc));
    });
  });
}

var balances = function(me, graph) {
  // me to identyfikator użytkownika, dla którego wyliczamy salda znajomych
  var balances = {}; // salda wyliczone w obrębie grup wspólnych znajomych (zaqpki 2)
  var activities = {}; // graf płynności
  var paths = {}; // płynności ścieżek prowadzących od każdego ogniwa do nas
  
  _(graph).each(function(node, nid) {
    
    balances[nid] = 0;
    activities[nid] = {};
    
    _(node).each(function(connection, cid) {
      if(graph[me][cid]) { // to jest nasz znajomych
        
        balances[nid] -= connection.balance;
        if(nid != cid) { // pomijamy powiązania z samym sobą
          activities[nid][cid] = activity(connection);
        }
      }
    });
  });
  
  // TODO uwzględnić płynności w saldach
  
  return balances;
}

function activity(userStats) {
  // userStats ~ {balance: 5, transactions: 2, transfered: 15,
  //              stats: { 24130: 0, 24131: 0, 24132: 0, 24133: 0, 24134: 0, 24135: 4 }
  
  var stats = userStats.stats;
  var date = new Date();
  var currentMonth = date.getFullYear()*12 + date.getMonth();
  var fiveMonthsAgo = currentMonth - 5;
  
  var result = userStats.transactions;
  
  var month;
  for(var i = 1; i <= 6; i++) {
    month = fiveMonthsAgo + i;
    result += (stats[month] && Math.pow(2, i) * stats[month]) || 0;
  }
  
  return result;
}

// cli

if (!module.parent) {
  var argv = require('optimist').argv;
  var command = argv._[0] || 'all';
  
  if (command == 'setup') {
    out.info("updating " + db.url + "/_design/users");
    setup(function(code, doc) {
      out.expect(201, code, doc);
    });
  
  } else if (command == 'get') {
    var id = argv._[1] || argv.i || argv.id || argv.key || 0
    out.info("getting " + db.url + "/_design/users/_view/all?group=true&key=" + id);
    get(id, {}, function(code, doc) {
      out.expect(200, code, doc);
    });
    
  } else if (command == 'friends') {
    var id = argv._[1] || argv.i || argv.id || argv.key || 0
    out.info("getting and calculating friends");
    friends(id, function(code, doc) {
      out.expect(200, code, doc);
    });
    
  } else { // all
    out.info("getting " + db.url + "/_design/users/_view/all?group=true");
    all({}, function(code, doc) {
      out.expect(200, code, doc);
    });
  }
}
