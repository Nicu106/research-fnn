#!/bin/zsh
S="$(cd "$(dirname "$0")" && pwd)"; cd "$S"
node build.js 2>&1 | grep written
rm -f out.pdf page-*.jpg
osascript -e "tell application \"Pages\"
set d to open POSIX file \"$S/Cociorva_ITIA_2026.docx\"
delay 2
export d to POSIX file \"$S/out.pdf\" as PDF
close d saving no
end tell"
pdfinfo out.pdf | grep Pages
pdftoppm -jpeg -r 80 out.pdf page
python3 -c "
import glob
from PIL import Image
fs=sorted(glob.glob('page-*.jpg')); ims=[Image.open(f) for f in fs]
w,h=ims[0].size; out=Image.new('RGB',((w+10)*len(ims),h),'#888')
for i,im in enumerate(ims): out.paste(im,(i*(w+10),0))
out.save('sheet.jpg', quality=85)"
