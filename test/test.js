/**
 * Module dependencies.
 */

const fs = require('fs');
const net = require('net');
const url = require('url');
const http = require('http');
const https = require('https');
const assert = require('assert');
const Proxy = require('proxy');
const { Agent } = require('agent-base');
const { HttpProxyAgent } = require('../');

const sleep = n => new Promise(r => setTimeout(r, n));

describe('HttpProxyAgent', function() {
	let server;
	let serverPort;

	let proxy;
	let proxyPort;

	let sslProxy;
	let sslProxyPort;

	before(function(done) {
		// setup HTTP proxy server
		proxy = Proxy();
		/*
		proxy = net.createServer((socket) => {
			socket.setEncoding('utf8');
			socket.on('data', console.log);
		});
		*/
		proxy.listen(function() {
			proxyPort = proxy.address().port;
			done();
		});
	});

	before(function(done) {
		// setup target HTTP server
		server = http.createServer();
		server.listen(function() {
			serverPort = server.address().port;
			done();
		});
	});

	beforeEach(function() {
		server.removeAllListeners('request');
	});

	before(function(done) {
		// setup SSL HTTP proxy server
		let options = {
			key: fs.readFileSync(`${__dirname}/ssl-cert-snakeoil.key`),
			cert: fs.readFileSync(`${__dirname}/ssl-cert-snakeoil.pem`)
		};
		sslProxy = Proxy(https.createServer(options));
		sslProxy.listen(function() {
			sslProxyPort = sslProxy.address().port;
			done();
		});
	});

	// shut down test HTTP server
	after(function(done) {
		proxy.once('close', function() {
			done();
		});
		proxy.close();
	});

	after(function(done) {
		server.once('close', function() {
			done();
		});
		server.close();
	});

	after(function(done) {
		sslProxy.once('close', function() {
			done();
		});
		sslProxy.close();
	});

	describe('constructor', function() {
		it('should throw an Error if no "proxy" argument is given', function() {
			assert.throws(function() {
				new HttpProxyAgent();
			});
		});
		it('should accept a "string" proxy argument', function() {
			let agent = new HttpProxyAgent(`http://127.0.0.1:${proxyPort}`);
			assert.equal('127.0.0.1', agent.proxy.host);
			assert.equal(proxyPort, agent.proxy.port);
		});
		it('should accept a `url.parse()` result object argument', function() {
			let opts = url.parse(`http://127.0.0.1:${proxyPort}`);
			let agent = new HttpProxyAgent(opts);
			assert.equal('127.0.0.1', agent.proxy.host);
			assert.equal(proxyPort, agent.proxy.port);
		});
		it('should set a `defaultPort` property', function() {
			let opts = url.parse(`http://127.0.0.1:${proxyPort}`);
			let agent = new HttpProxyAgent(opts);
			assert.equal(80, agent.defaultPort);
		});
		describe('secureProxy', function() {
			it('should default to `false`', function() {
				let agent = new HttpProxyAgent({ port: proxyPort });
				assert.equal(false, agent.secureProxy);
			});
			it('should be `false` when "http:" protocol is used', function() {
				let agent = new HttpProxyAgent({
					port: proxyPort,
					protocol: 'http:'
				});
				assert.equal(false, agent.secureProxy);
			});
			it('should be `true` when "https:" protocol is used', function() {
				let agent = new HttpProxyAgent({
					port: proxyPort,
					protocol: 'https:'
				});
				assert.equal(true, agent.secureProxy);
			});
			it('should be `true` when "https" protocol is used', function() {
				let agent = new HttpProxyAgent({
					port: proxyPort,
					protocol: 'https'
				});
				assert.equal(true, agent.secureProxy);
			});
		});
	});

	describe('"http" module', function() {
		it('should work over an HTTP proxy', function(done) {
			// set HTTP "request" event handler for this test
			server.once('request', function(req, res) {
				res.end(JSON.stringify(req.headers));
			});

			let proxy =
				process.env.HTTP_PROXY ||
				process.env.http_proxy ||
				`http://127.0.0.1:${proxyPort}`;
			let agent = new HttpProxyAgent(proxy);

			let opts = url.parse(`http://127.0.0.1:${serverPort}`);
			opts.agent = agent;

			http.get(opts, function(res) {
				let data = '';
				res.setEncoding('utf8');
				res.on('data', function(b) {
					data += b;
				});
				res.on('end', function() {
					data = JSON.parse(data);
					assert.equal(`127.0.0.1:${serverPort}`, data.host);
					assert('via' in data);
					done();
				});
			});
		});
		it('should work over an HTTPS proxy', function(done) {
			// set HTTP "request" event handler for this test
			server.once('request', function(req, res) {
				res.end(JSON.stringify(req.headers));
			});

			let proxy =
				process.env.HTTPS_PROXY ||
				process.env.https_proxy ||
				`https://127.0.0.1:${sslProxyPort}`;
			proxy = url.parse(proxy);
			proxy.rejectUnauthorized = false;
			let agent = new HttpProxyAgent(proxy);
			assert.equal(true, agent.secureProxy);

			let opts = url.parse(`http://127.0.0.1:${serverPort}`);
			opts.agent = agent;

			http.get(opts, function(res) {
				let data = '';
				res.setEncoding('utf8');
				res.on('data', function(b) {
					data += b;
				});
				res.on('end', function() {
					data = JSON.parse(data);
					assert.equal(`127.0.0.1:${serverPort}`, data.host);
					assert('via' in data);
					done();
				});
			});
		});
		it('should proxy the query string of the request path', function(done) {
			// set HTTP "request" event handler for this test
			server.once('request', function(req, res) {
				res.end(
					JSON.stringify({
						url: req.url
					})
				);
			});

			let proxy =
				process.env.HTTP_PROXY ||
				process.env.http_proxy ||
				`http://127.0.0.1:${proxyPort}`;
			let agent = new HttpProxyAgent(proxy);

			let opts = url.parse(
				`http://127.0.0.1:${serverPort}/test?foo=bar&1=2`
			);
			opts.agent = agent;

			http.get(opts, function(res) {
				let data = '';
				res.setEncoding('utf8');
				res.on('data', function(b) {
					data += b;
				});
				res.on('end', function() {
					data = JSON.parse(data);
					assert.equal('/test?foo=bar&1=2', data.url);
					done();
				});
			});
		});
		it('should receive the 407 authorization code on the `http.ClientResponse`', function(done) {
			// set a proxy authentication function for this test
			proxy.authenticate = function(req, fn) {
				// reject all requests
				fn(null, false);
			};

			let proxyUri =
				process.env.HTTP_PROXY ||
				process.env.http_proxy ||
				`http://127.0.0.1:${proxyPort}`;
			let agent = new HttpProxyAgent(proxyUri);

			let opts = {};
			// `host` and `port` don't really matter since the proxy will reject anyways
			opts.host = '127.0.0.1';
			opts.port = 80;
			opts.agent = agent;

			http.get(opts, function(res) {
				assert.equal(407, res.statusCode);
				assert('proxy-authenticate' in res.headers);
				delete proxy.authenticate;
				done();
			});
		});
		it('should send the "Proxy-Authorization" request header', function(done) {
			// set a proxy authentication function for this test
			proxy.authenticate = function(req, fn) {
				// username:password is "foo:bar"
				fn(
					null,
					req.headers['proxy-authorization'] == 'Basic Zm9vOmJhcg=='
				);
			};

			// set HTTP "request" event handler for this test
			server.once('request', function(req, res) {
				res.end(JSON.stringify(req.headers));
			});

			let proxyUri =
				process.env.HTTP_PROXY ||
				process.env.http_proxy ||
				`http://127.0.0.1:${proxyPort}`;
			let proxyOpts = url.parse(proxyUri);
			proxyOpts.auth = 'foo:bar';
			let agent = new HttpProxyAgent(proxyOpts);

			let opts = url.parse(`http://127.0.0.1:${serverPort}`);
			opts.agent = agent;

			http.get(opts, function(res) {
				let data = '';
				res.setEncoding('utf8');
				res.on('data', function(b) {
					data += b;
				});
				res.on('end', function() {
					data = JSON.parse(data);
					assert.equal(`127.0.0.1:${serverPort}`, data.host);
					assert('via' in data);
					delete proxy.authenticate;
					done();
				});
			});
		});
		it('should emit an "error" event on the `http.ClientRequest` if the proxy does not exist', function(done) {
			// port 4 is a reserved, but "unassigned" port
			let proxyUri = 'http://127.0.0.1:4';
			let agent = new HttpProxyAgent(proxyUri);

			let opts = url.parse('http://nodejs.org');
			opts.agent = agent;

			let req = http.get(opts);
			req.once('error', function(err) {
				assert.equal('ECONNREFUSED', err.code);
				req.abort();
				done();
			});
		});
		it('should work after the first tick of the `http.ClientRequest` instance', function(done) {
			// set HTTP "request" event handler for this test
			server.once('request', function(req, res) {
				res.end(JSON.stringify(req.url));
			});

			let proxy =
				process.env.HTTP_PROXY ||
				process.env.http_proxy ||
				`http://127.0.0.1:${proxyPort}`;
			let httpProxyAgent = new HttpProxyAgent(proxy);

			// Defer the "connect()" function logic, since calling `req.end()`
			// before the socket is returned causes the HTTP header to be
			// generated *before* `HttpProxyAgent` can patch the `req.path`
			// property, making the header incorrect.
			const sleepAgent = new Agent((req, opts) => {
				assert.equal(opts.secureEndpoint, false);
				assert.equal(opts.protocol, 'http:');
				assert(!req._header);
				return sleep(10).then(() => {
					assert.equal(typeof req._header, 'string');
					return httpProxyAgent;
				});
			});

			const opts = url.parse(`http://127.0.0.1:${serverPort}/test`);
			opts.agent = sleepAgent;

			http.get(opts, function(res) {
				let data = '';
				res.setEncoding('utf8');
				res.on('data', function(b) {
					data += b;
				});
				res.on('end', function() {
					data = JSON.parse(data);
					assert.equal('/test', data);
					done();
				});
			});
		});
		it('should not send a port number for the default port', function(done) {
			server.once('request', function(req, res) {
				res.end(JSON.stringify(req.headers));
			});
			let proxy =
				process.env.HTTP_PROXY ||
				process.env.http_proxy ||
				`http://127.0.0.1:${proxyPort}`;
			proxy = url.parse(proxy);
			let agent = new HttpProxyAgent(proxy);
			agent.defaultPort = serverPort;
			let opts = url.parse(`http://127.0.0.1:${serverPort}`);
			opts.agent = agent;
			http.get(opts, function(res) {
				let data = '';
				res.setEncoding('utf8');
				res.on('data', function(b) {
					data += b;
				});
				res.on('end', function() {
					data = JSON.parse(data);
					assert.equal('127.0.0.1', data.host);
					done();
				});
			});
		});
	});
});
