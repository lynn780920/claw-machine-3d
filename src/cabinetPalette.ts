import * as THREE from 'three';

export const CABINET_PALETTES = {
  medium: { shell: 0x498ea0, base: 0x376a7b, trim: 0x75d5d0, panel: 0x405267 },
  small: { shell: 0xd27283, base: 0xa64f67, trim: 0xffb6bd, panel: 0x64465b },
  large: { shell: 0xc99a4e, base: 0x997345, trim: 0xffd889, panel: 0x5e5362 },
  kbasket: { shell: 0x80a75c, base: 0x557a50, trim: 0xc1e384, panel: 0x456268 }
} as const;

export type CabinetPalette = typeof CABINET_PALETTES[keyof typeof CABINET_PALETTES];

export function colorCabinetModel(root: THREE.Object3D, palette: CabinetPalette) {
  root.traverse(object => {
    if (!(object instanceof THREE.Mesh) || !(object.material instanceof THREE.MeshStandardMaterial)) return;
    const name = object.name;
    if (name === 'BaseCabinet' || name === 'Console') object.material.color.setHex(palette.base);
    else if (name.startsWith('Frame_') || name === 'HorizontalFrame' || name === 'DepthFrame' || name === 'Roof') object.material.color.setHex(palette.shell);
    else if (name === 'ConsolePlate' || name === 'PrizeDoorFrame') object.material.color.setHex(palette.trim);
    else if (name === 'BackPanel') object.material.color.setHex(palette.panel);
  });
}
