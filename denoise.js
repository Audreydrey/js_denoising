const { inv, matrix, size, multiply, transpose, sqrt, ones, zeros } = require('mathjs');
const { exit } = require('process');


// -------------example of reading, altering and writing images
// get image data including meta data
var noisyImg = getImgData("rose.png");

// get pixel values
var noisySignal = noisyImg.data;
console.log(noisySignal[100]);

// alter pixel values
for(var i = 10000 ; i < 20000; i++){
    noisySignal[i] = 0;
}

// assign altered pixel values to original image
noisyImg.data = noisySignal;

// out put image
putImgData("out.png", noisyImg);

var J = [[1, 0]];
var JT = sqrt(transpose(J));

console.log( multiply(JT, J));

var test = 5;
console.log(transpose(test))

// var lambdaIn = [[0.5]];



// var eta = multiply(multiply(JT, lambdaIn), 18);
// var m1 = ones(size(eta));
// console.log(m1);



// var t = [0,1];
// console.log(t[1]);
// var t_copy = t.concat(); //cat only copy 1 d array
// t_copy[1] = -9;

// console.log(t[1]);




var variableNodes = [];

var factorNodes = [];

// name within input folder
function  getImgData(name){
    var fs = require("fs");

    var  PNG = require("pngjs").PNG;

    var data = fs.readFileSync("input/" + name);
    return PNG.sync.read(data);
}

function  putImgData(name, png){
    var fs = require("fs");

    var  PNG = require("pngjs").PNG;

    var options = { colorType: 6 };
    var buffer = PNG.sync.write(png, options);
    fs.writeFileSync('output' + name, buffer);
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
        var eta_here = matrix([[0.0]])
        var lambda_prime_here = matrix([[0.0]])
        var factorIDs = [this.priorID, this.leftID, this.rightID, this.upID, this.downID]

        var fID;
        for (fID in factorIDs) {
            //  sometimes i don't have a factor to my left or right and this id is set to -1
            if (fID != -1){
                eta_here += factorNodes[fID].getEta();
                lambda_prime_here += factorNodes[fID].getLambdaPrime();
            }
        }
            
        if (lambda_prime_here == 0.0){
            console.log('Lambda prime is zero in belief update, something is wrong');
            exit(0);
        }

        this.sigma = inv(lambda_prime_here);
        this.mu = multiply(this.sigma, eta_here);
        this.out_eta = eta_here;
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
        this.lambdaIn = lambdaIn;

        var J = 1.0;
        // var JT = transpose(J);

        this.eta = lambdaIn * z;
        this.lambdaPrime = lambdaIn;
        this.variableID = variableID;
        this.N_sigma = sqrt(lambdaIn);
        this.variableEta =this.eta;
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

    computeMessage(){
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
        this.lambdaPrime = lambdaIn * multiply(transpose(J), J);

        // variable messages:
        this.variable_eta = [[0, 0]];
        this.variable_lambda = [[0, 0]];

        // IDs of left and right variable nodes:
        this.prevID = prevID;
        this.afterID = afterID;
        this.N_sigma  = sqrt(lambdaIn);
    }

    getEta(){
        return this.eta;
    }

    getLambdaPrime(){
        return this.variable_lambda;
    }

    computeHuberScale(){
        var h =  variableNodes[this.prevID] - variableNodes[this.afterID];
        var ms = sqrt(this.lambdaIn * h);
        if (ms > this.N_sigma){
            kr = 2 * this.N_sigma / ms - (this.N_sigma ** 2) / (ms ** 2);
            return kr;
        }
        return 1;
    }

    //  specify if it is msg to after node or prev
    computeMsg(isAfter){
        var inwardID = this.afterID;
        if(isAfter) {
            inwardID = this.prevID;
        }
        var inwardEta = variableNodes[inwardID].getEta();
        var inwardLambda = variableNodes[inwardID].getLambdaPrime();

        var kr = this.computeHuberScale()
        var eta = this.eta;
        lambda_prime = np.copy(self.lambda_prime)

        // left is the first variable in eta and i want to marginalise out the second one (right)
        eta[1] = self.eta[1] + inwardEta
        lambda_prime[1][1] = self.lambda_prime[1][1] + inwardLambda

        eta = eta * k_R
        lambda_prime = lambda_prime * k_R

        eta_a = eta[0]
        eta_b = eta[1]
        lambda_aa = lambda_prime[0][0]
        lambda_ab = lambda_prime[0][1]
        lambda_ba = lambda_prime[1][0]
        lambda_bb = lambda_prime[1][1]

        self.variable_eta = np.array([eta_a - lambda_ab * 1.0 / lambda_bb * eta_b])
        self.variable_lambda = np.array([lambda_aa - lambda_ab * 1.0 / lambda_bb * lambda_ba])

    }

}