import {describe,it,expect} from 'vitest';
import {headLayout,featureLayout,faceWidthAt} from '../src/features/avatar/StorybookParts';
describe('face alignment',()=>{
 it('keeps all mouths above the chin for every head',()=>{for(let h=0;h<10;h++){const head=headLayout(h);for(let m=0;m<10;m++){const mouth=featureLayout('mouth',m,head.mouth);expect(mouth.y+mouth.height).toBeLessThan(head.chin);}}});
 it('keeps nose bridges above their tips and mouths below the nose for all heads',()=>{for(let h=0;h<10;h++){const head=headLayout(h);expect(head.eyes).toBeLessThan(head.nose);expect(head.nose).toBeLessThan(head.mouth);for(let n=0;n<10;n++){const nose=featureLayout('nose',n,head.nose);expect(nose.y).toBeLessThan(head.nose);expect(nose.y+nose.height).toBeLessThan(head.mouth);}}});
 it('preserves the sparkle spacing, narrows smiling eyes independently, and reduces eye size',()=>{for(let i=0;i<10;i++){const eye=featureLayout('eyes',i,0);const originalWidth=eye.rect[2]*Math.min(275/eye.rect[2],110/eye.rect[3]);const factor=i===9?.97:[3,5,8].includes(i)?.85:.94;expect(eye.eyeCenter).toBeCloseTo((originalWidth/4+18)*factor);expect(eye.width).toBeCloseTo(originalWidth*.82);}});
});

it('anchors every face shape at the hairline and neck',()=>{for(let h=0;h<10;h++){const {chin}=headLayout(h);for(let f=0;f<4;f++){expect(faceWidthAt(f,-280,chin)).toBe(1);expect(faceWidthAt(f,chin+18,chin)).toBe(1);expect(faceWidthAt(f,20,chin)).toBe(1);}}});
