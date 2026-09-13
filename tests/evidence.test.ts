import {describe,it,expect} from 'vitest';
import {validateEvidence,EVIDENCE_MAX_BASE64_LENGTH} from '../src/domain/evidence';
describe('사진 증빙 검증',()=>{
  it('JPEG가 아닌 형식을 거부한다',()=>{expect(()=>validateEvidence('image/png','abc')).toThrow()});
  it('빈 데이터나 과대 용량을 거부한다',()=>{
    expect(()=>validateEvidence('image/jpeg','')).toThrow();
    expect(()=>validateEvidence('image/jpeg','x'.repeat(EVIDENCE_MAX_BASE64_LENGTH+1))).toThrow();
  });
  it('올바른 사진 데이터는 통과한다',()=>{expect(()=>validateEvidence('image/jpeg','x'.repeat(100))).not.toThrow()});
});
