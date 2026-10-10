import pickle, numpy as np, json
from PIL import Image
F=pickle.load(open('tools/frames.pkl','rb'))
L=max(int(round(f['eye'][0])) for f in F); R=max(f['img'].shape[1]-int(round(f['eye'][0])) for f in F)
H=max(f['img'].shape[0] for f in F)
CW,CH=L+R+2,H+2
sheet=Image.new('RGBA',(CW*4,CH*3),(0,0,0,0))
meta={'frameWidth':CW,'frameHeight':CH,'anchor':{'x':L+1,'y':CH-1},'rows':{'walk':0,'jump':1,'idle':2},'frames':[]}
for f in F:
    im=Image.fromarray(f['img'])
    ox=L+1-int(round(f['eye'][0])); oy=CH-1-f['img'].shape[0]
    cell=Image.new('RGBA',(CW,CH),(0,0,0,0)); cell.paste(im,(ox,oy))
    name=['walk','jump','idle'][f['row']]+f"_{f['col']+1}.png"
    cell.save('assets/character/frames/'+name)
    sheet.paste(cell,(f['col']*CW,f['row']*CH))
    meta['frames'].append(name)
sheet.save('assets/character/mothbun_sheet.png')
json.dump(meta,open('assets/character/mothbun_sheet.json','w'),indent=1)
print(CW,CH)
