import {launch,watchErrors} from './common.mjs';
import assert from 'node:assert/strict';
const b=await launch(),p=await b.newPage({viewport:{width:390,height:844}}),errors=[];watchErrors(p,errors);const T=id=>p.getByTestId(id),base=process.env.UI_BASE??'http://localhost:4173';
try{
 await p.goto(base+'/?webgl=0');await T('start').click();await T('tutorial-skip').waitFor();await p.goBack();await T('tutorial-skip').waitFor({state:'detached'});
 for(const mode of ['escape','outside','back']){
  if(!await T('job-card').isVisible())await T('job-chip').click();
  if(mode==='escape')await p.keyboard.press('Escape');else if(mode==='outside')await p.mouse.click(387,650);else await p.goBack();
  await T('job-card').waitFor({state:'detached'});
 }
 await T('job-chip').click();await T('skip-intro').click();assert.equal(await p.evaluate(()=>localStorage.getItem('ww-skip-intros')),'1');
 await T('tray-Splitter').first().click();await T('socket-r').click();
 for(const mode of ['escape','outside','back']){
  console.log('part',mode);if(!await T('sheet').count())await T('socket-r').click();
  if(mode==='escape')await p.keyboard.press('Escape');else if(mode==='outside')await p.mouse.click(387,90);else await p.goBack();
  await T('sheet').waitFor({state:'detached'});
 }
 await p.keyboard.press('?');await T('help-sheet').waitFor();await p.keyboard.press('Escape');await T('help-sheet').waitFor({state:'detached'});
 await T('sound').click();await p.getByLabel('Music volume',{exact:true}).fill('.3');await p.getByLabel('Effects volume',{exact:true}).fill('.4');await T('sound-popover').getByRole('button',{name:'Mute / unmute'}).click();assert.equal(await T('sound-popover').getByLabel('Music',{exact:true}).isChecked(),false);await T('sound-popover').getByRole('button',{name:'Mute / unmute'}).click();await p.keyboard.press('Escape');await p.reload();await T('sound').click();assert.equal(await p.getByLabel('Music volume',{exact:true}).inputValue(),'0.3');assert.equal(await p.getByLabel('Effects volume',{exact:true}).inputValue(),'0.4');
 await p.goto(base+'/?lowfx=1&webgl=0');await T('sound').click();assert.equal(await T('sound-popover').getByLabel('Music',{exact:true}).isChecked(),false);assert.equal(await T('sound-popover').getByLabel('Effects',{exact:true}).isChecked(),false);
 // The same history lifecycle also protects the optional shop setup sheet.
 for(const mode of ['escape','outside','back']){
  await p.goto(base+'/?webgl=0&job=5');await T('shop-setup').waitFor();
  if(mode==='escape')await p.keyboard.press('Escape');else if(mode==='outside')await p.mouse.click(387,750);else await p.goBack();
  await T('shop-setup').waitFor({state:'detached'});
 }
 const unexpected=errors.filter(e=>!/^requestfailed:.*\/sounds\/.*net::ERR_ABORTED$/.test(e));assert.equal(unexpected.length,0,unexpected.join('\n'));console.log('Expected navigation-cancelled preload requests:',errors.length-unexpected.length);console.log('PASS tutorial Back, card/part/shop Esc/outside/Back, remembered intro, contextual ?, sound persistence/mute/lowfx');
}finally{await b.close();}
