#!/usr/bin/env python3
"""
Copy track files from the tracks/ folder to Documents/MRSIM/Tracks
Works on Windows, Mac, and Linux
"""

import os
import shutil
import sys
from pathlib import Path

def get_tracks_destination():
    """Get the destination path for tracks based on OS"""
    if sys.platform == "win32":
        # Windows: Documents/MRSIM/Tracks
        documents = Path.home() / "Documents"
    elif sys.platform == "darwin":
        # macOS: Documents/MRSIM/Tracks
        documents = Path.home() / "Documents"
    else:
        # Linux: Documents/MRSIM/Tracks
        documents = Path.home() / "Documents"
    
    return documents / "MRSIM" / "Tracks"

def main():
    # Get source and destination paths
    script_dir = Path(__file__).parent.parent
    tracks_source = script_dir / "tracks"
    tracks_dest = get_tracks_destination()
    
    # Check if source folder exists
    if not tracks_source.exists():
        print(f"Error: Source folder '{tracks_source}' not found!")
        sys.exit(1)
    
    # Check if destination folder exists
    if not tracks_dest.exists():
        print(f"Error: Destination folder '{tracks_dest}' not found!")
        print("Please make sure MRSIM is installed and the Tracks folder exists.")
        sys.exit(1)
    
    # Get all XML files from tracks folder
    xml_files = list(tracks_source.glob("*.xml"))
    
    if not xml_files:
        print(f"No XML files found in '{tracks_source}'")
        sys.exit(0)
    
    print(f"Destination: {tracks_dest}")
    
    # Copy files
    copied_count = 0
    skipped_count = 0
    
    for xml_file in xml_files:
        dest_file = tracks_dest / xml_file.name
        
        if dest_file.exists():
            print(f"  Skipping {xml_file.name} (already exists)")
            skipped_count += 1
        else:
            shutil.copy2(xml_file, dest_file)
            print(f"  Copied {xml_file.name}")
            copied_count += 1
    
    print(f"\nDone! Copied {copied_count} file(s), skipped {skipped_count} file(s)")
    print(f"Tracks are now available at: {tracks_dest}")

if __name__ == "__main__":
    main()

