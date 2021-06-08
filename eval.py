#!/usr/bin/env python3
import os
import subprocess
from os import listdir
from os.path import isfile, join
import csv
from decimal import Decimal
import numpy as np

# for all input images in input folder
#    run 10, 50, 100 iterations
#   write result to resultLog/

AVG = 3            #for any number of iterations, repeat 10 times (mean var std)
ITERS = [10]       # different number of iterations
INPUT_PATH= 'input/'
RENDER_OUTPUT = 'false' #don't render output image during evaluation

FIELD_NAME = ['trial_number','image_width', 'image_height', 'number_of_iter','duration_ms', 'render_output_image']
LOG_FILE = ['js_resultLog/js_resultLogAllDir.csv', 'js_resultLog/js_resultLog.csv']


# log mean var std for this img and number of iterations
def log_stat(logFile, img, it, all_durations):
    with open(logFile, mode='a') as csv_file: # 'a' = append
        writer = csv.DictWriter(csv_file, fieldnames=FIELD_NAME)
        dur_mean = np.mean(all_durations)
        dur_sum = np.sum(all_durations)
        dur_var = np.var(all_durations)
        dur_std = np.std(all_durations)
        writer.writerow({'image': img, 'number_of_iter': it,
                          'total_duration_ms' : dur_sum,
                         'mean': dur_mean, 'var' : dur_var, 'std': dur_std})
  

# call denoise_all_dir
# log duration to csv for one call(in js)
# calculate total duration for 10 calls
def eval_js_all_dir(size, it, renderOutput):
    all_durations = []
    
    for i in range(AVG):
        value = subprocess.check_output(
            ['node', 'denoise_alldir.js', 
            str(size),      #image size
            str(it),        #number of iterations
            str(i + 1),     #trial number
            renderOutput,   #don't render output image
            'true'])        #eval mode
        # print("value from js all dir")
        duration = Decimal(value.decode("utf-8"))
        all_durations.append(duration)
        print('running image size : ' + str(size) + 'in denoise_alldir.js \n for ' + str(it) + ' iterations ' + str(i + 1) + " times")
        print('duration = ' + str(duration))
    
    # log_stat('resultLog/resultLogAllDir.csv', img, it, all_durations)


def eval_js(size, it, renderOutput):
    all_durations = []
    
    for i in range(AVG):
        value = subprocess.check_output(
            ['node', 'denoise.js', 
            str(size),            #image size
            str(it),        #number of iterations
            str(i + 1),         #trial number
            renderOutput,    #don't render output image
            'true'])        #eval mdoe
        # print("value from js all dir")
        duration = Decimal(value.decode("utf-8"))
        all_durations.append(duration)
        print('running image size : ' + str(size) + ' in denoise.js \n for ' + str(it) + ' iterations ' + str(i + 1) + " times")
        print('duration = ' + str(duration))
    
    # log_stat('resultLog/resultLog.csv', img, it, all_durations)


if __name__=="__main__":

    #============ clear result log and write header ==================
    for csv_file in LOG_FILE :
        log = open(csv_file, 'r+')
        log.truncate(0) # need '0' when using r+
        log.close()

        # write log file header
        with open(csv_file, mode='w') as csv_file:
            writer = csv.DictWriter(csv_file, fieldnames=FIELD_NAME)
            writer.writeheader()

   #======= generate random images with different height and width (32 to 512) ==========
    size = 16
    for i in range(6):
        for it in ITERS:
            eval_js_all_dir(size, it, RENDER_OUTPUT)
            # eval_js(size, it, RENDER_OUTPUT)

        size = size * 2

#   ============= get input image set ================
    # inputImgs = [f for f in listdir(INPUT_PATH) if f.endswith('png')]

    # for img in inputImgs:
    #     for it in ITERS:
    #         eval_js_all_dir(img, it, RENDER_OUTPUT)
    #         eval_js(img, it, RENDER_OUTPUT)


    