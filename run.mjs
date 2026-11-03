import {collectSnapshot} from './youtube.mjs';
import {pathToFileURL} from 'node:url';
const ORIGIN='https://terminal.alignmentlab.com';
const AUDIENCE=ORIGIN+'/collector';
export async function run({env=process.env,fetchImpl=fetch,collect=collectSnapshot}={}) {
 if(env.COLLECTOR_ENABLED!=='true')return {status:'disabled'};
 // GitHub provides these short-lived credentials only inside an authorized Actions job.
 if(!env.ACTIONS_ID_TOKEN_REQUEST_URL||!env.ACTIONS_ID_TOKEN_REQUEST_TOKEN)throw new Error('oidc_unavailable');
 const issuerRequest=new URL(env.ACTIONS_ID_TOKEN_REQUEST_URL);
 if(issuerRequest.protocol!=='https:'||!issuerRequest.hostname.endsWith('.actions.githubusercontent.com'))throw new Error('invalid_oidc_endpoint');
 issuerRequest.searchParams.set('audience',AUDIENCE);
 const oidcResponse=await fetchImpl(issuerRequest,{headers:{Authorization:`Bearer ${env.ACTIONS_ID_TOKEN_REQUEST_TOKEN}`},redirect:'error',signal:AbortSignal.timeout(15000)});
 if(!oidcResponse.ok)throw new Error('oidc_failed');
 const {value:token}=await oidcResponse.json();if(typeof token!=='string'||token.length>20000)throw new Error('invalid_oidc_token');
 async function request(path,body) {
  const res=await fetchImpl(ORIGIN+path,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify(body),redirect:'error',signal:AbortSignal.timeout(30000)});
  if(!res.ok)throw new Error('terminal_request_failed');
  return res.json();
 }
 // Expiry maintenance precedes source access, even when the source key is missing or invalid.
 const config=await request('/api/collector/purge',{});
 if(config.status!=='ready')throw new Error('terminal_not_ready');
 if(!env.YOUTUBE_API_KEY)throw new Error('youtube_key_missing');
 const snapshot=await collect({apiKey:env.YOUTUBE_API_KEY,fetchImpl,approvedMalfoidVideoIds:config.approvedMalfoidVideoIds??[],expectedChannelIds:config.expectedChannelIds??{}});
 const saved=await request('/api/collector/ingest',{snapshot});
 if(!['collected','already_collected'].includes(saved.status))throw new Error('snapshot_not_saved');
 return {status:saved.status};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href) {
 try {const result=await run();console.log(result.status);}catch {console.error('Collection failed. Check workflow configuration and source availability.');process.exitCode=1;}
}
