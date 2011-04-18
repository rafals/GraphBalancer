var app = require('./config');
var transactions = require('./transactions');
var users = require('./users');
var out = require('./out');
var _ = require('underscore');

app.get('/', function(req,res) {
  res.send('Try json API');
});

function expect(expectedCode, res, next) {
  return function(code, docs) {
    if (code == expectedCode) {
      res.send(docs, expectedCode);
    } else {
      next(docs);
    }
  }
}

// z zapytań typu GET są zbierane dodadkowe parametry i są przesyłane
// razem z zapytaniem do bazy danych, np:
// /transactions?limit=5
// ograniczy ilość wyników do 5
// dostępne opcje: http://wiki.apache.org/couchdb/HTTP_view_API#line-93

app.get('/transactions', function(req, res, next) {
  transactions.latest(req.query, expect(200, res, next));
});

app.get('/users', function(req, res, next) {
  users.all(req.query, expect(200, res, next));
});

app.post('/transactions', function(req, res, next) {
  var doc = req.body || {};
  transactions.create(doc, expect(201, res, next));
});

app.del('/transactions/:id', function(req, res, next) {
  transactions.del(req.params.id, expect(201, res, next));
});

app.get('/users/:id/friends', function(req, res, next) {
  users.friends(req.params.id, expect(200, res, next));
});

app.get('/users/:id/transactions', function(req, res, next) {
  transactions.by_user(req.params.id, req.query, expect(200, res, next));
});

app.put('/transactions/:id', function(req, res, next) {
  var changes = req.body || {};
  transactions.update(req.params.id, changes, expect(201, res, next));
});

// start
if (!module.parent) {
  app.listen(app.set('port'));
  console.log("Express server listening on port %d", app.address().port);
}
