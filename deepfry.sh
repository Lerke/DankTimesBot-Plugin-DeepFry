#!/bin/bash

# Credit to 44100hertz @ https://gist.github.com/44100hertz/ec0af5c47b4620966b732e72adad33dc

convert $1 $2

for i in {1..8} # number of passes
do
	case $(( $RANDOM % 22 )) in # set to 23 to enable swirl effect
		1)
			convert $2 -resize 75% -filter point -quality 15 $2
			echo "resized 75%";;
		2)
			convert $2 -resize 120% -filter point -quality 15 $2
		    echo "resized 120%";;
		3)
			convert $2 -equalize -quality 15 $2
			echo "equalized color";;
		4)
			convert $2 -extent 99% -quality 15 -gravity center $2
			echo "cropped 1%";;
		5)
			convert $2 -border 1% -quality 15 $2
			echo "added 1% border";;
		6)
			convert $2 -gamma 0.7 -quality 15 $2
			echo "decreased gamma 30%";;
		7)
			convert $2 -gamma 1.3 -quality 15 $2
			echo "increased gamma 30%";;
		8)
			convert $2 -background black -vignette 0x100 -quality 15 -brightness-contrast +50x+50 $2
			echo "added vignette";;
		9)
			convert $2 -posterize 8 -quality 15 $2
			echo "applied posterize (reduce # of colors)";;
		10)
			convert $2 -unsharp 0x5 -quality 15 $2
			echo "sharpened image";;
		11)
			convert $2 +level-colors '#000040,#ffffa0' -quality 15 $2
			echo "reduced blue contrast";;
		12)
			convert $2 -modulate 120,40,100 -fill '#222b6d' -colorize 20 -gamma 0.5 -contrast -contrast -quality 15 $2
		    echo "applied dull instagram-like filter";;
		13)
			convert $2 -channel R -level 33% -channel G -level 33% -quality 15 $2
			echo "applied HIGH CONTRAST instagram-like filter";;
		14)
			convert $2 -modulate 100,150,100 -quality 15 $2
		    echo "Increased saturation by 50%";;
		15)
			convert $2 -modulate 100,150,90 -quality 15 $2
		    echo "Rotated hue left";;
		16)
			convert $2 -normalize -quality 20 $2
		    echo "Normalized image";;
		17)
			convert $2 -quality 10 $2
		    echo "Extra low quality";;
		18)
			convert $2 -sigmoidal-contrast 3x50% -quality 15 $2
		    echo "Increase contrast";;
		19)
			convert $2 -noise 8 $2
		    echo "Noise removal";;
		20)
			convert $2 +noise Gaussian -attenuate 0.25 $2
		    echo "Add noise";;
		20)
			convert $2 -resize 109%x91% -filter point -quality 15 $2
		    echo "Stretch horizontal";;
		21)
			convert $2 -resize 90%x110% -filter point -quality 15 $2
		    echo "Stretch vertical";;
		22)
			convert $2 -swirl 90 -quality 15 $2
			echo "twisty effect";
	esac
done
