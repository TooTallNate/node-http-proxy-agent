
/**
 * Module dependencies.
 */

var fs = require('fs');
var net = require('net');
var url = require('url');
var http = require('http');
var https = require('https');
var assert = require('assert');
var Proxy = require('proxy');
var HttpProxyAgent = require('../');

describe('HttpProxyAgent', function () {

  var server;
  var serverPort;

  var proxy;
  var proxyPort;

  var ssl;
  var sslPort;

  before(function (done) {
    // setup HTTP proxy server
    proxy = Proxy();
    proxy.listen(function () {
      proxyPort = proxy.address().port;
      done();
    });
  });

  before(function (done) {
    // setup target HTTP server
    server = http.createServer();
    server.listen(function () {
      serverPort = server.address().port;
      done();
    });
  });

  before(function (done) {
    // setup SSL HTTP proxy server
    var options = {
      key: fs.readFileSync(__dirname + '/server.key'),
      cert: fs.readFileSync(__dirname + '/server.crt')
    };
    ssl = Proxy(https.createServer(options));
    ssl.listen(function () {
      sslPort = ssl.address().port;
      done();
    });
  });

  // shut down test HTTP server
  after(function (done) {
    proxy.once('close', function () { done(); });
    proxy.close();
  });

  after(function (done) {
    server.once('close', function () { done(); });
    server.close();
  });

  after(function (done) {
    ssl.once('close', function () { done(); });
    ssl.close();
  });

  describe('constructor', function () {
    it('should throw an Error if no "proxy" argument is given', function () {
      assert.throws(function () {
        new HttpProxyAgent();
      });
    });
    it('should accept a "string" proxy argument', function () {
      var agent = new HttpProxyAgent('http://127.0.0.1:' + proxyPort);
      assert.equal('127.0.0.1', agent.proxy.host);
      assert.equal(proxyPort, agent.proxy.port);
    });
    it('should accept a `url.parse()` result object argument', function () {
      var opts = url.parse('http://127.0.0.1:' + proxyPort);
      var agent = new HttpProxyAgent(opts);
      assert.equal('127.0.0.1', agent.proxy.host);
      assert.equal(proxyPort, agent.proxy.port);
    });
  });

  describe('"http" module', function () {
    it('should work over an HTTP proxy', function (done) {
      // set HTTP "request" event handler for this test
      server.once('request', function (req, res) {
        res.end(JSON.stringify(req.headers));
      });

      var proxy = process.env.HTTP_PROXY || process.env.http_proxy || 'http://127.0.0.1:' + proxyPort;
      var agent = new HttpProxyAgent(proxy);

      var opts = url.parse('http://127.0.0.1:' + serverPort);
      opts.agent = agent;

      http.get(opts, function (res) {
        var data = '';
        res.setEncoding('utf8');
        res.on('data', function (b) {
          data += b;
        });
        res.on('end', function () {
          data = JSON.parse(data);
          assert.equal('127.0.0.1:' + serverPort, data.host);
          assert('via' in data);
          done();
        });
      });
    });
    it('should work over an HTTPS proxy', function (done) {
      // set HTTP "request" event handler for this test
      server.once('request', function (req, res) {
        res.end(JSON.stringify(req.headers));
      });

      var proxy = process.env.HTTPS_PROXY || process.env.https_proxy || 'https://127.0.0.1:' + sslPort;
      proxy = url.parse(proxy);
      proxy.rejectUnauthorized = false;
      var agent = new HttpProxyAgent(proxy);

      var opts = url.parse('http://127.0.0.1:' + serverPort);
      opts.agent = agent;

      http.get(opts, function (res) {
        var data = '';
        res.setEncoding('utf8');
        res.on('data', function (b) {
          data += b;
        });
        res.on('end', function () {
          data = JSON.parse(data);
          assert.equal('127.0.0.1:' + serverPort, data.host);
          assert('via' in data);
          done();
        });
      });
    });
  });

});
