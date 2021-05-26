const { abs, min, max, clone, inv, matrix, size, multiply, 
    transpose, sqrt, ones, zeros, round, string, stirlingS2, boolean} = require('mathjs');
const { exit } = require('process');

// ======= parse input args ==========
console.log(process.argv);
var imgName = "glasses-large.png";
var iter = 10;
var renderOutput = false;
var newLog = false;
if(process.argv.length > 2){
    imgName = process.argv[2];
    iter = parseInt(process.argv[3]);
    renderOutput = process.argv[4] == "true";
    newLog = process.argv[5] == "true";
}else{
    exit("not enough args, need 1，imgName 2，number of iter 3，render output images");
}
// ===================================

var realImage = true;
var imgHeight = 0;
var imgWidth = 0;
var noisySignal = null;

if (realImage){
    // get image data including meta data (4 channels)
    var noisyImg = getImgData(imgName);

    // reduce pixel values to 1 channel
    noisySignal = getSingleCh(noisyImg.data, noisyImg.height*noisyImg.width); // buffer

    imgHeight = noisyImg.height;
    imgWidth = noisyImg.width;
}else{
    imgHeight = 3;
    imgWidth = 3;
    noisySignal = new Float32Array(imgHeight * imgWidth);
    for (var i = 0; i < imgHeight * imgWidth; i ++){
        noisySignal[i] = i;
        // console.log(noisySignal[i]);
   }
   noisySignal[3] = 0;
}

function getSingleCh(buffer4Ch, imgSize){
    var noisySignal = new Float32Array(imgSize); //buffer
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

    console.log("===> image width : " + noisyImg.width);
    console.log("===> image height : " +noisyImg.height);
    console.log("===> image color : " + noisyImg.color);
    console.log("===> image has alpha : " + noisyImg.alpha);
    console.log("===> image data length: " + (noisyImg.data.length));
    console.log("----image loading complete----");

    return noisyImg;
}

function  putImgData(name, png){
    var fs = require("fs");
    var  PNG = require("pngjs").PNG;

    var options = { inputColorType:0, colorType: 0, inputHasAlpha:false};
    var buffer = PNG.sync.write(png, options);
    fs.writeFileSync('output_alldir/' + name, buffer, options);
}


class VariableNode{
    constructor(variableID, mu, sigma, priorID, leftID, rightID, upID, downID){
    this.variableID = variableID;

    //beliefs
    this.mu = mu; //should be scalar
    this.sigma = sigma; //should be scalar
    //messages
    this.out_eta = 0; 
    this.out_lambda_prime = 0;

    this.priorID = priorID;
    this.leftID = leftID;
    this.rightID = rightID;
    this.upID = upID;
    this.downID = downID;   
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
        var factorIDs = [this.leftID, this.upID, this.rightID, this.downID]
        var fID;
        // measurement node
        eta_here += factorNodes[this.priorID].getEta();
        lambda_prime_here += factorNodes[this.priorID].getLambdaPrime();

        // smoothness node
        for (fID in factorIDs) {
            //  sometimes i don't have a factor to my left or right and this id is set to -1
            if (factorIDs[fID] != -1){
                //right and down
                // get prev eta and lambdaPrime from after nodes
                // console.log(fID);
                if(fID > 1){ 
                    eta_here += factorNodes[factorIDs[fID]].getEtaPrev();
                    lambda_prime_here += factorNodes[factorIDs[fID]].getLambdaPrimePrev();
                }else{// get after eta and lambdaPrime from prev nodes
                    eta_here += factorNodes[factorIDs[fID]].getEtaAfter();
                    lambda_prime_here += factorNodes[factorIDs[fID]].getLambdaPrimeAfter();
                }
                
            }
        }
        if(lambda_prime_here == 0.0) {
            if (realImage){
                console.log('Lambda prime is zero in belief update, something is wrong');
                exit(0);
            }else{
                this.sigma = 0;
                this.mu = 0;
                this.out_eta = 0;
                this.out_lambda_prime = 0;
                return;
            }
        }
        
        this.sigma = inv(lambda_prime_here);
        this.mu = multiply(this.sigma, eta_here);
        this.out_eta = eta_here;
        this.out_lambda_prime = lambda_prime_here;
        
    }
}

class MeasurementNode{ //prior
    constructor(factorID, z, lambdaIn, variableID){
        this.factorID = factorID; // = varID
        this.z = z; //pixel value //look up from texture
        this.lambdaIn = lambdaIn; //should be scalar

        var J = 1.0; //not used
        // won't change
        this.eta = lambdaIn * z; // z
        this.lambdaPrime = lambdaIn; // 1
        this.variableID = variableID;
        this.N_sigma = sqrt(lambdaIn); // 1

        //measurement node messages
        this.variableEta = this.eta; // z
        this.variableLambdaPrime = this.lambdaPrime; // 1
    }

    computeHuberscale(){   
        var h = this.z - variableNodes[this.variableID].getMu();
    
        var ms = sqrt(h * this.lambdaIn * h);
        // var msabs = abs(h);
        // console.log("ms : " + string(ms));
        // console.log("z : " + string(this.z));
        // console.log("ms1 : " + string(msabs));

        if(ms > this.N_sigma){
            var k_r = (2 * this.N_sigma) / ms - this.N_sigma ** 2 / (ms ** 2);
            return k_r;
        }else{
            return 1;
        }
    }

    computeMsg(){
        var kr = this.computeHuberscale();
        if(kr < 0){
            console.log("prior kr is " + string(kr));
        }
        this.variableEta = this.eta * kr;
        this.variableLambdaPrime = this.lambdaPrime * kr;
        // console.log("var eta = " + string(this.variableEta));
        // console.log("var lambda = " + string(this.variableLambdaPrime));
        // if(this.lambdaIn != 1){
        //     console.log(this.lambdaIn);
        // }
        // console.log("var eta");
        // console.log(this.variableEta);
        // console.log("var lambda prime");
        // console.log(this.variableLambdaPrime)
        
    }

    getEta(){
        return this.variableEta;
    }

    getLambdaPrime(){
        return this.variableLambdaPrime;
    }


}

class SmoothnessNode{
    //lambdaIn = 25
    constructor(factorID, lambdaIn, prevID, afterID){
        this.factorID = factorID;
        var J = [[-1, 1]];
        // J transpose * lambda * [ [-1, 1].T * [x1, x2] + 0 - (x2 - x1) ] = J.T * lambda * 0.
        // left is eta[0] and right is eta[1].
        // These never get changed because they do not depend on the input variables so linearisation always
        // has the same form
        this.lambdaIn = lambdaIn; // 25`
        this.eta = [[0], [0]];
        this.lambda_prime = multiply(multiply(transpose(J), lambdaIn), J); //2*2 [[25, -25], [-25, 25]]
        // console.log("lambda prime");
        // console.log(this.lambda_prime);
        // variable messages:
        this.var_eta_prev = 0.0;
        this.var_lambda_prev = 0.0;
        this.var_eta_after = 0.0;
        this.var_lambda_after = 0.0;

        // IDs of left and right variable nodes:
        this.prevID = prevID;
        this.afterID = afterID;
 
        this.N_sigma  = sqrt(lambdaIn) * 2;
    }

    getEtaPrev(){
        return this.var_eta_prev;
    }

    getEtaAfter(){
        return this.var_eta_after;
    }

    getLambdaPrimePrev(){
        return this.var_lambda_prev;
    }

    getLambdaPrimeAfter(){
        return this.var_lambda_after;
    }

    computeHuberScale(){
        var h =  variableNodes[this.prevID].getMu() - variableNodes[this.afterID].getMu();
        // console.log("h : " + string(h));
        var ms = sqrt(this.lambdaIn * h ** 2);//abs(sqrt(lambdaIn) * h) 5*h
        if (ms > this.N_sigma){
            var kr = 2 * this.N_sigma / ms - (this.N_sigma ** 2) / (ms ** 2);
            if(kr < 0) console.log("kr : " + string(kr));
            return kr;
        }
        return 1;
    }

    //  specify if it is msg to after node or prev
    computeMsgHelper(idx1, idx2, inwardID, var_eta, var_lambda_prime){
        // if prev 
        
        var inwardEta = variableNodes[inwardID].getEta() - var_eta;
        var inwardLambda = variableNodes[inwardID].getLambdaPrime() - var_lambda_prime;

        var kr = this.computeHuberScale();
        var eta = clone(this.eta); //[[0], [0]]
        var lambda_prime = clone(this.lambda_prime);//2*2 [[25, -25], [-25, 25]]

        // left is the first variable in eta and i want to marginalise out the second one (right)
        eta[idx1][0] = this.eta[idx1][0] + inwardEta;// == inwardEta
        lambda_prime[idx1][idx1] = this.lambda_prime[idx1][idx1] + inwardLambda; // == lambdaSmooth + inwardLambda
        eta = multiply(eta, kr);

        lambda_prime = multiply(lambda_prime, kr);

        var eta_a = eta[idx2][0]; // 0
        var eta_b = eta[idx1][0]; // == inwardEta * kr
        var lambda_aa = lambda_prime[idx2][idx2]; // == lambdaSmooth * kr
        var lambda_ab = lambda_prime[idx2][idx1]; //- lambdaSmooth * kr
        var lambda_ba = lambda_prime[idx1][idx2]; //- lambdaSmooth * kr
        var lambda_bb = lambda_prime[idx1][idx1]; // == (lambdaSmooth + inwardLambda) * kr
        // var eta_a = 0
        // var eta_b = inwardEta * kr
        // var lambda_aa =  this.lambdaIn * kr
        // var lambda_ab = - this.lambdaIn * kr
        // var lambda_ba = - this.lambdaIn * kr
        // var lambda_bb = (this.lambdaIn + inwardLambda) * kr


        if(eta_a != 0 ){
            console.log("eta_a is not 0");
        }
        if (lambda_aa != this.lambdaIn * kr){
            console.log("lambda_aa is" + string(lambda_aa));
        }
        if (lambda_ab != - this.lambdaIn * kr){
            console.log("lambda_ab is not 0");
        }
        if (lambda_ba != -this.lambdaIn * kr){
            console.log("lambda_ba is not 0");
        }

        return [eta_a - lambda_ab / lambda_bb * eta_b, lambda_aa - lambda_ab / lambda_bb * lambda_ba];
        //[ lambdaSmooth / (lambdaSmooth + inwardLambda) * (inwardEta * kr),
        // lambdaSmooth * kr - lambdaSmooth / (lambdaSmooth + inwardLambda) * (lambdaSmooth * kr)]
        // return [(25 * kr * inwardEta) / (25 + inwardLambda),
                // 25 * kr - (25 * 25 * kr) / (25 + inwardLambda)];
    }

    // after = right &down  prev = up & left
    computeMsg(){
        var prev = this.computeMsgHelper(1, 0, this.afterID, this.var_eta_after, this.var_lambda_after);
        var after = this.computeMsgHelper(0, 1, this.prevID, this.var_eta_prev, this.var_lambda_prev);
        
        this.var_eta_prev = prev[0];
        this.var_lambda_prev = prev[1];

        this.var_eta_after = after[0];
        this.var_lambda_after = after[1];
        if (prev[0] < 0) console.log("var eta prev : " + string(prev[0]));
        if (prev[1] < 0) console.log("var lambda prev : " + string(prev[1]));
        if (after[0] < 0) console.log("var eta after : " + string(after[0]));
        if (after[1] < 0) console.log("var lambda after : " + string(after[1]));
    }

}

var SIGMAMeas = 1;
var lambdaMeas = 1 / SIGMAMeas ** 2; //1
var SIGMASmooth = 0.2;
var lambdaSmooth = 1 / SIGMASmooth ** 2; // 25

var variableNodes = {};
var factorNodes = {};

// console.log(lambdaMeas); // 1
// console.log(lambdaSmooth) //24.99999999

//========SETTING UP NODES============
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
    var mu = new Buffer.alloc(imgHeight * imgWidth);
    var iter_num = 0;
    while(iter_num < iter) {
        console.log('iteration : ' + iter_num);
        iter_num++;
        // send msg from measurement factor
        for(key in factorNodes){
            factorNodes[key].computeMsg();
        }
    
        for(key in variableNodes){
            variableNodes[key].beliefUpdate();
        }   
    
        // ========== output images ================
        if(renderOutput){
            if (realImage){
                for(i in Object.keys(variableNodes)){ // i : idx from 0 to imgSize
                    mu[i] = round(variableNodes[i].getMu()); //mu :buffer of new img.
                } 
                // console.log(variableNodes[0].getMu());
            
                // output image
                noisyImg.data = mu;
                putImgData("out_alldir"+ iter_num+".png", noisyImg);
            }
            else{ //not real image
                for(i in Object.keys(variableNodes)){ // i : idx from 0 to imgSize
                    // mu[i] = round(variableNodes[i].getMu()); //mu :buffer of new img.
                    console.log(variableNodes[i].getMu());
                } 
            }
    
        }
    }
}

var initTime = (new Date()).getTime();
setUpNodes();
var startIter = (new Date()).getTime();
denoise();
var endIter = (new Date()).getTime();

var duration = endIter - startIter;
console.log("duration (ms)");
console.log(duration);

logResults();

function logResults(){
    const objectsToCsv = require('objects-to-csv');
    var result = [{image : imgName,
                image_size : imgHeight * imgWidth,
                number_of_iter : iter, 
                duration_ms : duration,
                render_output_image : string(renderOutput)}];
    const csv = new objectsToCsv(result);

    if(newLog){ // removed the append:true to clear previous results ===========
        csv.toDisk('resultLog/resultLogAllDir.csv');
    }else{
        csv.toDisk('resultLog/resultLogAllDir.csv', {append : true});
    }
    


    
}