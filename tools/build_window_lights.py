from PIL import Image; import numpy as np, json
from scipy import ndimage as nd
# Splits each night-graded building into a lights-off base and a lit-windows overlay,
# plus a list of window rects so the game can switch windows on and off one at a time.
# Lit glass and the cream trim share the same palette colors, so windows are found by
# shape: solid blocks at least 3 px tall survive, thin trim lines and bands do not.
DARK=np.array([28,24,52])
for name in ['music-hall','mother-of-god']:
    im=np.array(Image.open(f'assets/buildings/{name}.png').convert('RGBA')).astype(float)
    R,G,B,A=im[...,0],im[...,1],im[...,2],im[...,3]
    lit=(R>170)&(G>110)&(R>B+70)&(A>0)
    core=nd.binary_opening(lit,structure=np.ones((3,2)))
    lab,n=nd.label(core,structure=np.ones((3,3)))
    for i,sl in enumerate(nd.find_objects(lab),1):
        h=sl[0].stop-sl[0].start; w=sl[1].stop-sl[1].start
        if w>4*h or h>5*w or w>24 or h<=3: core[sl][lab[sl]==i]=False
    win=nd.binary_dilation(core,iterations=1)&lit
    # group neighboring panes into one window
    grp,n=nd.label(nd.binary_dilation(win,iterations=2))
    rects=[]
    for sl in nd.find_objects(grp):
        m=win[sl]
        if not m.any(): continue
        ys,xs=np.where(m)
        rects.append([int(sl[1].start+xs.min()),int(sl[0].start+ys.min()),int(xs.max()-xs.min()+1),int(ys.max()-ys.min()+1)])
    off=im.copy(); off[win,:3]=DARK+(im[win,:3]-DARK)*0.12
    lights=np.zeros_like(im); lights[win]=im[win]
    Image.fromarray(np.uint8(off),'RGBA').save(f'assets/buildings/{name}-dark.png')
    Image.fromarray(np.uint8(lights),'RGBA').save(f'assets/buildings/{name}-lights.png')
    json.dump(rects,open(f'assets/buildings/{name}-windows.json','w'))
    print(name,'windows',len(rects),'px',int(win.sum()))
