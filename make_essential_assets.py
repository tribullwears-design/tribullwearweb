from collections import deque
from pathlib import Path

from PIL import Image


PRODUCTS_DIR = Path("client/public/products")
SOURCE_FILES = {
    "hanger-white.png": "essential-mens-shirt.png",
    "front-white.png": "essential-tshirts.png",
    "back-black.png": "essential-oversized.png",
    "flat-white.png": "essential-hoodies.png",
}


def is_background_pixel(pixel):
    red, green, blue, alpha = pixel
    return alpha > 0 and min(red, green, blue) >= 225 and max(pixel[:3]) - min(pixel[:3]) <= 18


def remove_edge_background(source_path, output_path):
    image = Image.open(source_path).convert("RGBA")
    width, height = image.size
    pixels = image.load()
    queue = deque()
    visited = set()

    for x in range(width):
        queue.extend(((x, 0), (x, height - 1)))
    for y in range(height):
        queue.extend(((0, y), (width - 1, y)))

    while queue:
        x, y = queue.popleft()
        if (x, y) in visited or not is_background_pixel(pixels[x, y]):
            continue
        visited.add((x, y))
        pixels[x, y] = (pixels[x, y][0], pixels[x, y][1], pixels[x, y][2], 0)
        for next_x, next_y in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
            if 0 <= next_x < width and 0 <= next_y < height:
                queue.append((next_x, next_y))

    image.save(output_path, "PNG")


for source_name, output_name in SOURCE_FILES.items():
    remove_edge_background(PRODUCTS_DIR / source_name, PRODUCTS_DIR / output_name)
    print(f"Created {output_name}")