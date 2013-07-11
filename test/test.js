
/**
 * Module dependencies.
 */

var url = require('url');
var http = require('http');
var assert = require('assert');
var HttpProxyAgent = require('../');

describe('HttpProxyAgent', function () {

  this.slow(5000);
  this.timeout(10000);

  var link = process.env.LINK || 'http://jsonip.com/';

  it('should throw an Error if no "proxy" is given', function () {
    assert.throws(function () {
      new HttpProxyAgent();
    });
  });

  it('should work over an HTTP proxy', function (done) {
    var proxy = process.env.HTTP_PROXY || process.env.http_proxy || 'http://10.1.10.200:3128';
    var agent = new HttpProxyAgent(proxy);

    var opts = url.parse(link);
    opts.agent = agent;

    http.get(opts, function (res) {
      var data = '';
      res.setEncoding('utf8');
      res.on('data', function (b) {
        data += b;
      });
      res.on('end', function () {
        data = JSON.parse(data);
        //assert.equal('tootallnate', data.username);
        console.log(data);
        done();
      });
    });
  });

  it('should work over an HTTPS proxy', function (done) {
    var proxy = process.env.HTTPS_PROXY || process.env.https_proxy || 'https://10.1.10.200:3130';
    proxy = url.parse(proxy);
    proxy.rejectUnauthorized = false;
    var agent = new HttpProxyAgent(proxy);

    var opts = url.parse(link);
    opts.agent = agent;
    opts.rejectUnauthorized = false;

    http.get(opts, function (res) {
      var data = '';
      res.setEncoding('utf8');
      res.on('data', function (b) {
        data += b;
      });
      res.on('end', function () {
        data = JSON.parse(data);
        //assert.equal('tootallnate', data.username);
        console.log(data);
        done();
      });
    });
  });

});
