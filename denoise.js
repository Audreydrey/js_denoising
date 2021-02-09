
// import {
//     transpose, chain, derivative, e, evaluate, log, pi, pow, round, sqrt
//   } from 'mathjs';

const { size, multiply, transpose, sqrt, ones, zeros } = require('mathjs')

var noisySignal = getImgData("rose.png");

console.log(noisySignal[100]);

var J = [[1, 0]];
var JT = sqrt(transpose(J));

var lambdaIn = [[0.5]];



var eta = multiply(multiply(JT, lambdaIn), 18);
var m1 = ones(size(eta))
console.log(m1);




var variableNodes = [];

var factorNodes = [];

// name within input folder
function  getImgData(name){
    var fs = require("fs");

    var  PNG = require("pngjs").PNG;

    var data = fs.readFileSync("input/" + name);
    return PNG.sync.read(data).data;
}


class VariableNode{
    constructor(variableID, mu, sigma, priorID, leftID, rightID, upID, downID){
    this.variableID = variableID;
    this.mu = mu;
    this.sigma = sigma;
    this.priorID = priorID;
    this.leftID = leftID;
    this.rightID = rightID;
    this.upID = upID;
    this.downID = downID;
    this.out_eta = zeros(size(mu)); 
    this.out_lambda_prime = zeros(size(sigma));
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

    }

    computeMsg(){
    //   compute msg right, up, left and down
    }
}

class MeasurementNode{
    constructor(factorID, z, lambdaIn, variableID){
        this.factorID = factorID;
        this.z = z; //pixel value
        this.lambdaIn = lambdaIn;

        var J = [[1, 0]];
        var JT = transpose(J);

        this.eta = multiply(multiply(JT, lambdaIn), z);
        this.lambdaPrime = multiply(multiply(JT, lambdaIn), J);
        this.variableID = variableID;
        this.N_sigma = sqrt(lambdaIn[0][0]);
        this.variableEta =this.eta;
        this.variableLambdaPrime = this.lambdaPrime;

        // console.log(transpose(J).toString()) // 2i
    }

    computeHuberscale(){
        var h = this.z - variableNodes[this.variableID].getMu()[0][0];
        var ms = sqrt(h * this.lambdaIn[0][0] * h);
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