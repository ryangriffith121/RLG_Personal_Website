"""Builds the small display textures used by the Blender renders.

calc_screen.png  - the calculator's 480x320 TFT showing the firmware's test graphics
                   ("Hello World", "Button Pressed" and a full-width yellow line).
mp3_screen.png   - a 284x76 'now playing' mock-up for the MP3 player concept render.
"""
import sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

OUT = Path(__file__).resolve().parent / ".cache"
OUT.mkdir(exist_ok=True)
MONO = "C:/Windows/Fonts/consola.ttf"
MONO_B = "C:/Windows/Fonts/consolab.ttf"

def calc_screen():
    w, h = 480, 320
    im = Image.new("RGB", (w, h), (4, 4, 10))
    d = ImageDraw.Draw(im)
    f_big = ImageFont.truetype(MONO_B, 34)
    f_small = ImageFont.truetype(MONO, 22)
    d.text((22, 26), "Hello World", font=f_big, fill=(245, 245, 245))
    d.text((22, 84), "Button Pressed", font=f_small, fill=(120, 255, 140))
    d.text((22, 116), "ROW C  COL 3", font=f_small, fill=(160, 160, 175))
    d.rectangle((0, 168, w, 171), fill=(255, 230, 0))          # the yellow test line
    f_num = ImageFont.truetype(MONO_B, 64)
    d.text((w - 22, 300), "3.14159", font=f_num, fill=(245, 245, 245), anchor="rs")
    im = im.resize((w * 2, h * 2), Image.NEAREST)
    im.save(OUT / "calc_screen.png")

def mp3_screen():
    w, h = 284, 76
    im = Image.new("RGB", (w, h), (8, 6, 20))
    d = ImageDraw.Draw(im)
    f = ImageFont.truetype(MONO_B, 15)
    fs = ImageFont.truetype(MONO, 11)
    d.text((8, 7), "03  STAY IN ORBIT", font=f, fill=(233, 255, 151))
    d.text((8, 27), "RLG MIXTAPE  \u00b7  320 kbps", font=fs, fill=(171, 162, 212))
    # waveform bars
    import math
    for i in range(56):
        x = 8 + i * 4
        amp = 6 + 9 * abs(math.sin(i * 0.55) * math.cos(i * 0.17))
        col = (233, 255, 151) if i < 22 else (96, 77, 198)
        d.rectangle((x, 60 - amp, x + 2, 60), fill=col)
    d.rectangle((8, 66, 276, 67), fill=(45, 33, 120))
    d.rectangle((8, 66, 8 + int(268 * 0.39), 67), fill=(229, 25, 127))
    d.text((276, 7), "1:42", font=fs, fill=(217, 212, 226), anchor="ra")
    im = im.resize((w * 4, h * 4), Image.NEAREST)
    im.save(OUT / "mp3_screen.png")

if __name__ == "__main__":
    calc_screen()
    mp3_screen()
    print("ok")
