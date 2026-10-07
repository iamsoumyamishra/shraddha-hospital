import { HEIGHT, WIDTH, templateSvg, type Rect } from "./template";
import { mapBetweenQuads, type Point } from "./marks";
import { FINAL_ASSET, FINAL_CORNERS, FINAL_HEIGHT, FINAL_WIDTH, isFinalForm } from "./final-layout";
import type { PaperSurvey } from "./contracts";
export async function svgCanvas(svg:string){const url=URL.createObjectURL(new Blob([svg],{type:"image/svg+xml"}));try{return await imageCanvas(url);}finally{URL.revokeObjectURL(url);}}
async function imageCanvas(url:string){const image=new Image();image.src=url;await image.decode();const canvas=document.createElement("canvas");canvas.width=image.naturalWidth;canvas.height=image.naturalHeight;canvas.getContext("2d")!.drawImage(image,0,0);return canvas;}
export function referenceCanvas(survey:PaperSurvey,page:number){return isFinalForm(survey)?imageCanvas(FINAL_ASSET):svgCanvas(templateSvg(survey,page));}
export function alignPhoto(source:HTMLCanvasElement,corners:Point[],finalForm=false){
  const width=finalForm?FINAL_WIDTH:WIDTH,height=finalForm?FINAL_HEIGHT:HEIGHT;
  const targets=finalForm?FINAL_CORNERS:[{x:40,y:40},{x:WIDTH-40,y:40},{x:WIDTH-40,y:HEIGHT-40},{x:40,y:HEIGHT-40}];
  const map=mapBetweenQuads(targets,corners),pixels=source.getContext("2d")!.getImageData(0,0,source.width,source.height);
  const canvas=document.createElement("canvas");canvas.width=width;canvas.height=height;const ctx=canvas.getContext("2d")!,output=ctx.createImageData(width,height);output.data.fill(255);
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){const p=map(x,y),sx=Math.round(p.x),sy=Math.round(p.y);if(sx<0||sy<0||sx>=source.width||sy>=source.height)continue;const from=(sy*source.width+sx)*4,to=(y*width+x)*4;for(let c=0;c<3;c++)output.data[to+c]=pixels.data[from+c]!;}
  ctx.putImageData(output,0,0);return canvas;
}
export function fieldCrop(canvas:HTMLCanvasElement,rect:Rect){const crop=document.createElement("canvas");crop.width=rect.width;crop.height=rect.height;crop.getContext("2d")!.drawImage(canvas,rect.x,rect.y,rect.width,rect.height,0,0,rect.width,rect.height);return crop;}
/** Remove known printed grid strokes, then enlarge high-contrast writing for OCR. */
export function prepareWrittenCrop(photo:HTMLCanvasElement,blank:HTMLCanvasElement,rect:Rect){
  const crop=fieldCrop(photo,rect),context=crop.getContext("2d")!,pixels=context.getImageData(0,0,crop.width,crop.height),reference=blank.getContext("2d")!.getImageData(rect.x,rect.y,rect.width,rect.height);
  for(let y=0;y<crop.height;y++)for(let x=0;x<crop.width;x++){const i=(y*crop.width+x)*4;let grid=false;for(let dy=-1;dy<=1&&!grid;dy++)for(let dx=-1;dx<=1;dx++){const xx=x+dx,yy=y+dy;if(xx<0||yy<0||xx>=crop.width||yy>=crop.height)continue;const j=(yy*crop.width+xx)*4;if((reference.data[j]!+reference.data[j+1]!+reference.data[j+2]!)/3<170){grid=true;break;}}
    const gray=(pixels.data[i]!+pixels.data[i+1]!+pixels.data[i+2]!)/3;const value=grid?255:Math.max(0,Math.min(255,(gray-80)*255/150));pixels.data[i]=pixels.data[i+1]=pixels.data[i+2]=value;}
  context.putImageData(pixels,0,0);const enlarged=document.createElement("canvas");enlarged.width=crop.width*3;enlarged.height=crop.height*3;enlarged.getContext("2d")!.drawImage(crop,0,0,enlarged.width,enlarged.height);return enlarged;
}
export function downloadFile(blob:Blob,filename:string){const url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
