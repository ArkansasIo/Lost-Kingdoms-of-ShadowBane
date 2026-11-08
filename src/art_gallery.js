'use strict';
const GBQ_ART_GALLERY = [
  { id: 'gbq_master_catalog', title: 'DARK FANTASY MASTER ASSET CATALOG' },
  { id: 'gbq_ui_mockup_catalog', title: 'NEW UI / SPRITESHEET MOCKUP COLLECTION' },
  { id: 'gbq_reference_title', title: 'GB QUEST TITLE SCREEN REFERENCE', src: 'https://hebbkx1anhila5yf.public.blob.vercel-storage.com/CF4ED177-83D0-46D9-B88E-9C9BADBB982F-HQp5koURRXHe9VIjxyNQLHg5Jp0ry7.png' },
  { id: 'gbq_reference_catalog', title: 'COMPLETE ASSET PACK REFERENCE', src: 'https://hebbkx1anhila5yf.public.blob.vercel-storage.com/4352877E-889F-40F4-906D-B00E3E84961D.png-gmVnINuXmP4gdkUzvMIZHeh3P7ksiw.jpeg' },
  { id: 'gbq_reference_systems', title: 'FULL SYSTEMS AND UI REFERENCE', src: 'https://hebbkx1anhila5yf.public.blob.vercel-storage.com/B5E2A986-8590-4303-8486-0CB7F47C926A.png-72EVK7Fu4cRDu7MD6eGuassykjDgbC.jpeg' },
  { id: 'gbq_reference_systems_alt', title: 'FULL SYSTEMS REFERENCE ALT', src: 'https://hebbkx1anhila5yf.public.blob.vercel-storage.com/B5E2A986-8590-4303-8486-0CB7F47C926A.png-rJePJeZUBBC8AaXltUwfMUfKeBuNt6.jpeg' }
];
const GBQ_REMOTE_ART = new Map();
function gbqGalleryImage(entry) {
  if (!entry.src) return IMG[entry.id];
  if (!GBQ_REMOTE_ART.has(entry.id)) {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.src = entry.src;
    GBQ_REMOTE_ART.set(entry.id, image);
  }
  const image = GBQ_REMOTE_ART.get(entry.id);
  return image.complete && image.naturalWidth ? image : null;
}
class ArtGalleryScene {
  constructor() { this.opaque = true; this.page = 0; this.zoom = 1; this.panY = 0; }
  update() {
    if (P('b') || P('start')) { SFX.close(); removeScene(this); return; }
    if (P('left')) { this.page = (this.page + GBQ_ART_GALLERY.length - 1) % GBQ_ART_GALLERY.length; this.panY = 0; SFX.cursor(); }
    if (P('right')) { this.page = (this.page + 1) % GBQ_ART_GALLERY.length; this.panY = 0; SFX.cursor(); }
    if (P('a')) { this.zoom = this.zoom === 1 ? 2 : 1; if (this.zoom === 1) this.panY = 0; SFX.select(); }
    if (this.zoom > 1 && P('up')) { this.panY = Math.min(32, this.panY + 8); SFX.cursor(); }
    if (this.zoom > 1 && P('down')) { this.panY = Math.max(-32, this.panY - 8); SFX.cursor(); }
  }
  draw() {
    fill(0, 0, W, H, 0); hdr();
    const entry = GBQ_ART_GALLERY[this.page], img = gbqGalleryImage(entry);
    text('MASTER ART CATALOG', 4, 14, 'gold');
    textR((this.page + 1) + '/' + GBQ_ART_GALLERY.length, W - 4, 14, 2);
    frame(2, 23, W - 4, 104);
    if (img) {
      const fit = Math.min((W - 10) / img.width, 96 / img.height);
      const scale = fit * this.zoom;
      const dw = Math.max(1, Math.floor(img.width * scale)), dh = Math.max(1, Math.floor(img.height * scale));
      const maxPan = Math.max(0, Math.floor((dh - 96) / 2));
      const pan = Math.max(-maxPan, Math.min(maxPan, this.panY));
      const old = ctx.imageSmoothingEnabled; ctx.imageSmoothingEnabled = false;
      ctx.save(); ctx.beginPath(); ctx.rect(5, 27, W - 10, 96); ctx.clip();
      ctx.drawImage(img, Math.floor((W - dw) / 2), 27 + Math.floor((96 - dh) / 2) + pan, dw, dh);
      ctx.restore(); ctx.imageSmoothingEnabled = old;
    } else textC('MASTER ART NOT INSTALLED', W / 2, 70, 'gold');
    textC(entry.title, W / 2, 138, 2);
    textC(this.zoom === 1 ? 'A: ZOOM  |  LEFT / RIGHT: SHEET' : 'A: FIT  |  UP / DOWN: PAN', W / 2, 143, 1);
  }
}
