import test from 'node:test';
import assert from 'node:assert/strict';
import {canvasPoint,hitBox,movedBox} from '../public/guide-geometry.js';
test('maps touch coordinates on a scaled mobile canvas',()=>{assert.deepEqual(canvasPoint(170,220,{left:20,top:20,width:300,height:400},900,1200),{x:450,y:600});});
test('selects topmost overlapping box',()=>{assert.equal(hitBox([{id:'a',x:0,y:0,width:100,height:100},{id:'b',x:0,y:0,width:100,height:100}],{x:10,y:10}).id,'b');});
test('drag clamps all edges without mutating original',()=>{const b={x:50,y:50,width:100,height:100};assert.deepEqual(movedBox(b,-999,9999,900,1200),{...b,x:0,y:1100});assert.equal(b.x,50);});
