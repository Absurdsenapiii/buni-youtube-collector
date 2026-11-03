/** Public YouTube metadata collector. No persistence, scheduler, or credential provisioning. */
export const CHANNEL_HANDLES = Object.freeze(['@bunimediahub']);
const BASE = 'https://www.googleapis.com/youtube/v3/';
const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;
const CHANNEL_ID = /^UC[A-Za-z0-9_-]{22}$/;
export class CollectionError extends Error {
  constructor(code, status = null) { super(code); this.name = 'CollectionError'; this.code = code; this.status = status; }
}
const fail = (code, status) => { throw new CollectionError(code, status); };
function bounded(value, fallback, max) { const v = value ?? fallback; if (!Number.isInteger(v) || v < 1 || v > max) fail('invalid_limits'); return v; }
function count(value) { if (typeof value !== 'string' || !/^\d+$/.test(value)) return null; const n = Number(value); return Number.isSafeInteger(n) ? n : null; }
function safeText(value, max) { return typeof value === 'string' ? value.slice(0, max) : ''; }
function sgt(iso) { return new Date(new Date(iso).getTime()+8*3600000).toISOString().replace('Z','+08:00'); }
function roster(ids) { if (!Array.isArray(ids) || ids.length > 1000 || ids.some(id=>typeof id !== 'string' || !VIDEO_ID.test(id))) fail('invalid_roster'); return [...new Set(ids)].sort(); }

/** Returns a complete safe snapshot or throws a sanitized CollectionError. Never saves partial failures. */
export async function collectSnapshot({apiKey, fetchImpl=globalThis.fetch, sleep=ms=>new Promise(r=>setTimeout(r,ms)), now=()=>new Date(), approvedMalfoidVideoIds=[], expectedChannelIds={}, limits={}}={}) {
  if (typeof apiKey !== 'string' || !apiKey.trim()) fail('credential_missing');
  if (typeof fetchImpl !== 'function') fail('fetch_unavailable');
  const approved = roster(approvedMalfoidVideoIds);
  const maxPages=bounded(limits.maxPagesPerChannel,20,40), maxRequests=bounded(limits.maxRequests,120,250), timeoutMs=bounded(limits.timeoutMs,10000,30000);
  const retries=limits.retries??2;
  if (!Number.isInteger(retries)||retries<0||retries>2) fail('invalid_limits');
  let requests=0;
  async function get(endpoint, params) {
    const url=new URL(endpoint,BASE); for(const [k,v] of Object.entries(params)) if(v!==undefined) url.searchParams.set(k,String(v));
    for(let attempt=0;;attempt++) {
      if(++requests>maxRequests) fail('request_budget_exceeded');
      const controller=new AbortController(), timer=setTimeout(()=>controller.abort(),timeoutMs);
      let response;
      try { response=await fetchImpl(url.toString(),{method:'GET',headers:{'x-goog-api-key':apiKey,Accept:'application/json'},signal:controller.signal,redirect:'error'}); }
      catch { clearTimeout(timer); fail('upstream_network_error'); }
      if(!response.ok) {
        clearTimeout(timer);
        const status=Number.isInteger(response.status)?response.status:null;
        if((status===429||(status>=500&&status<=599))&&attempt<retries) { await sleep(250*2**attempt); continue; }
        // Never read upstream error bodies or stringify request/exception objects: they can contain credentials.
        fail(status===403?'upstream_forbidden':'upstream_http_error',status);
      }
      let data; try { data=await response.json(); } catch { fail('invalid_upstream_json'); } finally { clearTimeout(timer); }
      if(!data||!Array.isArray(data.items)) fail('invalid_upstream_response');
      return data;
    }
  }
  const channels=[], videos=[];
  for(const handle of CHANNEL_HANDLES) {
    const result=await get('channels',{part:'snippet,contentDetails,statistics',forHandle:handle,maxResults:1,fields:'items(id,snippet(title,customUrl),contentDetails/relatedPlaylists/uploads,statistics(viewCount,videoCount))'});
    if(result.items.length!==1) fail('channel_not_resolved');
    const c=result.items[0], channelId=c.id, playlistId=c.contentDetails?.relatedPlaylists?.uploads;
    if(!CHANNEL_ID.test(channelId??'')||typeof playlistId!=='string'||!/^[A-Za-z0-9_-]{10,64}$/.test(playlistId)) fail('invalid_channel_identity');
    const returnedHandle=c.snippet?.customUrl;
    if(returnedHandle&&String(returnedHandle).replace(/^@/,'').toLowerCase()!==handle.slice(1)) fail('channel_handle_mismatch');
    if(expectedChannelIds[handle]&&expectedChannelIds[handle]!==channelId) fail('channel_identity_changed');
    if(channels.some(x=>x.id===channelId)) fail('duplicate_channel_identity');
    const ids=new Set();let token;const tokens=new Set();
    for(let page=0;page<maxPages;page++) {
      const p=await get('playlistItems',{part:'contentDetails',playlistId,maxResults:50,pageToken:token,fields:'nextPageToken,items(contentDetails/videoId)'});
      for(const item of p.items) { const id=item.contentDetails?.videoId; if(VIDEO_ID.test(id??'')) ids.add(id); }
      token=p.nextPageToken;
      if(!token) break;
      if(typeof token!=='string'||token.length>2048||tokens.has(token)) fail('invalid_pagination');tokens.add(token);
      if(page===maxPages-1) fail('pagination_limit_exceeded');
    }
    const allIds=[...ids]; const channelVideos=[];
    for(let offset=0;offset<allIds.length;offset+=50) {
      const batch=allIds.slice(offset,offset+50), allowed=new Set(batch);
      const response=await get('videos',{part:'snippet,statistics',id:batch.join(','),fields:'items(id,snippet(title,publishedAt,channelId),statistics(viewCount,commentCount,likeCount))'});
      const seen=new Set();
      for(const v of response.items) {
        if(!allowed.has(v.id)||seen.has(v.id)||v.snippet?.channelId!==channelId) fail('video_identity_mismatch');seen.add(v.id);
        const title=safeText(v.snippet.title,500);
        channelVideos.push({id:v.id,channelId,title,publishedAt:/^\d{4}-\d\d-\d\dT/.test(v.snippet.publishedAt??'')?safeText(v.snippet.publishedAt,30):null,url:`https://www.youtube.com/watch?v=${v.id}`,viewCount:count(v.statistics?.viewCount),commentCount:count(v.statistics?.commentCount),likeCount:count(v.statistics?.likeCount),malfoidCandidate:/\bmalfoid\b/i.test(title),malfoidApproved:approved.includes(v.id)});
      }
    }
    channels.push({id:channelId,handle,title:safeText(c.snippet?.title,200),url:`https://www.youtube.com/${handle}`,viewCount:count(c.statistics?.viewCount),videoCount:count(c.statistics?.videoCount),listedUploadCount:allIds.length,returnedVideoCount:channelVideos.length,unavailableVideoIds:allIds.filter(id=>!channelVideos.some(v=>v.id===id))});
    videos.push(...channelVideos);
  }
  const byId=new Map(videos.map(v=>[v.id,v]));
  const missingIds=approved.filter(id=>!byId.has(id)||byId.get(id).viewCount===null);
  const observedAtUtc=new Date(now()).toISOString();
  const expiresAtUtc=new Date(Date.parse(observedAtUtc)+29*24*3600000).toISOString();
  const snapshot={schemaVersion:1,observedAtUtc,expiresAtUtc,observedAtSingapore:sgt(observedAtUtc),dateUtc:observedAtUtc.slice(0,10),dateSingapore:sgt(observedAtUtc).slice(0,10),timeZone:'Asia/Singapore',source:'YouTube Data API v3 public metadata',collection:{complete:true,requestCount:requests},channels,videos:videos.sort((a,b)=>a.id.localeCompare(b.id)),malfoid:{approvedVideoIds:approved,missingVideoIds:missingIds,status:!approved.length?'awaiting_approved_roster':missingIds.length?'incomplete_roster':'observed',reviewCandidates:videos.filter(v=>v.malfoidCandidate&&!v.malfoidApproved).map(v=>v.id)}};
  return snapshot;
}

