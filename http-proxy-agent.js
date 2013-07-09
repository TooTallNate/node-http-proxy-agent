
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
  Agent.call(this);
  this.proxy = opts;
  this.secure = this.proxy.protocol && this.proxy.protocol == 'https:';
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

  Agent.prototype.addRequest.apply(this, arguments);
};

/**
 * Initiates a TCP connection to the specified HTTP proxy server.
 *
 * @api public
 */

HttpProxyAgent.prototype.createConnection = function (opts, fn) {
  var socket;
  var info = {
    host: this.proxy.hostname || this.proxy.host,
    port: +this.proxy.port || (this.secure ? 443 : 80)
  };
  if (this.secure) {
    socket = tls.connect(info);
  } else {
    socket = net.connect(info);
  }

  fn(null, socket);
  return socket;
};
