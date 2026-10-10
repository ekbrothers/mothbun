from PIL import Image; import numpy as np, json
from scipy import ndimage as nd
from collections import Counter
src=np.array(Image.open('raw/character-sheet.png').convert('RGB')).astype(int)
r,g,b=src[...,0],src[...,1],src[...,2]
green=(g>140)&(g>r+60)&(g>b+60)
fg=nd.binary_opening(~green,iterations=1)
lab,n=nd.label(fg)
objs=nd.find_objects(lab); sizes=nd.sum(fg,lab,range(1,n+1))
blobs=[(i+1,s) for i,s in enumerate(objs) if sizes[i]>20000]
assert len(blobs)==12
blobs.sort(key=lambda t:(t[1][0].stop>400)+(t[1][0].stop>800))
rows=[sorted([bb for bb in blobs if ((bb[1][0].stop>400)+(bb[1][0].stop>800))==k],key=lambda t:t[1][1].start) for k in range(3)]
P=4
# grid phase from edge positions
def phase(axis):
    e=(np.abs(np.diff(src,axis=axis)).sum(2)>40)
    pos=np.where(e.any(axis=1-axis) if False else e)[1-axis if axis==1 else 0]
    return Counter(((pos+1)%P).tolist()).most_common(1)[0][0]
px=phase(1); py=phase(0)
print('phase',px,py)
frames=[]
for k,row in enumerate(rows):
    for j,(L,s) in enumerate(row):
        y0=(s[0].start-py)//P*P+py-P; x0=(s[1].start-px)//P*P+px-P
        y1=s[0].stop+P; x1=s[1].stop+P
        m=(lab[y0:y1,x0:x1]==L)
        m=nd.binary_fill_holes(m)
        c=src[y0:y1,x0:x1]
        H=(y1-y0)//P; W=(x1-x0)//P
        out=np.zeros((H,W,4),np.uint8)
        for yy in range(H):
            for xx in range(W):
                bm=m[yy*P:(yy+1)*P,xx*P:(xx+1)*P]
                if bm.mean()<0.5: continue
                bc=c[yy*P:(yy+1)*P,xx*P:(xx+1)*P][bm]
                # drop greenish fringe pixels
                gc=bc[~((bc[:,1]>bc[:,0]+25)&(bc[:,1]>bc[:,2]+25))]
                if len(gc)==0: continue
                q=(gc//8)*8
                t=Counter(map(tuple,q.tolist())).most_common(1)[0][0]
                sel=gc[np.all(q==t,axis=1)]
                out[yy,xx,:3]=sel.mean(0).astype(np.uint8); out[yy,xx,3]=255
        a=out[...,3]>0
        ys,xs=np.where(a)
        out=out[ys.min():ys.max()+1,xs.min():xs.max()+1]
        rr,gg,bb2=[out[...,i].astype(int) for i in range(3)]
        eye=(rr>170)&(gg<90)&(bb2<90)&(out[...,3]>0)
        ey,ex=np.where(eye)
        frames.append(dict(row=k,col=j,img=out,eye=(float(ex.mean()),float(ey.mean())) if len(ex) else None))
        print(k,j,out.shape,frames[-1]['eye'])
import pickle; pickle.dump(frames,open('tools/frames.pkl','wb'))
