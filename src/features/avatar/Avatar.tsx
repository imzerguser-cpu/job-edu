import {StorybookAvatar} from './StorybookAvatar';
import {defaultStorybook,type StorybookAppearance} from '../../domain/storybook';

// 학생 캐릭터는 동화 캐릭터 하나로 통일했다(D-121, 사용자 요청 — 기존 벡터 캐릭터 제거).
// 아직 꾸미지 않은 학생은 학년 평균 체형의 기본 동화 캐릭터로 보인다.
export function Avatar({storybook,grade=3,className='',label='내 캐릭터'}:{storybook?:StorybookAppearance;grade?:number;className?:string;label?:string}){
  const a=storybook??defaultStorybook(grade);
  return <span className={`avatar-art ${className}`}><StorybookAvatar style={a.style} shape={a.shape} collection={a.collection} label={label}/></span>;
}
