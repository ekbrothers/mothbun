from PIL import Image; import numpy as np, json, sys
from scipy import ndimage as nd
# Vehicle sprite strips: one row of frames on #00FF00. Each strip is keyed, split into
# frames at the green gaps, scaled so frame 1 is `height` art px tall, palette-reduced,
# and lightly night-graded with lit pixels (string lights, windows, headlights) kept bright.
# Writes assets/vehicles/<name>.png (frames side by side, bottoms aligned) plus a JSON.
# The scooter gets extra rows: color variants of the scooter, jacket, and pants.

import colorsys
def hsv(rgb):
    f=np.vectorize(lambda r,g,b:colorsys.rgb_to_hsv(r/255,g/255,b/255),otypes=[float,float,float])
    return np.stack(f(rgb[...,0],rgb[...,1],rgb[...,2]),-1)
def from_hsv(h,s,v):
    f=np.vectorize(lambda h,s,v:colorsys.hsv_to_rgb(h,s,v),otypes=[float,float,float])
    return np.stack(f(h,s,v),-1)*255
# (scooter rgb or None, jacket hue/sat or None, pants hue/sat/value scale or None)
SCOOTER_VARIANTS=[
    (None,None,None),                                  # as drawn: dark scooter, olive jacket, jeans
    ((120,200,40),(0.0,0.62),(0.62,0.15,0.55)),        # lime scooter, red jacket, dark pants
    ((240,120,30),(0.50,0.55),(0.58,0.35,1.25)),       # orange scooter, teal jacket, light jeans
    ((200,205,215),(0.78,0.45),(0.10,0.30,1.35)),      # white scooter, purple jacket, khakis
]
# the second rider keeps his clothes and only the scooter changes color
GUY_VARIANTS=[(sc,None,None) for sc,_,_ in SCOOTER_VARIANTS]
def scooter_variant(rgb,alpha,FW,ride_frames,spec):
    sc,jk,pt=spec
    out=rgb.copy()
    if sc is None: return out
    H=rgb.shape[0]; X=hsv(rgb); h,s,v=X[...,0]*360,X[...,1],X[...,2]
    yy,xx=np.mgrid[0:H,0:rgb.shape[1]]; fx=xx%FW; fr=xx//FW
    ride=fr<ride_frames
    # jacket, kept away from the shoes (low in the ride frames, left in the wipeout)
    jacket=alpha&(h>38)&(h<68)&(s>0.12)&(v>0.15)&(v<0.6)&np.where(ride,yy<H*0.55,fx>=55)
    pants=alpha&(h>195)&(h<212)&(s>0.5)&(v>0.25)
    # scooter: dark blue-gray metal along the deck and wheels, and the stem at the front
    low=np.where(fr<ride_frames,H*0.85,H*0.77); stem=np.where(fr<ride_frames,18,12)
    metal=alpha&(v>0.06)&(v<0.45)&(((h>190)&(h<235))|(s<0.2))&((yy>=low)|((fx<=stem)&(yy>=H*0.36)))  # stem starts below the phone
    if jk: out[jacket]=from_hsv(np.full(jacket.sum(),jk[0]),np.full(jacket.sum(),jk[1]),v[jacket])
    if pt: out[pants]=from_hsv(np.full(pants.sum(),pt[0]),np.full(pants.sum(),pt[1]),np.clip(v[pants]*pt[2],0,1))
    out[metal]=np.clip(np.array(sc)[None,:]*(v[metal]/0.3)[:,None],0,255)
    return out

CHAR_H=86
specs={
    # name: (target height of frame 1 in art px, or another sheet to match the scale of; night grade strength)
    'scooter':(104,0.35),     # rider about the drawn rabbit's height so a full jump clears it
    'pedal-wagon':(140,0.6),  # canopy roof still low enough to land on from a full jump
    'streetcar':(180,0.6),
    'stroller':('scooter',0.35),
    'scooter-guy':('scooter',0.35),  # a second rider; scooter colors vary, clothes stay as drawn  # drawn at the scooter's scale so the two people match    # includes the pantograph; the roof sits about 132 px up
}
def frame1_height(name):
    im=np.array(Image.open(f'raw/{name}.png').convert('RGB')).astype(int)
    r,g,b=im[...,0],im[...,1],im[...,2]
    a=nd.binary_opening(~((g>140)&(g>r+50)&(g>b+50)),iterations=1)
    cols=np.where(a.any(0))[0]; gaps=np.where(np.diff(cols)>20)[0]
    end=cols[gaps[0]]+1 if len(gaps) else cols[-1]+1
    ys=np.where(a[:,cols[0]:end].any(1))[0]
    return ys.max()+1-ys.min()
all_specs=dict(specs)
if len(sys.argv)>1: specs={k:v for k,v in specs.items() if k in sys.argv[1:]}
for name,(target,grade) in specs.items():
    if isinstance(target,str):  # match another sheet's raw-to-art scale
        target=all_specs[target][0]*frame1_height(name)/frame1_height(target)
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
    variants={'scooter':SCOOTER_VARIANTS,'scooter-guy':GUY_VARIANTS}.get(name,[(None,None,None)])
    rgb=np.concatenate([scooter_variant(rgb,alpha,FW,4,v) for v in variants]); alpha=np.concatenate([alpha]*len(variants))
    R,G,B=rgb[...,0],rgb[...,1],rgb[...,2]
    lit=(R>170)&(G>110)&(R>B+70)
    night=rgb*np.array([0.55,0.55,0.8])+np.array([8,6,22])
    ng=np.where(lit[...,None],rgb,rgb*(1-grade)+night*grade)
    Image.fromarray(np.dstack([np.clip(ng,0,255),alpha*255]).astype(np.uint8),'RGBA').save(f'assets/vehicles/{name}.png')
    json.dump({'frameWidth':FW,'frameHeight':H,'frames':len(frames),'variants':len(variants)},open(f'assets/vehicles/{name}.json','w'))
    print(name,len(frames),'frames',FW,'x',H)
