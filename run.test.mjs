import test from 'node:test';
import assert from 'node:assert/strict';
import {run} from './run.mjs';
const base={COLLECTOR_ENABLED:'true',ACTIONS_ID_TOKEN_REQUEST_URL:'https://pipelines.actions.githubusercontent.com/token',ACTIONS_ID_TOKEN_REQUEST_TOKEN:'test-ephemeral-token',YOUTUBE_API_KEY:'test-private-key'};
const json=(value)=>({ok:true,json:async()=>value});
test('disabled job never requests credentials or data',async()=>{assert.deepEqual(await run({env:{},fetchImpl:()=>{throw Error('must not call')}}),{status:'disabled'});});
test('purges before source access and sends token only to fixed terminal',async()=>{
 const calls=[];const result=await run({env:base,fetchImpl:async(url,opts)=>{calls.push([String(url),opts]);if(calls.length===1)return json({value:'test-id-token'});if(calls.length===2)return json({status:'ready',approvedMalfoidVideoIds:[],expectedChannelIds:{}});return json({status:'collected'});},collect:async({apiKey})=>{assert.equal(calls.length,2);assert.equal(apiKey,'test-private-key');return {channels:[],videos:[]};}});
 assert.equal(result.status,'collected');assert.equal(calls[1][0],'https://terminal.alignmentlab.com/api/collector/purge');assert.equal(calls[2][0],'https://terminal.alignmentlab.com/api/collector/ingest');assert.equal(calls[2][1].headers.Authorization,'Bearer test-id-token');assert.ok(!JSON.stringify(calls).includes('test-private-key'));
});
test('missing YouTube secret still allows expiry purge first',async()=>{let count=0;await assert.rejects(run({env:{...base,YOUTUBE_API_KEY:''},fetchImpl:async()=>{count++;return json(count===1?{value:'test-id-token'}:{status:'ready'});}}),/youtube_key_missing/);assert.equal(count,2);});
test('unexpected token issuer request host rejected before transmitting credentials',async()=>{await assert.rejects(run({env:{...base,ACTIONS_ID_TOKEN_REQUEST_URL:'https://evil.example/token'},fetchImpl:()=>{throw Error('must not call')}}),/invalid_oidc_endpoint/);});
test('failed maintenance prevents collection',async()=>{let calls=0;await assert.rejects(run({env:base,fetchImpl:async()=>++calls===1?json({value:'test-id-token'}):{ok:false},collect:()=>{throw Error('must not collect')}}),/terminal_request_failed/);});
