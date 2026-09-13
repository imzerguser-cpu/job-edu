// Re-encodes any image file to a small JPEG, strips EXIF (canvas redraw doesn't carry it),
// and neutralizes non-image formats (SVG, etc.) since the output is always a rasterized JPEG.
export async function compressImageToBase64(file:File,maxSide=640,maxBytes=60_000):Promise<{mimeType:'image/jpeg';base64:string}>{
  const bitmap=await createImageBitmap(file).catch(()=>{throw new Error('사진 파일을 확인해 주세요.')});
  const scale=Math.min(1,maxSide/Math.max(bitmap.width,bitmap.height));
  const width=Math.max(1,Math.round(bitmap.width*scale)),height=Math.max(1,Math.round(bitmap.height*scale));
  const canvas=document.createElement('canvas');
  canvas.width=width;canvas.height=height;
  const ctx=canvas.getContext('2d');
  if(!ctx)throw new Error('사진을 처리할 수 없습니다.');
  ctx.drawImage(bitmap,0,0,width,height);
  let blob:Blob|null=null,quality=0.82;
  for(let i=0;i<6;i++){
    blob=await new Promise<Blob|null>(resolve=>canvas.toBlob(resolve,'image/jpeg',quality));
    if(!blob)throw new Error('사진을 처리할 수 없습니다.');
    if(blob.size<=maxBytes||quality<=0.3)break;
    quality-=0.15;
  }
  if(!blob||blob.size>maxBytes*2)throw new Error('사진 용량을 줄일 수 없습니다. 더 단순한 사진으로 다시 시도해 주세요.');
  const base64=await new Promise<string>((resolve,reject)=>{
    const reader=new FileReader();
    reader.onload=()=>resolve(String(reader.result).split(',')[1]??'');
    reader.onerror=()=>reject(new Error('사진을 읽을 수 없습니다.'));
    reader.readAsDataURL(blob!);
  });
  return {mimeType:'image/jpeg',base64};
}
