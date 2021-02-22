const { min, max, clone, inv, matrix, size, multiply, 
    transpose, sqrt, ones, zeros } = require('mathjs');
const { exit } = require('process');


// get image data including meta data (4 channels)
var noisyImg = getImgData("rose.png");

// reduce pixel values to 1 channel
var noisySignal = getSingleCh(noisyImg.data, noisyImg.height*noisyImg.width); // buffer

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
    var options = {inputHasAlpha:false}

    var data = fs.readFileSync("input/" + name), options;
    var noisyImg =  PNG.sync.read(data, options);

    console.log("===> image width : " + noisyImg.width);
    console.log("===> image height : " +noisyImg.height);
    console.log("===> image color : " + noisyImg.color);
    console.log("===> image has alpha : " + noisyImg.alpha);
    console.log("----image loading complete----");
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
        // checked
        // console.log(factorIDs)
        var fID;
        for (fID in factorIDs) {
            //  sometimes i don't have a factor to my left or right and this id is set to -1
            if (factorIDs[fID] != -1){
                eta_here += factorNodes[factorIDs[fID]].getEta();
                lambda_prime_here += factorNodes[factorIDs[fID]].getLambdaPrime();
            }
            // checked
            // if(this.variableID < 10){
            //     console.log(this.variableID);
            //     console.log(eta_here)
            //     console.log(lambda_prime_here)
            // }
        }
            
        if (lambda_prime_here == 0.0){
            console.log('Lambda prime is zero in belief update, something is wrong');
            exit(0);
        }
        
        // checked
        // console.log(eta_here);
        this.sigma = inv(lambda_prime_here);
        // console.log(this.sigma);
        this.mu = multiply(this.sigma, eta_here);
        // console.log(this.mu);
        this.out_eta = eta_here;;
        // console.log(this.out_eta);
        this.out_lambda_prime = lambda_prime_here;
        // console.log(this.out_lambda_prime);
        
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
        // var JT = transpose(J);

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
        // kr checked
            // if(this.factorID < 100){
            //     console.log(this.factorID);
            //     console.log(k_r)
            // }
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
        var J = [[-1, -1]];
        // J transpose * lambda * [ [-1, 1].T * [x1, x2] + 0 - (x2 - x1) ] = J.T * lambda * 0.
        // left is eta[0] and right is eta[1].
        // These never get changed because they do not depend on the input variables so linearisation always
        // has the same form
        this.lambdaIn = lambdaIn;
        this.eta = [[0], [0]];
        this.lambda_prime = multiply(lambdaIn, multiply(transpose(J), J)); 

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
        eta[idx1] = this.eta[idx1] + inwardEta;
        lambda_prime[idx1][idx1] = this.lambda_prime[idx1][idx1] + inwardLambda;

        eta = multiply(this.eta, kr);
        lambda_prime = multiply(lambda_prime, kr);

        var eta_a = eta[idx2];
        var eta_b = eta[idx1];
        var lambda_aa = lambda_prime[idx2][idx2];
        var lambda_ab = lambda_prime[idx2][idx1];
        var lambda_ba = lambda_prime[idx1][idx2];
        var lambda_bb = lambda_prime[idx1][idx1];

        this.variable_eta = eta_a - lambda_ab / lambda_bb * eta_b;
        this.variable_lambda = lambda_aa - lambda_ab / lambda_bb * lambda_ba;

    }

    // after = right &down  prev = up & left
    computeMsg(isAfter){
        if(this.afterID - this.prevID > 0){
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

var imgHeight = noisyImg.height;
var imgWidth = noisyImg.width;

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
            factorNodes[upID] = new SmoothnessNode(leftID,
                lambdaSmooth, upID[0], upID[1]);
        }
        if(downID != -1 && factorNodes[downID] == null){
            factorNodes[downID] = new SmoothnessNode(downID,
                lambdaSmooth, downID[0], downID[1]);
        }

    }
}


// console.log(num);
// console.log(imgHeight * imgWidth);
// console.log(Object.keys(factorNodes).length); 
// console.log(factorNodes[100].variableID); // 100
// console.log(factorNodes[100].lambdaIn); // 1

// console.log(factorNodes[173280] == null); // true
var mu = new Buffer.alloc(imgHeight * imgWidth);
var iter_num = 0;
// console.log(noisySignal[100]);
// console.log(factorNodes[100]);


while(iter_num < 10) {
    console.log('iteration : ' + iter_num);
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
    // for(key in factorNodes){ //smothness
    //     if(key.includes(',')){
    //         factorNodes[key].computeMsg(false); //up is not after
    //     }
    // }
    for(key in factorNodes){ //measurement
        if(! key.includes(',')){
            factorNodes[key].computeMsg();
        }
    }

    //-------------RIGHT-----------
    for(key in variableNodes){
        variableNodes[key].computeMsg(variableNodes[key].rightID);
    }
    // for(key in factorNodes){ //smothness
    //     if(key.includes(',')){
    //         factorNodes[key].computeMsg(true); //right is after
    //     }
    // }
    for(key in factorNodes){ //measurement
        if(! key.includes(',')){
            factorNodes[key].computeMsg();
        }
    }

    // //-------------DOWN-----------
    for(key in variableNodes){
        variableNodes[key].computeMsg(variableNodes[key].downID);
    }
    // for(key in factorNodes){ //smothness
    //     if(key.includes(',')){
    //         factorNodes[key].computeMsg(true); //down is after
    //     }
    // }
    for(key in factorNodes){ //measurement
        if(! key.includes(',')){
            factorNodes[key].computeMsg();
        }
    }

    // //-------------LEFT-----------
    for(key in variableNodes){
        variableNodes[key].computeMsg(variableNodes[key].leftID);
    }
    // for(key in factorNodes){ //smothness
    //     if(key.includes(',')){
    //         factorNodes[key].computeMsg(false); //left is not after
    //     }
    // }
    for(key in factorNodes){ //measurement
        if(! key.includes(',')){
            factorNodes[key].computeMsg();
        }
    }

    // -----------belief update--------
    for(key in variableNodes){
        variableNodes[key].beliefUpdate();
    }

}

for(i in Object.keys(variableNodes)){ // i : idx from 0 to imgSize
    mu[i] = variableNodes[i].getMu(); //mu :buffer of new img.
    // console.log(mu[i]);
} 

// console.log(mu)
// console.log(noisySignal)



// out put image
noisyImg.data = mu;
putImgData("out.png", noisyImg);