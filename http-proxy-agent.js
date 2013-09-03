
/**
 * Module dependencies.
 */

var net = require('net');
var tls = require('tls');
var url = require('url');
var Agent = require('agent-base');
var inherits = require('util').inherits;

/**
 * Module exports.
 */

module.exports = HttpProxyAgent;

/**
 * The `HttpProxyAgent` implements an HTTP Agent subclass that connects to the
 * specified "HTTP proxy server" in order to proxy HTTP requests.
 *
 * @api public
 */

function HttpProxyAgent (opts) {
  if (!(this instanceof HttpProxyAgent)) return new HttpProxyAgent(opts);
  if ('string' == typeof opts) opts = url.parse(opts);
  if (!opts) throw new Error('an HTTP(S) proxy server `host` and `port` must be specified!');
  var proxy = clone(opts, {});
  Agent.call(this);

  this.secure = proxy.protocol && proxy.protocol == 'https:';

  // prefer `hostname` over `host`, and set the `port` if needed
  proxy.host = proxy.hostname || proxy.host;
  proxy.port = +proxy.port || (this.secure ? 443 : 80);

  if (proxy.host && proxy.path) {
    // if both a `host` and `path` are specified then it's most likely the
    // result of a `url.parse()` call... we need to remove the `path` portion so
    // that `net.connect()` doesn't attempt to open that as a unix socket file.
    delete proxy.path;
  }

  this.proxy = proxy;
}
inherits(HttpProxyAgent, Agent);

/**
 * Called when the node-core HTTP client library is creating a new HTTP request.
 *
 * @api public
 */

HttpProxyAgent.prototype.addRequest = function (req, host, port, localAddress) {
  var opts;
  if ('object' == typeof host) {
    // >= v0.11.x API
    opts = host;
  } else {
    // <= v0.10.x API
    opts = {
      host: host,
      port: port,
      localAddress: localAddress
    };
  }

  // change the `http.ClientRequest` instance's "path" field
  // to the absolute path of the URL that will be requested
  var absolute = url.format({
    protocol: 'http:',
    hostname: opts.hostname || opts.host,
    port: opts.port,
    pathname: req.path
  });
  req.path = absolute;

  // inject the `Proxy-Authorization` header if necessary
  var auth = this.proxy.auth;
  if (auth) {
    req.setHeader('Proxy-Authorization', 'Basic ' + new Buffer(auth).toString('base64'));
  }

  Agent.prototype.addRequest.apply(this, arguments);
};

/**
 * Initiates a TCP connection to the specified HTTP proxy server.
 *
 * @api protected
 */

HttpProxyAgent.prototype.createConnection = function (opts, fn) {
  var socket;
  if (this.secure) {
    socket = tls.connect(this.proxy);
  } else {
    socket = net.connect(this.proxy);
  }

  fn(null, socket);
  return socket;
};

function clone (src, dest) {
  for (var i in src) dest[i] = src[i];
  return dest;
}
