#!/usr/bin/env python3
import os

# Play system sound on macOS
os.system('afplay /System/Library/Sounds/Glass.aiff 2>/dev/null || say beep')