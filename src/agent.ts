import net from 'net';
import tls from 'tls';
import url from 'url';
import createDebug from 'debug';
import { HttpProxyAgentOptions } from './';
import { Agent, ClientRequest, RequestOptions } from 'agent-base';

const debug = createDebug('http-proxy-agent');

/**
 * The `HttpProxyAgent` implements an HTTP Agent subclass that connects
 * to the specified "HTTP proxy server" in order to proxy HTTP requests.
 *
 * @api public
 */
export default class HttpProxyAgent extends Agent {
	private secureProxy: boolean;
	private proxy: HttpProxyAgentOptions;

	constructor(_opts: string | HttpProxyAgentOptions) {
		let opts: HttpProxyAgentOptions;
		if (typeof _opts === 'string') {
			opts = url.parse(_opts) as HttpProxyAgentOptions;
		} else {
			opts = _opts;
		}
		if (!opts) {
			throw new Error(
				'an HTTP(S) proxy server `host` and `port` must be specified!'
			);
		}
		debug('Creating new HttpProxyAgent instance: %o', opts);
		super(opts);

		const proxy: HttpProxyAgentOptions = { ...opts };

		// If `true`, then connect to the proxy server over TLS.
		// Defaults to `false`.
		this.secureProxy = proxy.protocol
			? /^https:?$/i.test(proxy.protocol)
			: false;

		// Prefer `hostname` over `host`, and set the `port` if needed.
		proxy.host = proxy.hostname || proxy.host;
		// @ts-ignore
		proxy.port = +proxy.port || (this.secureProxy ? 443 : 80);

		if (proxy.host && proxy.path) {
			// If both a `host` and `path` are specified then it's most likely
			// the result of a `url.parse()` call... we need to remove the
			// `path` portion so that `net.connect()` doesn't attempt to open
			// that as a Unix socket file.
			delete proxy.path;
			delete proxy.pathname;
		}

		this.proxy = proxy;
	}

	/**
	 * Called when the node-core HTTP client library is creating a
	 * new HTTP request.
	 *
	 * @api protected
	 */
	callback(req: ClientRequest, opts: RequestOptions): net.Socket {
		const { proxy, secureProxy } = this;

		const parsed = url.parse(req.path) as any;
		if (parsed.protocol == null) parsed.protocol = 'http:';
		if (parsed.hostname == null)
			parsed.hostname = opts.hostname || opts.host || null;
		if (parsed.port == null) parsed.port = opts.port;
		if (parsed.port == 80) {
			// if port is 80, then we can remove the port so that the
			// ":80" portion is not on the produced URL
			delete parsed.port;
		}

		// Change the `http.ClientRequest` instance's "path" field
		// to the absolute path of the URL that will be requested.
		//
		// XXX: Ignore because in `@types/node` the `path` property is `readonly`
		// @ts-ignore
		req.path = url.format(parsed);

		// Inject the `Proxy-Authorization` header if necessary.
		if (proxy.auth) {
			req.setHeader(
				'Proxy-Authorization',
				`Basic ${Buffer.from(proxy.auth).toString('base64')}`
			);
		}

		// create a socket connection to the proxy server
		let socket: net.Socket;
		if (secureProxy) {
			debug('Creating `tls.Socket`: %o', opts);
			socket = tls.connect(proxy);
		} else {
			debug('Creating `net.Socket`: %o', opts);
			socket = net.connect(proxy);
		}

		// At this point, the http ClientRequest's internal `_header` field
		// might have already been set. If this is the case then we'll need
		// to re-generate the string since we just changed the `req.path`.
		// @ts-ignore
		if (req._header) {
			debug('Regenerating stored HTTP header string for request');
			// @ts-ignore
			req._header = null;
			// @ts-ignore
			req._implicitHeader();
			// @ts-ignore
			if (req.output && req.output.length > 0) {
				// Node < 12
				debug(
					'Patching connection write() output buffer with updated header'
				);
				// @ts-ignore
				var first = req.output[0];
				var endOfHeaders = first.indexOf('\r\n\r\n') + 4;
				// @ts-ignore
				req.output[0] = req._header + first.substring(endOfHeaders);
				// @ts-ignore
				debug('Output buffer: %o', req.output);
				// @ts-ignore
			} else if (req.outputData && req.outputData.length > 0) {
				// Node >= 12
				debug(
					'Patching connection write() output buffer with updated header'
				);
				// @ts-ignore
				var first = req.outputData[0].data;
				var endOfHeaders = first.indexOf('\r\n\r\n') + 4;
				// @ts-ignore
				req.outputData[0].data =
					// @ts-ignore
					req._header + first.substring(endOfHeaders);
				// @ts-ignore
				debug('Output buffer: %o', req.outputData[0].data);
			}
		}

		return socket;
	}
}
