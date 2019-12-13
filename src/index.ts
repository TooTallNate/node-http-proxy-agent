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
	export interface HttpProxyAgentOptions
		extends AgentOptions,
			Partial<
				Omit<
					Url & net.NetConnectOpts & tls.ConnectionOptions,
					'host' | 'port' | 'path'
				>
			> {
		secureProxy?: boolean;
		host?: string | null;
		path?: string | null;
		port?: string | number | null;
	}

	export const HttpProxyAgent = _HttpProxyAgent;

	createHttpProxyAgent.prototype = _HttpProxyAgent.prototype;
}

export = createHttpProxyAgent;
