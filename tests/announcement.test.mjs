import test from 'node:test';
import assert from 'node:assert/strict';

globalThis.window = {setTimeout,clearTimeout};
const {DEFAULT_ANNOUNCEMENT,parseAnnouncement} = await import('../src/announcement.ts');

test('announcement accepts worksheet data and rejects empty payloads',()=>{
  assert.equal(parseAnnouncement({}),null);
  assert.deepEqual(parseAnnouncement({announcement:{
    enabled:true,version:'v2',title:'開發者公告',date:'2026/10/08',message:'更新完成'
  }}),{enabled:true,version:'v2',title:'開發者公告',date:'2026/10/08',message:'更新完成'});
  assert.equal(DEFAULT_ANNOUNCEMENT.enabled,true);
});
