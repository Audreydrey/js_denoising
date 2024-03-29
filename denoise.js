const { min, max, clone, inv, matrix, size, multiply, 
    transpose, sqrt, ones, zeros, round, string} = require('mathjs');
const { exit } = require('process');

// ======= parse input args ==================
// console.log(process.argv);
if(process.argv.length != 7) {
    exit("need 1，imgName or size 2，number of iter 3，render output images 4, eval mode");
}
var iter = parseInt(process.argv[3]);  // 2, number of iterations
var trialNumber = parseInt(process.argv[4])     //3, trial number
var renderOutput = process.argv[5] == "true"; // 4, don't render output image
var eval_mode = process.argv[6] == "true";  // 5, disable all console.log  except duration in the eval mode

// ============ fill noisySignal=================

var imgHeight = 0;
var imgWidth = 0;
var noisySignal = null;

if (!eval_mode){
    var imgName = process.argv[2];  // 1, image name 
    // get image data including meta data (4 channels)
    var noisyImg = getImgData(imgName);
    // reduce pixel values to 1 channel
    noisySignal = getSingleCh(noisyImg.data, noisyImg.height*noisyImg.width); // buffer

    imgHeight = noisyImg.height;
    imgWidth = noisyImg.width;
}else{//generate fake image data
    var imgSize = parseInt(process.argv[2]);  // 1, image size (height = width = size)
    imgHeight = imgSize;
    imgWidth = imgSize;
    noisySignal = new Float32Array(imgHeight * imgWidth);
    for (var i = 0; i < imgHeight * imgWidth; i ++){
        noisySignal[i] = i;
   }
}
// ===============================================

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

    var data = fs.readFileSync("input/" + name);
    var noisyImg =  PNG.sync.read(data, options);
    if(! eval_mode){
        console.log("===> image width : " + noisyImg.width);
        console.log("===> image height : " +noisyImg.height);
        console.log("===> image color : " + noisyImg.color);
        console.log("===> image has alpha : " + noisyImg.alpha);
        console.log("===> image data length: " + (noisyImg.data.length));
        console.log("----image loading complete----");
    }
    return noisyImg;
}

function  putImgData(name, png){
    var fs = require("fs");
    var  PNG = require("pngjs").PNG;

    var options = { inputColorType:0, colorType: 0, inputHasAlpha:false};
    var buffer = PNG.sync.write(png, options);
    fs.writeFileSync('output/' + name, buffer, options);
}


class VariableNode{
    constructor(variableID, mu, sigma, priorID, leftID, rightID, upID, downID){
    this.variableID = variableID;
    this.mu = mu; //should be scalar
    this.sigma = sigma; //should be scalar
    this.priorID = priorID;
    this.leftID = leftID;
    this.rightID = rightID;
    this.upID = upID;
    this.downID = downID;
    this.out_eta = 0; 
    this.out_lambda_prime = 0;
    }

    getEta() {
        return this.out_eta;
    }

    getLambdaPrime() {
        return this.out_lambda_prime;
    }

    getMu(){
        return this.mu;
    }

    getSigma(){
        return this.sigma;
    }

    beliefUpdate(){
        var eta_here = 0.0
        var lambda_prime_here = 0.0
        var factorIDs = [this.priorID, this.leftID, this.rightID, this.upID, this.downID]
        var fID;
        for (fID in factorIDs) {
            //  sometimes i don't have a factor to my left or right and this id is set to -1
            if (factorIDs[fID] != -1){
                eta_here += factorNodes[factorIDs[fID]].getEta();
                lambda_prime_here += factorNodes[factorIDs[fID]].getLambdaPrime();
            }
        }
            
        if (lambda_prime_here == 0.0){
            console.log('Lambda prime is zero in belief update, something is wrong');
            exit(0);
        }
        
        this.sigma = inv(lambda_prime_here);
        this.mu = multiply(this.sigma, eta_here);
        this.out_eta = eta_here;;
        this.out_lambda_prime = lambda_prime_here;
        
    }

    computeMsg(ID){ 
    // ID is either right left down or up
    //   compute msg right, up, left and down
        this.beliefUpdate();
        if(ID == -1){
            this.out_eta = 0;
            this.out_lambda_prime = 0;
            return;
        }
        var eta_inward = factorNodes[ID].getEta();
        var lambda_prime_inward = factorNodes[ID].getLambdaPrime();

        this.out_eta = this.out_eta - eta_inward;
        this.out_lambda_prime = this.out_lambda_prime - lambda_prime_inward;
    }
}

class MeasurementNode{
    constructor(factorID, z, lambdaIn, variableID){
        this.factorID = factorID;
        this.z = z; //pixel value
        this.lambdaIn = lambdaIn; //should be scalar

        var J = 1.0;

        this.eta = lambdaIn * z;
        this.lambdaPrime = lambdaIn;
        this.variableID = variableID;
        this.N_sigma = sqrt(lambdaIn);
        this.variableEta = this.eta;
        this.variableLambdaPrime = this.lambdaPrime;
    }

    computeHuberscale(){
        var h = this.z - variableNodes[this.variableID].getMu();
        var ms = sqrt(h * this.lambdaIn * h);
        if(ms > this.N_sigma){
            var k_r = (2 * this.N_sigma) / ms - this.N_sigma ** 2 / (ms ** 2);
   
            return k_r;
        }else{
            return 1;
        }
    }

    computeMsg(){
        var kr = this.computeHuberscale();
        this.variableEta = this.eta * kr;
        this.variableLambdaPrime = this.lambdaPrime * kr;
    }

    getEta(){
        return this.variableEta;
    }

    getLambdaPrime(){
        return this.variableLambdaPrime;
    }


}

class SmoothnessNode{
    constructor(factorID, lambdaIn, prevID, afterID){
        this.factorID = factorID;
        var J = [[-1, 1]];
        // J transpose * lambda * [ [-1, 1].T * [x1, x2] + 0 - (x2 - x1) ] = J.T * lambda * 0.
        // left is eta[0] and right is eta[1].
        // These never get changed because they do not depend on the input variables so linearisation always
        // has the same form
        this.lambdaIn = lambdaIn;
        this.eta = [[0], [0]];
        this.lambda_prime = multiply(multiply(transpose(J), lambdaIn), J); 
        
        // variable messages:
        this.variable_eta = 0.0;
        this.variable_lambda = 0.0;

        // IDs of left and right variable nodes:
        this.prevID = prevID;
        this.afterID = afterID;
 
        this.N_sigma  = sqrt(lambdaIn);
    }

    getEta(){
        return this.variable_eta;
    }

    getLambdaPrime(){
        return this.variable_lambda;
    }

    computeHuberScale(){
        var h =  variableNodes[this.prevID].getMu() - variableNodes[this.afterID].getMu();
        var ms = sqrt(this.lambdaIn * h ** 2);
        if (ms > this.N_sigma){
            var kr = 2 * this.N_sigma / ms - (this.N_sigma ** 2) / (ms ** 2);

            return kr;
        }
        return 1;
    }

    //  specify if it is msg to after node or prev
    computeMsgHelper(isAfter){
        // if prev 
        var idx1 = 1;
        var idx2 = 0;
        var inwardID = this.afterID;
        if(isAfter) {
            idx1 = 0;
            idx2 = 1;
            inwardID = this.prevID;
        }
        var inwardEta = variableNodes[inwardID].getEta();
        var inwardLambda = variableNodes[inwardID].getLambdaPrime();

        var kr = this.computeHuberScale();
        var eta = clone(this.eta);
        var lambda_prime = clone(this.lambda_prime);

        // left is the first variable in eta and i want to marginalise out the second one (right)
        eta[idx1][0] = this.eta[idx1][0] + inwardEta;
        lambda_prime[idx1][idx1] = this.lambda_prime[idx1][idx1] + inwardLambda;
        eta = multiply(eta, kr);

        lambda_prime = multiply(lambda_prime, kr);

        var eta_a = eta[idx2][0];
        var eta_b = eta[idx1][0];
        var lambda_aa = lambda_prime[idx2][idx2];
        var lambda_ab = lambda_prime[idx2][idx1];
        var lambda_ba = lambda_prime[idx1][idx2];
        var lambda_bb = lambda_prime[idx1][idx1];

        this.variable_eta = eta_a - lambda_ab / lambda_bb * eta_b;
        this.variable_lambda = lambda_aa - lambda_ab / lambda_bb * lambda_ba;

    }

    // after = right &down  prev = up & left
    computeMsg(isAfter, horizontal){
        if(horizontal && this.afterID - this.prevID == 1){
            this.computeMsgHelper(isAfter);
        } else if((!horizontal) && (this.afterID - this.prevID > 1)){
            this.computeMsgHelper(isAfter);
        }
        
    }

}

var SIGMAMeas = 1;
var lambdaMeas = 1 / SIGMAMeas ** 2;
var SIGMASmooth = 0.3;
var lambdaSmooth = 1 / SIGMASmooth ** 2;

var variableNodes = {};
var factorNodes = {};

function setUpNodes(){

    for (var i = 0; i < imgHeight; i++){
        for (var j = 0; j < imgWidth; j++){
            var varID = i * imgWidth + j;
            var upID = -1;
            var downID = -1;
            var leftID = -1;
            var rightID = -1;

            // ID for 4 dir containing varID and factorNode ID
            // the first ID is smaller
            if(i - 1 >= 0){
                var up = (i - 1) * imgWidth + j;
                upID = [min(up, varID), max(up, varID)];
            }
            if (i + 1 < imgHeight){
                var down = (i + 1) * imgWidth + j;
                downID = [min(down, varID), max(down, varID)];
            }
            if(j - 1 >= 0){
                var left = i * imgWidth + j - 1;
                leftID = [min(left, varID), max(left, varID)];
            }
            if (j + 1 < imgWidth){
                var right = i * imgWidth + j + 1;
                rightID = [min(right, varID), max(right, varID)];
            }
            variableNodes[varID] = new VariableNode(varID, 0, 0, varID,
                leftID, rightID, upID, downID);

            factorNodes[varID] = new MeasurementNode(varID, 
                noisySignal[i * imgWidth + j], lambdaMeas, varID);

            if(leftID != -1 && factorNodes[leftID] == null){
                factorNodes[leftID] = new SmoothnessNode(leftID,
                    lambdaSmooth, leftID[0], leftID[1]);
            }
            if(rightID != -1 && factorNodes[rightID] == null){
                factorNodes[rightID] = new SmoothnessNode(rightID,
                    lambdaSmooth, rightID[0], rightID[1]);
            }
            if(upID != -1 && factorNodes[upID] == null){
                factorNodes[upID] = new SmoothnessNode(upID,
                    lambdaSmooth, upID[0], upID[1]);
            }
            if(downID != -1 && factorNodes[downID] == null){
                factorNodes[downID] = new SmoothnessNode(downID,
                    lambdaSmooth, downID[0], downID[1]);
            }

        }
    }

}

function denoise(){
    var iter_num = 0;
    var mu = new Buffer.alloc(imgHeight * imgWidth);
    while(iter_num < iter) {
        if(!eval_mode){
            console.log('iteration : ' + iter_num);
        }
        iter_num++;
    
        // send msg from measurement factor
        for(key in factorNodes){
            if(! key.includes(',')){
                factorNodes[key].computeMsg();
            }
        }
    
    
        // for each variable nodes: update belief in computeMsg 
        // for each smoothness nodes: computeMsg
        // for each measurement nodes : computeMsg
        // in 4 dir
    
        //-------------UP-----------
        for(key in variableNodes){
            variableNodes[key].computeMsg(variableNodes[key].upID);
        }
        for(key in factorNodes){ //smothness
            if(key.includes(',')){
                factorNodes[key].computeMsg(false, false); //up is not after
            }
        }
        for(key in factorNodes){ //measurement
            if(! key.includes(',')){
                factorNodes[key].computeMsg();
            }
        }
    
        //-------------RIGHT-----------
        for(key in variableNodes){
            variableNodes[key].computeMsg(variableNodes[key].rightID);
        }
        for(key in factorNodes){ //smothness
            if(key.includes(',')){
                factorNodes[key].computeMsg(true, true); //right is after
            }
        }
        for(key in factorNodes){ //measurement
            if(! key.includes(',')){
                factorNodes[key].computeMsg();
            }
        }
    
        // //-------------DOWN-----------
        for(key in variableNodes){
            variableNodes[key].computeMsg(variableNodes[key].downID);
        }
        for(key in factorNodes){ //smothness
            if(key.includes(',')){
                factorNodes[key].computeMsg(true, false); //down is after
            }
        }
        for(key in factorNodes){ //measurement
            if(! key.includes(',')){
                factorNodes[key].computeMsg();
            }
        }
    
        // //-------------LEFT-----------
        for(key in variableNodes){
            variableNodes[key].computeMsg(variableNodes[key].leftID);
        }
        for(key in factorNodes){ //smothness
            if(key.includes(',')){
                factorNodes[key].computeMsg(false, true); //left is not after
            }
        }
        for(key in factorNodes){ //measurement
            if(! key.includes(',')){
                factorNodes[key].computeMsg();
            }
        }
    
        // -----------belief update--------
        for(key in variableNodes){
            variableNodes[key].beliefUpdate();
        }
    
        for(i in Object.keys(variableNodes)){ // i : idx from 0 to imgSize
            mu[i] = round(variableNodes[i].getMu()); //mu :buffer of new img.
            
        } 
    
    // output image
        if(renderOutput){
            noisyImg.data = mu;
            putImgData("out"+ iter_num+".png", noisyImg);
        }
        
    }
}

setUpNodes();
var startIter = (new Date()).getTime();
denoise();
var endIter = (new Date()).getTime();
var duration = endIter - startIter;
// console.log("duration (ms)");
console.log(duration);
logResults();


// ['trial_number','image_width', 'image_height', 'number_of_iter','duration_ms', 'render_output_image']
function logResults(){
    const objectsToCsv = require('objects-to-csv');
    var result = [{ trial_number : trialNumber,
                image_width : imgWidth,
                image_height : imgHeight,
                number_of_iter : iter, 
                duration_ms : duration,
                render_output_image : string(renderOutput)}];
    const csv = new objectsToCsv(result);

    csv.toDisk('js_resultLog/js_resultLog.csv', {append : true});

    // removed the append:true to clear previous results ===========
    // csv.toDisk('resultLog/resultLogAllDir.csv'); 
}





