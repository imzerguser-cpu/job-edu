import {initializeApp} from 'firebase/app';
import {getAuth,setPersistence,inMemoryPersistence,connectAuthEmulator} from 'firebase/auth';
import {initializeFirestore,memoryLocalCache,connectFirestoreEmulator} from 'firebase/firestore';
const config={apiKey:import.meta.env.VITE_FIREBASE_API_KEY,authDomain:import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,projectId:import.meta.env.VITE_FIREBASE_PROJECT_ID,appId:import.meta.env.VITE_FIREBASE_APP_ID};
export const configured=Object.values(config).every(v=>typeof v==='string'&&v.length>0);
function createClient(){
  if(!configured)return null;
  const app=initializeApp(config),auth=getAuth(app),db=initializeFirestore(app,{localCache:memoryLocalCache()});
  const emulator=import.meta.env.VITE_USE_EMULATORS==='true';
  if(emulator){
    if(!import.meta.env.DEV||!config.projectId.startsWith('demo-'))throw new Error('에뮬레이터는 개발용 demo 프로젝트에서만 사용합니다.');
    connectAuthEmulator(auth,'http://127.0.0.1:9099',{disableWarnings:true});connectFirestoreEmulator(db,'127.0.0.1',8080);
  }
  const ready=setPersistence(auth,inMemoryPersistence);
  return {auth,db,ready};
}
export const firebase=createClient();
