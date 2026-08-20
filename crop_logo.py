from PIL import Image

source = "/home/ubuntu/webdev-static-assets/tribull-logo-clean.png"
target = "/home/ubuntu/webdev-static-assets/tribull-logo-cropped.png"
image = Image.open(source).convert("RGBA")
alpha = image.getchannel("A")
box = alpha.getbbox()
if box:
    image.crop(box).save(target)
else:
    image.save(target)
