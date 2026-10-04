import {defineConfig,loadEnv} from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig(({command,mode})=>{
  if(command==='build'){
    const env={...loadEnv(mode,process.cwd(),'VITE_'),...process.env};
    const required=['VITE_FIREBASE_API_KEY','VITE_FIREBASE_AUTH_DOMAIN','VITE_FIREBASE_PROJECT_ID','VITE_FIREBASE_APP_ID'];
    const missing=required.filter(key=>!env[key]?.trim());
    if(missing.length)throw new Error(`Cannot build without Firebase login configuration: ${missing.join(', ')}`);
    if(env.VITE_USE_EMULATORS==='true')throw new Error('Cannot publish a build configured for local Firebase emulators.');
  }
  return {plugins:[react()],build:{sourcemap:false,rollupOptions:{input:{main:'index.html',character:'character-preview.html'}}},server:{host:'127.0.0.1',port:5173,strictPort:true}};
});
