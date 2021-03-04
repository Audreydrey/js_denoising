const { min, max, clone, inv, matrix, size, multiply, 
    transpose, sqrt, ones, zeros, round} = require('mathjs');
const { exit } = require('process');


var noisyImg = getImgData("input/rose.png");

// reduce pixel values to 1 channel
var noisySignal = getSingleCh(noisyImg.data, noisyImg.height*noisyImg.width); // buffer
console.log(noisySignal[0])


for(var i = 1; i <= 10; i++){
    // get image data including meta data (4 channels)
    console.log("out_alldir" + i + "[0][0]")
    var noisyImg = getImgData("output_alldir/out_alldir" + i + ".png");

    // reduce pixel values to 1 channel
    var noisySignal = getSingleCh(noisyImg.data, noisyImg.height*noisyImg.width); // buffer
    console.log(noisySignal[0])

}


function getSingleCh(buffer4Ch, imgSize){
    var noisySignal = new Buffer.alloc(imgSize); //buffer
    for (var i = 0; i < imgSize; i ++){
         noisySignal[i] = buffer4Ch[4 * i];
    }
    return noisySignal;
}

// name within input folder
function  getImgData(name){
    var fs = require("fs");

    var  PNG = require("pngjs").PNG;
    var options = {bitDepth:16, inputHasAlpha:false}

    var data = fs.readFileSync(name);
    // console.log(data);
    var noisyImg =  PNG.sync.read(data, options);
    // console.log(noisyImg.data)

    return noisyImg;
}
