import fs from 'node:fs';
import path from 'node:path';

function mirrorPackage(source, destination) {
  const bytes=fs.readFileSync(source);
  if (bytes.toString('ascii',0,4)!=='glTF' || bytes.readUInt32LE(4)!==2) throw new Error(`Not GLB 2: ${source}`);
  const jsonLength=bytes.readUInt32LE(12);
  const gltf=JSON.parse(bytes.toString('utf8',20,20+jsonLength));
  const binHeader=20+jsonLength;
  if (bytes.toString('ascii',binHeader+4,binHeader+8)!=='BIN\0') throw new Error(`Missing BIN: ${source}`);
  const bin=Buffer.from(bytes.subarray(binHeader+8,binHeader+8+bytes.readUInt32LE(binHeader)));

  for (const [frontName,backName] of [['body_front','back_body'],['header_front','back_header']]) {
    const frontNode=gltf.nodes.find(node=>node.name===frontName);
    const backNode=gltf.nodes.find(node=>node.name===backName);
    if (frontNode?.mesh===undefined || backNode?.mesh===undefined) throw new Error(`Missing package face: ${source}`);
    const front=gltf.meshes[frontNode.mesh].primitives[0];
    const back=gltf.meshes[backNode.mesh].primitives[0];
    if (gltf.accessors[front.attributes.TEXCOORD_0].count!==gltf.accessors[back.attributes.POSITION].count)
      throw new Error(`Mismatched face vertices: ${source}`);
    back.attributes={POSITION:back.attributes.POSITION,TEXCOORD_0:front.attributes.TEXCOORD_0};
    back.material=front.material;
  }

  const json=Buffer.from(JSON.stringify(gltf));
  const jsonPad=(4-json.length%4)%4;
  const binPad=(4-bin.length%4)%4;
  const result=Buffer.alloc(12+8+json.length+jsonPad+8+bin.length+binPad);
  result.write('glTF',0,'ascii');
  result.writeUInt32LE(2,4);
  result.writeUInt32LE(result.length,8);
  result.writeUInt32LE(json.length+jsonPad,12);
  result.write('JSON',16,'ascii');
  json.copy(result,20);
  result.fill(0x20,20+json.length,20+json.length+jsonPad);
  const binAt=20+json.length+jsonPad;
  result.writeUInt32LE(bin.length+binPad,binAt);
  result.write('BIN\0',binAt+4,'ascii');
  bin.copy(result,binAt+8);
  fs.writeFileSync(destination,result);
}

const downloads=process.argv[2];
if (!downloads) throw new Error('Usage: node scripts/mirror_battle_top_packages.mjs <directory containing supplied GLBs>');
for (const [sourceName,destName] of [['CX13','battle_top_cx13'],['BX50','battle_top_bx50']]) {
  mirrorPackage(path.join(downloads,`Beyblade_${sourceName}_WedgePackage.glb`),
    path.join('public','models','prizes',`${destName}.glb`));
}
