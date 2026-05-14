const fs = require('fs');
const { PNG } = require('pngjs');

fs.createReadStream('public/tileset.png')
  .pipe(new PNG())
  .on('parsed', function() {
    const w = this.width;
    const h = this.height;
    
    // Grid size might be 128x128? 1024 / 8 = 128
    const cols = 8;
    const rows = 8;
    const tileW = w / cols;
    const tileH = h / rows;
    
    for(let r=0; r<rows; r++) {
      for(let c=0; c<cols; c++) {
        let hasPixels = false;
        let minX = tileW, maxX = 0, minY = tileH, maxY = 0;
        for(let y=0; y<tileH; y++) {
          for(let x=0; x<tileW; x++) {
             const idx = (w * (r*tileH + y) + (c*tileW + x)) << 2;
             if(this.data[idx+3] > 10) {
               hasPixels = true;
               if(x < minX) minX = x;
               if(x > maxX) maxX = x;
               if(y < minY) minY = y;
               if(y > maxY) maxY = y;
             }
          }
        }
        if(hasPixels) {
          console.log(`[${c}, ${r}] (size ${maxX - minX + 1}x${maxY - minY + 1}) - bounds: x(${minX}-${maxX}), y(${minY}-${maxY})`);
        }
      }
    }
  });
