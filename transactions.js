#!/usr/bin/env node

var db = require('./db');
var _ = require('underscore');
var out = require('./out');

// design

var design = {
  language: 'javascript',
  
  // nie pozwala na zapisanie w bazie niepoprawnie sformatowanych danych
  validate_doc_update: function(newDoc, savedDoc, userCtx) {
    
    function check(beTrue, message) {
      if(!beTrue) throw({forbidden: message});
    }
    
    function required(field) {
      check(newDoc[field], 'Field ' + field + ' is required.');
    }
    
    required('from');
    required('to');
    required('cost');
    required('name');
    required('created_at');
    required('updated_at');
    
    if (savedDoc) {
      check(newDoc.created_at === savedDoc.created_at, "Can't change created_at value");
    }
    
    check(newDoc.created_at <= newDoc.updated_at, "Created_at can't be greater than updated_at date");
    
    if(newDoc.deleted_at) {
      check(newDoc.deleted_at === newDoc.updated_at, "Deleted_at and updated_at must be equal");
    }
    
    check(typeof newDoc.from === 'number', 'From param must be a number');
    
    log(newDoc.to);
    log(typeof newDoc.to);
    log(newDoc.to instanceof Array);
    check(newDoc.to.length !== undefined, 'To param must be an array');
    var t;
    var to;
    for(t in newDoc.to) {
      to = newDoc.to[t];
      check(typeof to === 'number', 'To param must contain numbers');
    }
    
    check(typeof newDoc.cost === 'number', 'Cost param must be a number');
    check(newDoc.cost % 1 === 0, 'Cost must be an integer');
    
  },
  
  updates: {
    // oznacza transakcję jako usuniętą
    'delete': function(doc, req) {
      var toSave = doc;
      if(doc) {
        if(doc.deleted_at) {
          toSave = null;
        } else {
          doc.deleted_at = doc.updated_at = new Date().getTime();
        }
        var response = {
          "headers" : {
            "Content-Type" : "application/json"
          },
          "body" : JSON.stringify(doc),
        };
        return [toSave, response];
      } else {
        return [null, "transaction doesn't exist"];
      }
    },
    
    // dopisuje daty utworzenia i aktualizacji
    timestamp: function(doc, req) {
      var changes = JSON.parse(req.body || {});
      if(!doc) {
        doc = changes;
        doc._id = req.id || req.uuid;
        doc.updated_at = doc.created_at = new Date().getTime();
      } else {
        doc.updated_at = new Date().getTime();
        var k;
        for(k in changes) {
          doc[k] = changes[k];
        }
      }
      var response = {
        "headers" : {
          "Content-Type" : "application/json"
        },
        "body" : JSON.stringify(doc),
      };
      return [doc, response];
    },
  },
  
  views: {
    
    latest: {
      map: function(doc) {
        if(doc.from !== undefined && doc.to !== undefined && doc.cost !== undefined) {
          emit(doc.updated_at, doc);
        }
      },
    },
    
    by_user: {
      map: function(doc) {
        if(doc.from !== undefined && doc.to !== undefined && doc.cost !== undefined) {
          var users = {};
          for (u in doc.to) {
            users[doc.to[u]] = true;
          }
          users[doc.from] = true;
          for (u in users) {
            emit(Number(u), doc);
          }
        }
      },
    },   
  },
}

// api

var setup = module.exports.setup = function(callback) {
  db.forcePut('/_design/transactions', design, callback);
}

var create = module.exports.create = function(doc, callback) {
  db.post('/_design/transactions/_update/timestamp', doc, callback);
}

var update = module.exports.update = function(id, changes, callback) {
  db.put('/_design/transactions/_update/timestamp/' + id, changes, callback);
}

var del = module.exports.del = function(id, callback) {
  db.put('/_design/transactions/_update/delete/' + id, {}, callback);
}

var by_user = module.exports.by_user = function(id, params, callback) {
  db.get('/_design/transactions/_view/by_user', _.extend({key: id, descending: true}, params), function(code, doc) {
    if (code == 200) {
      doc = _(doc.rows).map(function(row) { return row.value; });
    }
    callback(code, doc);
  });
}

var latest = module.exports.latest = function(params, callback) {
  db.get('/_design/transactions/_view/latest', _.extend({descending: true}, params), function(code, doc) {
    if (code == 200) {
      doc = _(doc.rows).map(function(row) { return row.value; });
    }
    callback(code, doc);
  });
}

// cli

if (!module.parent) {
  var argv = require('optimist').argv;
  var command = argv._[0] || 'latest';
  
  function expect(expectedCode) {
    return function(code, doc) {
      out.expect(expectedCode, code, doc);
    }
  }
  
  if (command == 'setup') {
    out.info("updating " + db.url + "/_design/transactions");
    setup(expect(201));
    
  } else if (command == 'create') {
    var doc = JSON.parse(argv._[1]);
    out.info("putting to " + db.url + "/_design/transactions/_update/timestamp");
    create(doc, expect(201));
    
  } else if (command == 'update') {
    var id = argv._[1];
    var changes = JSON.parse(argv._[2]);
    out.info("putting to " + db.url + "/_design/transactions/_update/timestamp/" + id);
    update(id, changes, expect(201));

  } else if (command == 'del') {
    var id = argv._[1];
    out.info("putting to " + db.url + "/_design/transactions/_update/delete/" + id);
    del(id, expect(201));

  } else if (command == 'user') {
    var id = argv._[1];
    out.info("getting " + db.url + "/_design/transactions/_view/by_user?key=" + id);
    by_user(id, {limit: 5}, expect(200));

  } else { // latest
    out.info("getting " + db.url + "/_design/transactions/_view/by_last_update");
    latest({limit: 5, skip: 0}, expect(200));
    
  }
}
