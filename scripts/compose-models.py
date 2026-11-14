#!/usr/bin/env python3
"""Place three actual viewer captures side by side, without resampling."""
from pathlib import Path
import sys
from PIL import Image
root = Path(__file__).resolve().parent.parent
source = Path(sys.argv[1])
images = [Image.open(source / (name + '.png')).convert('RGB') for name in ['su27','chear','epilot']]
assert [im.size for im in images] == [(720,720),(360,720),(360,720)]
canvas = Image.new('RGB', (1440,720))
x = 0
for im in images:
    canvas.paste(im, (x,0))
    x += im.width
canvas.save(root / 'public/images/model-exhibits.png')
