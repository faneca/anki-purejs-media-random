#!/bin/bash
#
# Run this script from the directory you want to put the resultant video files
# (for instance, `<your Anki user profile dir>/collection.media/`).
#
# You'll need to download the input file from:
#   - http://www.esa.int/spaceinvideos/Videos/2017/07/Alexander_Gerst_s_Earth_timelapses_2017_reissue
#
# When I last downloaded it, it's URL was:
#   - https://dlmultimedia.esa.int/download/public/videos/2017/07/002/1707_002_AR_EN.mp4
#
# Put it in your home dir with the following name, or modify the variable below.
#
# If you want to include audio in your files, change the `-an -b:a 0` in the
# second pass for something more sensible, like `-b:a 96k` or so

INPUTFILE="$HOME/esa-iss-timelapse-1707_002_AR_EN.mp4"

W=320
H=200

BR=600k
Q=23

SCALE="scale=$W:$H:force_original_aspect_ratio=decrease"
PAD="pad=$W:$H:(ow-iw)/2:(oh-ih)/2"

for NN in '(1 9 5)' '(2 36 5)' '(3 49 4.5)'
do
    eval NN=$NN
    PARAMS="-i "$INPUTFILE" \
            -f webm -c:a libopus -c:v libvpx-vp9 \
            -threads 4 \
            -tile-columns 6 -frame-parallel 1 \
            -crf "$Q" -b:v "$BR" \
            -vf "$SCALE","$PAD" \
            -ss ${NN[1]} -t ${NN[2]}"

    ffmpeg $PARAMS -pass 1 -an -speed 4 -y /dev/null && \
    ffmpeg $PARAMS -pass 2 -an -b:a 0 -speed 2 "00002-${NN[0]}.webm"
done

rm ffmpeg2pass-0.log
