from PIL import Image, ImageDraw
from pathlib import Path

root = Path(__file__).resolve().parents[1] / 'assets'
im = Image.new('RGBA', (32, 32))
d = ImageDraw.Draw(im)
def polygon(points, color):
    d.polygon([(x+4,y+4) for x,y in points],fill=color)
def rect(x,y,w,h,color):
    d.rectangle((x+4,y+4,x+w+3,y+h+3),fill=color)
polygon([(8,2),(16,2),(16,5),(19,5),(19,10),(22,10),(22,18),(19,18),(19,21),(5,21),(5,18),(2,18),(2,10),(5,10),(5,5),(8,5)],'#704028')
rect(9,3,3,5,'#82ac52');rect(13,4,4,3,'#82ac52');rect(6,6,4,3,'#82ac52')
polygon([(6,10),(18,10),(18,12),(21,12),(21,17),(18,17),(18,20),(6,20),(6,17),(3,17),(3,12),(6,12)],'#f4bd53')
rect(6,11,4,2,'#ffe29b');rect(4,13,3,3,'#ffe29b');rect(17,12,3,5,'#d88336');rect(13,17,5,2,'#d88336')
rect(10,13,2,2,'#aa572f');rect(15,13,2,2,'#aa572f');rect(12,16,3,1,'#aa572f')
large=im.resize((256,256),Image.Resampling.NEAREST)
large.save(root/'app.ico',format='ICO',sizes=[(16,16),(24,24),(32,32),(48,48),(64,64),(128,128),(256,256)])
large.save(root/'app-icon.png')
print(root/'app.ico')
