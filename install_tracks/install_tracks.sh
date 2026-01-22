#!/bin/bash
# Bash script to copy track files to Documents/MRSIM/Tracks
# Run this script from the install_tracks folder

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SOURCE_FOLDER="$SCRIPT_DIR/../tracks"
DEST_FOLDER="$HOME/Documents/MRSIM/Tracks"

# Check if source folder exists
if [ ! -d "$SOURCE_FOLDER" ]; then
    echo "Error: Source folder '$SOURCE_FOLDER' not found!"
    exit 1
fi

# Check if destination folder exists
if [ ! -d "$DEST_FOLDER" ]; then
    echo "Error: Destination folder '$DEST_FOLDER' not found!"
    echo "Please make sure MRSIM is installed and the Tracks folder exists."
    exit 1
fi

# Get all XML files
XML_FILES=$(find "$SOURCE_FOLDER" -name "*.xml" -type f)

if [ -z "$XML_FILES" ]; then
    echo "No XML files found in '$SOURCE_FOLDER'"
    exit 0
fi

echo "Destination: $DEST_FOLDER"

# Copy files
COPIED_COUNT=0
SKIPPED_COUNT=0

for file in $XML_FILES; do
    filename=$(basename "$file")
    dest_file="$DEST_FOLDER/$filename"
    
    if [ -f "$dest_file" ]; then
        echo "  Skipping $filename (already exists)"
        ((SKIPPED_COUNT++))
    else
        cp "$file" "$dest_file"
        echo "  Copied $filename"
        ((COPIED_COUNT++))
    fi
done

echo ""
echo "Done! Copied $COPIED_COUNT file(s), skipped $SKIPPED_COUNT file(s)"
echo "Tracks are now available at: $DEST_FOLDER"

