from PIL import Image; import numpy as np
from scipy import ndimage as nd
# Keys out the green, snaps the ChatGPT logo to its ~11.7 px pixel grid, and recolors
# the blue wings and pink inner ears to match the rabbit's charcoal and concrete.
GRID=11.7
im=np.array(Image.open('raw/logo.png').convert('RGB')).astype(float)
r,g,b=im[...,0],im[...,1],im[...,2]
a=nd.binary_opening(~((g>140)&(g>r+50)&(g>b+50)),iterations=1)
ys,xs=np.where(a); im=im[ys.min():ys.max()+1,xs.min():xs.max()+1]; a=a[ys.min():ys.max()+1,xs.min():xs.max()+1]
edge=a&nd.binary_dilation(~a,iterations=3); mx=np.maximum(im[...,0],im[...,2]); im[...,1]=np.where(edge&(im[...,1]>mx),mx,im[...,1])
W=round(a.shape[1]/GRID); H=round(a.shape[0]/GRID)
s=np.array(Image.fromarray(np.uint8(np.dstack([im*a[...,None],a*255])),'RGBA').resize((W,H),Image.BOX)).astype(float)
al=s[...,3]/255; rgb=np.where(al[...,None]>0,s[...,:3]/np.maximum(al[...,None],1e-6),0)
rgb=np.array(Image.fromarray(np.uint8(np.clip(rgb,0,255))).quantize(colors=32,method=Image.Quantize.MEDIANCUT).convert('RGB')).astype(float)
R,G,B=rgb[...,0],rgb[...,1],rgb[...,2]
lum=(R*0.3+G*0.59+B*0.11)[...,None]
blue=(B>R+15)&(B>G)
# inner ears: the red pixels in the box above the T and H
yy,xx=np.mgrid[0:H,0:W]
pink=(R>90)&(R>G+40)&(R>B+40)&(yy<H*0.3)&(xx>W*0.42)&(xx<W*0.61)
rgb=np.where(blue[...,None],lum*np.array([0.78,0.76,0.74]),rgb)
rgb=np.where(pink[...,None],lum*np.array([0.95,0.9,0.82]),rgb)
Image.fromarray(np.dstack([np.clip(rgb,0,255),(al>0.5)*255]).astype(np.uint8),'RGBA').save('assets/ui/logo.png')
print('logo',W,H)
