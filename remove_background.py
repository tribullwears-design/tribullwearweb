#!/usr/bin/env python3
"""
Remove white backgrounds from product images and make them transparent.
Converts images to PNG with transparency.
"""

from PIL import Image
import os
from pathlib import Path

# Configuration
PRODUCTS_DIR = Path("client/public/products")
WHITE_THRESHOLD = 240  # Pixels with RGB > this value are considered white
QUALITY = 95

def remove_white_background(image_path, output_path):
    """
    Process image to remove white background and make it transparent.
    """
    try:
        # Open image and convert to RGBA
        img = Image.open(image_path).convert("RGBA")
        
        # Get image data
        data = img.getdata()
        
        # Create new image data with transparent white pixels
        new_data = []
        for item in data:
            # item is (R, G, B, A)
            r, g, b = item[0], item[1], item[2]
            
            # If pixel is mostly white (R, G, B all > threshold), make it transparent
            if r > WHITE_THRESHOLD and g > WHITE_THRESHOLD and b > WHITE_THRESHOLD:
                # Make transparent
                new_data.append((r, g, b, 0))
            else:
                # Keep as is
                new_data.append(item)
        
        # Update image data
        img.putdata(new_data)
        
        # Save as PNG (supports transparency)
        output_path = output_path.with_suffix('.png')
        img.save(output_path, "PNG")
        
        print(f"✓ Processed: {image_path.name} → {output_path.name}")
        return True
        
    except Exception as e:
        print(f"✗ Error processing {image_path.name}: {e}")
        return False

def main():
    """Process all product images."""
    if not PRODUCTS_DIR.exists():
        print(f"Error: {PRODUCTS_DIR} not found")
        return
    
    # Process specific images
    image_files = [
        "back-black.png",
        "front-white.png",
        "hanger-white.png",
        "flat-white.png",
    ]
    
    processed_count = 0
    for filename in image_files:
        image_path = PRODUCTS_DIR / filename
        if image_path.exists():
            output_path = PRODUCTS_DIR / filename
            if remove_white_background(image_path, output_path):
                processed_count += 1
        else:
            print(f"! Not found: {filename}")
    
    print(f"\n✓ Processed {processed_count} images")

if __name__ == "__main__":
    main()
