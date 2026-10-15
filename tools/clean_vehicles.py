from PIL import Image; import numpy as np, json, sys
from scipy import ndimage as nd
# Vehicle sprite strips: one row of frames on #00FF00. Each strip is keyed, split into
# frames at the green gaps, scaled so frame 1 is `height` art px tall, palette-reduced,
# and lightly night-graded with lit pixels (string lights, windows, headlights) kept bright.
# Writes assets/vehicles/<name>.png (frames side by side, bottoms aligned) plus a JSON.
CHAR_H=86
specs={
    # name: (target height of frame 1 in art px, night grade strength)
    'scooter':(104,0.35),     # rider about the drawn rabbit's height so a full jump clears it
    'pedal-wagon':(112,0.6),  # canopy roof low enough to land on from a jump
    'streetcar':(180,0.6),    # includes the pantograph; the roof sits about 132 px up
}
if len(sys.argv)>1: specs={k:v for k,v in specs.items() if k in sys.argv[1:]}
for name,(target,grade) in specs.items():
    im=np.array(Image.open(f'raw/{name}.png').convert('RGB')).astype(float)
    r,g,b=im[...,0],im[...,1],im[...,2]
    a=~((g>140)&(g>r+50)&(g>b+50))
    a=nd.binary_opening(a,iterations=1)
    edge=a&nd.binary_dilation(~a,iterations=3)
    mx=np.maximum(r,b); im[...,1]=np.where(edge&(g>mx),mx,g)
    # split into frames at column gaps of 20+ px
    cols=a.any(0); runs=[]; x=0; W0=len(cols)
    while x<W0:
        if cols[x]:
            s=x
            while x<W0 and (cols[x:x+20].any()): x+=1
            runs.append((s,x))
        x+=1
    runs=[(s,e) for s,e in runs if e-s>40]
    rows=a.any(1); ys=np.where(rows)[0]; y0,y1=ys.min(),ys.max()+1
    f1=a[:,runs[0][0]:runs[0][1]]; fy=np.where(f1.any(1))[0]
    k=target/(fy.max()+1-fy.min())
    H=round((y1-y0)*k)
    frames=[]
    for s,e in runs:
        crop=im[y0:y1,s:e]; ca=a[y0:y1,s:e]
        Wf=round((e-s)*k)
        pm=Image.fromarray(np.uint8(np.dstack([crop*ca[...,None],ca*255])),'RGBA')
        small=np.array(pm.resize((Wf,H),Image.BOX)).astype(float)
        al=small[...,3]/255
        frames.append((np.where(al[...,None]>0,small[...,:3]/np.maximum(al[...,None],1e-6),0),al>0.5))
    FW=max(f[0].shape[1] for f in frames)
    rgb=np.zeros((H,FW*len(frames),3)); alpha=np.zeros((H,FW*len(frames)),bool)
    for i,(c,al) in enumerate(frames):
        rgb[:,i*FW:i*FW+c.shape[1]]=c; alpha[:,i*FW:i*FW+c.shape[1]]=al
    q=Image.fromarray(np.uint8(np.clip(rgb,0,255))).quantize(colors=48,method=Image.Quantize.MEDIANCUT).convert('RGB')
    rgb=np.array(q).astype(float)
    Image.fromarray(np.dstack([rgb,alpha*255]).astype(np.uint8),'RGBA').save(f'assets/vehicles/day/{name}.png')
    R,G,B=rgb[...,0],rgb[...,1],rgb[...,2]
    lit=(R>170)&(G>110)&(R>B+70)
    night=rgb*np.array([0.55,0.55,0.8])+np.array([8,6,22])
    ng=np.where(lit[...,None],rgb,rgb*(1-grade)+night*grade)
    Image.fromarray(np.dstack([np.clip(ng,0,255),alpha*255]).astype(np.uint8),'RGBA').save(f'assets/vehicles/{name}.png')
    json.dump({'frameWidth':FW,'frameHeight':H,'frames':len(frames)},open(f'assets/vehicles/{name}.json','w'))
    print(name,len(frames),'frames',FW,'x',H)
