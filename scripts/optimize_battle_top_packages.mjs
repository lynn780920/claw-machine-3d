import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';

function optimize(file) {
  const bytes=fs.readFileSync(file);
  const jsonLength=bytes.readUInt32LE(12);
  const gltf=JSON.parse(bytes.toString('utf8',20,20+jsonLength));
  const binHeader=20+jsonLength;
  const bin=bytes.subarray(binHeader+8,binHeader+8+bytes.readUInt32LE(binHeader));
  const temp=fs.mkdtempSync(path.join(os.tmpdir(),'battle-top-textures-'));
  const replacements=new Map();
  try {
    for(const [index,image] of gltf.images.entries()) {
      if(image.mimeType!=='image/png') continue;
      const view=gltf.bufferViews[image.bufferView];
      const png=path.join(temp,`${index}.png`),jpg=path.join(temp,`${index}.jpg`);
      fs.writeFileSync(png,bin.subarray(view.byteOffset,view.byteOffset+view.byteLength));
      execFileSync('ffmpeg',['-y','-loglevel','error','-i',png,'-frames:v','1','-q:v','2',jpg]);
      replacements.set(image.bufferView,fs.readFileSync(jpg));
      image.mimeType='image/jpeg';
    }
  } finally {
    if(!temp.startsWith(os.tmpdir()+path.sep)) throw new Error('Unsafe temporary path');
    fs.rmSync(temp,{recursive:true,force:true});
  }
  const chunks=[];
  let offset=0;
  for(const [index,view] of gltf.bufferViews.map((view,index)=>[index,view]).sort((a,b)=>(a[1].byteOffset??0)-(b[1].byteOffset??0))) {
    const source=replacements.get(index) ?? bin.subarray(view.byteOffset??0,(view.byteOffset??0)+view.byteLength);
    const pad=(4-offset%4)%4;
    if(pad) chunks.push(Buffer.alloc(pad));
    offset+=pad;
    view.byteOffset=offset;
    view.byteLength=source.length;
    chunks.push(source);
    offset+=source.length;
  }
  const packedBin=Buffer.concat(chunks);
  gltf.buffers[0].byteLength=packedBin.length;
  const json=Buffer.from(JSON.stringify(gltf));
  const jsonPad=(4-json.length%4)%4,binPad=(4-packedBin.length%4)%4;
  const result=Buffer.alloc(12+8+json.length+jsonPad+8+packedBin.length+binPad);
  result.write('glTF',0,'ascii'); result.writeUInt32LE(2,4); result.writeUInt32LE(result.length,8);
  result.writeUInt32LE(json.length+jsonPad,12); result.write('JSON',16,'ascii');
  json.copy(result,20); result.fill(0x20,20+json.length,20+json.length+jsonPad);
  const at=20+json.length+jsonPad;
  result.writeUInt32LE(packedBin.length+binPad,at); result.write('BIN\0',at+4,'ascii');
  packedBin.copy(result,at+8);
  fs.writeFileSync(file,result);
  console.log(`${path.basename(file)}: ${bytes.length} -> ${result.length} bytes`);
}

for(const file of process.argv.slice(2)) optimize(file);
