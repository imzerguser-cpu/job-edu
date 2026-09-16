import type {BuildingId} from './buildings';

const positions:Record<Exclude<BuildingId,'bank'>,string>={
  store:'0% 0%',broadcast:'50% 0%',art:'100% 0%',
  library:'0% 50%',post:'50% 50%',environment:'100% 50%',
  event:'0% 100%',culture:'50% 100%',mypage:'100% 100%',
};

export function DestinationIcon({id,className=''}:{id:BuildingId;className?:string}){
  return id==='bank'
    ?<img className={`destination-icon ${className}`} src="/assets/icons/bank-v2.png" alt="" width={56} height={56}/>
    :<span aria-hidden="true" className={`destination-icon destination-sprite ${className}`} style={{backgroundPosition:positions[id]}}/>;
}
