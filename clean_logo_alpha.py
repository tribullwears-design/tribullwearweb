from PIL import Image

source = "/home/ubuntu/webdev-static-assets/tribull-logo-clean.png"
target = "/home/ubuntu/webdev-static-assets/tribull-logo-transparent.png"
image = Image.open(source).convert("RGBA")
pixels = image.load()
for y in range(image.height):
    for x in range(image.width):
        r, g, b, a = pixels[x, y]
        # Remove the white/light-gray checkerboard while keeping the dark green mark.
        light = min(r, g, b) > 150
        neutral = max(r, g, b) - min(r, g, b) < 28
        if light and neutral:
            pixels[x, y] = (r, g, b, 0)
        else:
            pixels[x, y] = (r, g, b, 255)
alpha = image.getchannel("A")
box = alpha.getbbox()
if box:
    image = image.crop(box)
image.save(target)
