from PIL import Image; import numpy as np, sys
from scipy import ndimage as nd
CHAR_H=86
specs={'house':('house',3.6,0.35),'music-hall':('music-hall',4.9,1.0),'mother-of-god':('mother-of-god',5.7,1.0),'museum-center':('museum-center',3.6,1.0)}
# optional: python tools/clean_buildings.py museum-center  (only rebuild the named ones)
if len(sys.argv)>1: specs={k:v for k,v in specs.items() if k in sys.argv[1:]}
for name,(f,mult,grade) in specs.items():
    im=np.array(Image.open(f'raw/{f}.png').convert('RGB')).astype(float)
    r,g,b=im[...,0],im[...,1],im[...,2]
    green=(g>140)&(g>r+50)&(g>b+50)
    a=~green
    a=nd.binary_opening(a,iterations=1)
    # despill near edges
    edge=a & nd.binary_dilation(~a,iterations=3)
    mx=np.maximum(r,b)
    im[...,1]=np.where(edge&(g>mx),mx,g)
    ys,xs=np.where(a); im=im[ys.min():ys.max()+1,xs.min():xs.max()+1]; a=a[ys.min():ys.max()+1,xs.min():xs.max()+1]
    H=round(CHAR_H*mult); W=round(a.shape[1]*H/a.shape[0])
    pm=Image.fromarray(np.uint8(np.dstack([im*a[...,None],a*255])),'RGBA')
    small=np.array(pm.resize((W,H),Image.BOX)).astype(float)
    al=small[...,3]/255; rgb=np.where(al[...,None]>0,small[...,:3]/np.maximum(al[...,None],1e-6),0)
    alpha=(al>0.5)
    q=Image.fromarray(np.uint8(np.clip(rgb,0,255))).quantize(colors=40,method=Image.Quantize.MEDIANCUT).convert('RGB')
    rgb=np.array(q).astype(float)
    out=np.dstack([rgb,alpha*255]).astype(np.uint8)
    Image.fromarray(out,'RGBA').save(f'assets/buildings/day/{name}.png')
    # night grade, keep warm lit windows
    R,G,B=rgb[...,0],rgb[...,1],rgb[...,2]
    lit=(R>170)&(G>110)&(R>B+70)
    night=rgb*np.array([0.55,0.55,0.8])+np.array([8,6,22])
    ng=rgb*(1-grade)+night*grade
    ng=np.where(lit[...,None],rgb,ng)
    outn=np.dstack([np.clip(ng,0,255),alpha*255]).astype(np.uint8)
    Image.fromarray(outn,'RGBA').save(f'assets/buildings/{name}.png')
    print(name,W,H)
