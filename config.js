// http://expressjs.com/guide.html
var express = require('express');

var app = module.exports = express.createServer();

app.configure(function(){
  app.set('views', __dirname + '/views');
  app.set('view engine', 'jade');
  app.set('view options', { layout: false });
  app.use(express.bodyParser());
  app.use(express.methodOverride());
  app.use(app.router);
  app.use(express.static(__dirname + '/public'));
  app.set('port', 3000);
  // http://wiki.apache.org/couchdb/Reference
  app.set('db host', 'http://127.0.0.1:5984');
  app.set('db name', 'zaqpki');
});

app.configure('development', function(){
  app.use(express.errorHandler({ dumpExceptions: true, showStack: true }));
});

app.configure('production', function(){
  app.use(express.errorHandler());
});

// start
if (!module.parent) {
  app.listen(app.set('port'));
  console.log("Express server listening on port %d", app.address().port);
}
