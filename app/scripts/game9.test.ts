import {test} from 'node:test';
import assert from 'node:assert/strict';
(globalThis as any).location={search:''};
(globalThis as any).localStorage={getItem:()=>null};
const {createMix,DEFAULT_AUDIO}=await import('../src/game/jobs/sound.js');
test('audio routes music/effects through master then a safety compressor',()=>{
 const connections:any[]=[];let count=0;
 const ctx={destination:{name:'destination'},createGain:()=>({name:`gain${++count}`,gain:{value:1},connect(to:any){connections.push([this.name,to.name]);return to;}}),createDynamicsCompressor:()=>({name:'limiter',threshold:{value:0},knee:{value:0},ratio:{value:0},attack:{value:0},release:{value:0},connect(to:any){connections.push([this.name,to.name]);return to;}})};
 const bus=createMix(ctx as any);assert.deepEqual(connections,[['gain2','gain1'],['gain3','gain1'],['gain1','limiter'],['limiter','destination']]);assert.equal(bus.limiter.ratio.value,20);assert.equal(bus.limiter.threshold.value,-4.5);assert.equal(DEFAULT_AUDIO.volume,.8);assert.ok(DEFAULT_AUDIO.musicVolume>=.6);assert.ok(DEFAULT_AUDIO.effectsVolume>=.8);
});
