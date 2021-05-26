#!/usr/bin/env python3
import os
import subprocess
from os import listdir
from os.path import isfile, join

# for all input images in input folder
#    run 10, 50, 100 iterations
#   write result to resultLog/
#   TODO : add mean var, std


def eval_js_all_dir(img, it, renderOutput):
    #                                 imgName    iter    render output, newLog
    # os.system('node denoise_alldir.js glasses-large.png 10 false')
    subprocess.call(['node', 'denoise_alldir.js', img, str(it), renderOutput])

def eval_js(img, it, renderOutput):
    pass
    # subprocess.call(['node', 'denoise.js', img, str(it), renderOutput])


if __name__=="__main__":
    # clear result log
    f = open('resultLog/resultLogAllDir.csv', 'r+')
    f.truncate(0) # need '0' when using r+

    renderOutput = 'false'

    inputPath = 'input/'
    iterations = [10, 50, 100]
    inputImgs = [f for f in listdir(inputPath) if f.endswith('png')]

    for img in inputImgs:
        for it in iterations:
            eval_js_all_dir(img, it, renderOutput)
            # eval_js(img, it, renderOutput)

    