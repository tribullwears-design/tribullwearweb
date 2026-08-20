#!/usr/bin/env python3
"""
Process product images to have clean white backgrounds.
Ensures all T-shirt and hoodie images have:
- Pure white background (#FFFFFF)
- Centered product
- Consistent sizing
- Professional e-commerce appearance
"""

from PIL import Image, ImageOps
import os
from pathlib import Path

# Configuration
PRODUCTS_DIR = Path("client/public/products")
OUTPUT_DIR = Path("client/public/products/processed")
TARGET_SIZE = (800, 800)  # Square canvas for consistency
WHITE = (255, 255, 255)
QUALITY = 95

def remove_background_and_center(image_path, output_path):
    """
    Process image to have white background with centered product.
    """
    try:
        # Open image
        img = Image.open(image_path).convert("RGBA")
        
        # Get image dimensions
        width, height = img.size
        
        # Create white background
        white_bg = Image.new("RGBA", (width, height), WHITE + (255,))
        
        # Paste image on white background
        white_bg.paste(img, (0, 0), img)
        
        # Convert to RGB (remove alpha channel)
        rgb_img = Image.new("RGB", white_bg.size, WHITE)
        rgb_img.paste(white_bg, mask=white_bg.split()[3])
        
        # Auto-crop to remove excess white space
        # But keep some padding
        bbox = rgb_img.getbbox()
        if bbox:
            # Add 10% padding around the product
            left, top, right, bottom = bbox
            width_margin = int((right - left) * 0.1)
            height_margin = int((bottom - top) * 0.1)
            
            padded_bbox = (
                max(0, left - width_margin),
                max(0, top - height_margin),
                min(rgb_img.width, right + width_margin),
                min(rgb_img.height, bottom + height_margin)
            )
            rgb_img = rgb_img.crop(padded_bbox)
        
        # Resize to target dimensions while maintaining aspect ratio
        rgb_img.thumbnail(TARGET_SIZE, Image.Resampling.LANCZOS)
        
        # Create final canvas with white background
        final_img = Image.new("RGB", TARGET_SIZE, WHITE)
        
        # Center the product
        img_width, img_height = rgb_img.size
        x_offset = (TARGET_SIZE[0] - img_width) // 2
        y_offset = (TARGET_SIZE[1] - img_height) // 2
        final_img.paste(rgb_img, (x_offset, y_offset))
        
        # Save processed image
        if output_path.suffix.lower() == '.jpg':
            final_img.save(output_path, "JPEG", quality=QUALITY)
        else:
            final_img.save(output_path, "PNG")
        
        print(f"✓ Processed: {image_path.name} → {output_path.name}")
        return True
        
    except Exception as e:
        print(f"✗ Error processing {image_path.name}: {e}")
        return False

def main():
    """Process all product images."""
    
    # Ensure output directory exists
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    
    # Product images to process (T-shirts and hoodies)
    product_images = [
        "back-black.png",
        "front-white.png",
        "flat-white.png",
        "hanger-white.png",
    ]
    
    processed_count = 0
    
    print("=" * 60)
    print("Processing Product Images")
    print("=" * 60)
    print(f"Target size: {TARGET_SIZE[0]}x{TARGET_SIZE[1]}px")
    print(f"Background: Pure white (#FFFFFF)")
    print("-" * 60)
    
    for img_name in product_images:
        img_path = PRODUCTS_DIR / img_name
        
        if not img_path.exists():
            print(f"⚠ File not found: {img_name}")
            continue
        
        output_path = OUTPUT_DIR / img_name
        
        if remove_background_and_center(img_path, output_path):
            processed_count += 1
    
    print("-" * 60)
    print(f"✓ Successfully processed {processed_count} images")
    print(f"✓ Output directory: {OUTPUT_DIR}")
    print("=" * 60)
    
    # Instructions for replacing original files
    print("\nNext steps:")
    print("1. Review the processed images in:", OUTPUT_DIR)
    print("2. Copy processed images back to:", PRODUCTS_DIR)
    print("   (Backup originals first!)")
    print("3. Update any code references if needed")

if __name__ == "__main__":
    main()
