
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
  Agent.call(this, connect);

  var proxy = clone(opts, {});

  // if `true`, then connect to the proxy server over TLS. defaults to `false`.
  this.secureProxy = proxy.protocol ? proxy.protocol == 'https:' : false;

  // prefer `hostname` over `host`, and set the `port` if needed
  proxy.host = proxy.hostname || proxy.host;
  proxy.port = +proxy.port || (this.secureProxy ? 443 : 80);

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

function connect (req, opts, fn) {
  if (null == opts.port) opts.port = 80;

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

  var socket;
  if (this.secureProxy) {
    socket = tls.connect(this.proxy);
  } else {
    socket = net.connect(this.proxy);
  }

  fn(null, socket);
};

function clone (src, dest) {
  for (var i in src) dest[i] = src[i];
  return dest;
}
