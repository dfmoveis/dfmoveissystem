from PIL import Image

def create_pwa_icon(source_path, target_path, size, bg_color=(255, 255, 255)):
    # Open source logo
    logo = Image.open(source_path)
    
    # Create white background square
    icon = Image.new("RGB", (size, size), bg_color)
    
    # Calculate resizing for the logo to fit within the square with some padding
    padding = int(size * 0.1)
    max_logo_size = size - (padding * 2)
    
    # Maintain aspect ratio
    logo_ratio = logo.width / logo.height
    if logo.width > logo.height:
        new_width = max_logo_size
        new_height = int(max_logo_size / logo_ratio)
    else:
        new_height = max_logo_size
        new_width = int(max_logo_size * logo_ratio)
        
    logo = logo.resize((new_width, new_height), Image.Resampling.LANCZOS)
    
    # Center the logo on the icon
    offset = ((size - new_width) // 2, (size - new_height) // 2)
    
    # Use logo as its own mask if it has alpha channel
    if logo.mode == 'RGBA':
        icon.paste(logo, offset, logo)
    else:
        icon.paste(logo, offset)
        
    icon.save(target_path, "PNG")
    print(f"Created {target_path} at {size}x{size}")

create_pwa_icon('src/assets/logo-df.png', 'public/icon-192x192.png', 192)
create_pwa_icon('src/assets/logo-df.png', 'public/icon-512x512.png', 512)
