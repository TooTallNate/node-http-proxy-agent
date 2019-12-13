import net from 'net';
import tls from 'tls';
import { Url } from 'url';
import { AgentOptions } from 'agent-base';
import _HttpProxyAgent from './agent';

function createHttpProxyAgent(
	opts: string | createHttpProxyAgent.HttpProxyAgentOptions
): _HttpProxyAgent {
	return new _HttpProxyAgent(opts);
}

namespace createHttpProxyAgent {
	export type HttpProxyAgentOptions = AgentOptions &
		Url &
		net.NetConnectOpts &
		tls.ConnectionOptions & {
			secureProxy?: boolean;
			port?: string | number | null;
		};

	export const HttpProxyAgent = _HttpProxyAgent;

	createHttpProxyAgent.prototype = _HttpProxyAgent.prototype;
}

export = createHttpProxyAgent;
