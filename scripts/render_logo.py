import os
import subprocess

def create_logo_svg():
    svg = '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024">
  <defs>
    <radialGradient id="bgGrad" cx="50%" cy="30%" r="70%">
      <stop offset="0%" stop-color="#ffffff"/>
      <stop offset="100%" stop-color="#f1f5f9"/>
    </radialGradient>
    <linearGradient id="hexGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#1e293b"/>
      <stop offset="100%" stop-color="#0f172a"/>
    </linearGradient>
    <linearGradient id="indigoEmerald" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#6366f1"/>
      <stop offset="100%" stop-color="#10b981"/>
    </linearGradient>
    <linearGradient id="eyeGlow" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#00f5ff"/>
      <stop offset="100%" stop-color="#10b981"/>
    </linearGradient>
    <linearGradient id="crestHighlight" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#e2e8f0"/>
      <stop offset="100%" stop-color="#94a3b8"/>
    </linearGradient>
  </defs>

  <!-- 1. Luxury White Squircle Container -->
  <rect x="16" y="16" width="992" height="992" rx="220" fill="url(#bgGrad)" stroke="#e2e8f0" stroke-width="8"/>

  <!-- 2. Hexagonal Gateway Frame -->
  <!-- Outer Massive Hexagon centered at (512, 512), radius 380 -->
  <polygon points="512,132 841,322 841,702 512,892 183,702 183,322"
           fill="none" stroke="#0f172a" stroke-width="36" stroke-linejoin="round"/>
  <!-- Inner Dashed Accent Hexagon, radius 350 -->
  <polygon points="512,162 815,337 815,687 512,862 209,687 209,337"
           fill="none" stroke="#6366f1" stroke-width="6" stroke-dasharray="14 10" opacity="0.6"/>

  <!-- Subtle Vault Grid Tick Accents -->
  <circle cx="512" cy="132" r="8" fill="#10b981"/>
  <circle cx="841" cy="322" r="8" fill="#6366f1"/>
  <circle cx="841" cy="702" r="8" fill="#10b981"/>
  <circle cx="512" cy="892" r="8" fill="#6366f1"/>
  <circle cx="183" cy="702" r="8" fill="#10b981"/>
  <circle cx="183" cy="322" r="8" fill="#6366f1"/>

  <!-- 3. The Mascot: The Sentinel Vault Badger (Origami / Low-Poly) -->
  <!-- Solid Watertight Base Silhouette to avoid any vertex leaks -->
  <path d="
    M 512,210
    L 590,250 L 670,220 L 730,280 L 710,380 L 770,470 L 760,590 L 710,700 L 610,780 L 512,820
    L 414,780 L 314,700 L 264,590 L 254,470 L 314,380 L 294,280 L 354,220 L 434,250 Z"
    fill="#0a0f1d"/>

  <!-- Ears (Left & Right) -->
  <!-- Left Outer Ear -->
  <polygon points="354,220 294,280 374,310" fill="#1e293b"/>
  <!-- Left Inner Ear Accent (Indigo Vent) -->
  <polygon points="344,235 306,278 366,298" fill="#4338ca"/>
  <polygon points="340,245 316,275 358,288" fill="#6366f1"/>

  <!-- Right Outer Ear -->
  <polygon points="670,220 730,280 650,310" fill="#334155"/>
  <!-- Right Inner Ear Accent (Indigo Vent) -->
  <polygon points="680,235 718,278 658,298" fill="#4338ca"/>
  <polygon points="684,245 708,275 666,288" fill="#6366f1"/>

  <!-- Head Crown & Forehead Facets -->
  <!-- Central Forehead Keystones -->
  <polygon points="512,210 434,250 512,295" fill="#475569"/>
  <polygon points="512,210 590,250 512,295" fill="#64748b"/>

  <polygon points="434,250 374,310 444,340 512,295" fill="#334155"/>
  <polygon points="590,250 650,310 580,340 512,295" fill="#475569"/>

  <!-- Badger Signature Central Silver Crest (The White Blaze - Titanium Silver) -->
  <polygon points="512,295 464,375 512,425" fill="#cbd5e1"/>
  <polygon points="512,295 560,375 512,425" fill="#f1f5f9"/>

  <polygon points="512,425 470,490 512,545" fill="#94a3b8"/>
  <polygon points="512,425 554,490 512,545" fill="#cbd5e1"/>

  <!-- Brow & Eye Mask Bands (Left & Right) -->
  <!-- Left Eye Mask (Dark Obsidian Stealth Plate) -->
  <polygon points="374,310 444,340 464,375 410,400 340,380" fill="#0f172a"/>
  <polygon points="410,400 464,375 470,430 420,440" fill="#1e293b"/>

  <!-- Right Eye Mask (Dark Obsidian Stealth Plate) -->
  <polygon points="650,310 580,340 560,375 614,400 684,380" fill="#1e293b"/>
  <polygon points="614,400 560,375 554,430 604,440" fill="#334155"/>

  <!-- Temples & Cheeks -->
  <polygon points="340,380 410,400 420,440 350,470 274,440" fill="#1e293b"/>
  <polygon points="684,380 614,400 604,440 674,470 750,440" fill="#334155"/>

  <polygon points="350,470 420,440 440,510 370,550 280,520" fill="#0f172a"/>
  <polygon points="674,470 604,440 584,510 654,550 744,520" fill="#1e293b"/>

  <!-- Alert Predatory Geometric Eyes -->
  <!-- Left Eye Socket & Slanted Cyan Pupil -->
  <polygon points="420,410 460,405 448,422 414,418" fill="#020617"/>
  <polygon points="424,411 454,407 444,420 420,417" fill="url(#eyeGlow)"/>
  <polygon points="432,410 444,408 438,418" fill="#ffffff"/>

  <!-- Right Eye Socket & Slanted Cyan Pupil -->
  <polygon points="604,410 564,405 576,422 610,418" fill="#020617"/>
  <polygon points="600,411 570,407 580,420 604,417" fill="url(#eyeGlow)"/>
  <polygon points="592,410 580,408 586,418" fill="#ffffff"/>

  <!-- Muzzle, Snout & Whisker Plates (Titanium slate, NO buck teeth) -->
  <polygon points="470,490 512,545 470,570 440,510" fill="#475569"/>
  <polygon points="554,490 512,545 554,570 584,510" fill="#64748b"/>

  <polygon points="512,545 470,570 512,610" fill="#1e293b"/>
  <polygon points="512,545 554,570 512,610" fill="#334155"/>

  <!-- Nose Pad / Snout Tip (Obsidian Facet) -->
  <polygon points="492,575 532,575 522,598 502,598" fill="#020617"/>
  <polygon points="502,576 522,576 517,585 507,585" fill="#64748b"/>

  <!-- Chin / Jawline -->
  <polygon points="470,570 512,610 480,640 430,600" fill="#334155"/>
  <polygon points="554,570 512,610 544,640 594,600" fill="#475569"/>
  <polygon points="512,610 480,640 512,660 544,640" fill="#1e293b"/>

  <!-- 4. Lower Vault Armor & Cryptographic Keyhole Collar -->
  <!-- Left Chest Plates -->
  <polygon points="370,550 440,510 430,600 400,680 320,640" fill="#0f172a"/>
  <polygon points="430,600 480,640 450,720 380,720 400,680" fill="#1e293b"/>

  <!-- Right Chest Plates -->
  <polygon points="654,550 584,510 594,600 624,680 704,640" fill="#1e293b"/>
  <polygon points="594,600 544,640 574,720 644,720 624,680" fill="#334155"/>

  <!-- Central Vault Gorget (Chest Shield with Integrated Cryptographic Keyhole) -->
  <polygon points="512,660 450,720 512,790 574,720" fill="url(#hexGrad)" stroke="#6366f1" stroke-width="4"/>

  <!-- Cryptographic Keyhole Stash Core (Emerald / Cyan Core) -->
  <circle cx="512" cy="710" r="14" fill="#10b981"/>
  <polygon points="505,712 519,712 522,738 502,738" fill="#10b981"/>
  <circle cx="512" cy="710" r="6" fill="#020617"/>

  <!-- Base Collar Flanks -->
  <polygon points="450,720 512,790 480,810 410,770" fill="#0f172a"/>
  <polygon points="574,720 512,790 544,810 614,770" fill="#1e293b"/>
  <polygon points="512,790 480,810 512,820 544,810" fill="#020617"/>

</svg>'''
    return svg

def main():
    svg_content = create_logo_svg()
    svg_path = 'B:/workgit/clipstash/docs/images/clipstash_logo.svg'
    html_path = 'B:/workgit/clipstash/docs/images/logo_render.html'
    png_path = 'B:/workgit/clipstash/docs/images/clipstash_logo.png'

    with open(svg_path, 'w', encoding='utf-8') as f:
        f.write(svg_content)
    print(f"Wrote SVG to {svg_path}")

    # Create HTML container for headless browser rendering
    html_content = f'''<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body {{
      margin: 0;
      padding: 0;
      width: 1024px;
      height: 1024px;
      background: transparent;
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
    }}
    svg {{
      width: 1024px;
      height: 1024px;
    }}
  </style>
</head>
<body>
  {svg_content}
</body>
</html>'''
    with open(html_path, 'w', encoding='utf-8') as f:
        f.write(html_content)

    edge_exe = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
    cmd = [
        edge_exe,
        "--headless",
        "--disable-gpu",
        f"--screenshot={png_path}",
        "--window-size=1024,1024",
        "--default-background-color=00000000",
        f"file:///{os.path.abspath(html_path).replace(os.sep, '/')}"
    ]
    print("Rendering PNG with Edge headless...")
    res = subprocess.run(cmd, capture_output=True, text=True)
    if os.path.exists(png_path) and os.path.getsize(png_path) > 1000:
        print(f"Successfully generated {png_path} ({os.path.getsize(png_path)} bytes)")
    else:
        print(f"Rendering failed: {res.stderr}")

if __name__ == '__main__':
    main()
